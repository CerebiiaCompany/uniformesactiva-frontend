import { useCallback, useEffect, useRef, useState } from "react";
import { http, UnauthorizedError } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { getApiBaseUrl } from "@/lib/api-base";
import { getStoredAccessToken, isAccessTokenExpired } from "@/lib/auth-session";

export type NotificationType =
  | "quote_created"
  | "order_created"
  | "quote_to_order"
  | "kanban_stage"
  | "labor_rate"
  | "order_payment"
  | string;

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actor_id: string | null;
  actor_name: string;
  entity_type: string;
  entity_id: string | null;
  link_path: string;
  meta: Record<string, unknown>;
  read_at: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  items: AppNotification[];
  unread_count: number;
}

type WsIncoming =
  | { type: "connected"; user_id?: string }
  | { type: "pong" }
  | {
      type: "notification";
      notification: AppNotification;
      unread_count: number;
    };

function buildNotificationsWsUrl(token: string): string {
  const httpBase = (getApiBaseUrl() || "").replace(/\/$/, "");
  const wsBase = httpBase.replace(/^http/i, (m) => (m.toLowerCase() === "https" ? "wss" : "ws"));
  return `${wsBase}/ws/notifications/?token=${encodeURIComponent(token)}`;
}

export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const backoffRef = useRef(1000);

  const fetchNotifications = useCallback(async (opts?: { silent?: boolean }) => {
    if (!enabledRef.current) return;
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const data = await http<NotificationsResponse>(
        endpoints.notifications.list("limit=40")
      );
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Number(data.unread_count) || 0);
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      // Backend caído / red: no ensuciar UI ni consola en silent poll
      if (!opts?.silent) {
        setError(
          err instanceof TypeError
            ? "No se pudo conectar con el servidor"
            : err instanceof Error
              ? err.message
              : "Error al cargar notificaciones"
        );
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      const res = await http<{ deleted: boolean; unread_count: number }>(
        endpoints.notifications.detail(id),
        { method: "DELETE" }
      );
      if (typeof res.unread_count === "number") {
        setUnreadCount(res.unread_count);
      } else {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      void fetchNotifications({ silent: true });
    }
  }, [fetchNotifications]);

  const clearAllNotifications = useCallback(async () => {
    setItems([]);
    setUnreadCount(0);
    try {
      await http<{ deleted: number }>(endpoints.notifications.clearAll(), {
        method: "POST",
        body: "{}",
      });
    } catch {
      void fetchNotifications({ silent: true });
    }
  }, [fetchNotifications]);

  const applyPush = useCallback((payload: Extract<WsIncoming, { type: "notification" }>) => {
    const notif = payload.notification;
    if (!notif?.id) return;
    setItems((prev) => {
      if (prev.some((n) => n.id === notif.id)) return prev;
      return [notif, ...prev].slice(0, 40);
    });
    if (typeof payload.unread_count === "number") {
      setUnreadCount(payload.unread_count);
    } else {
      setUnreadCount((c) => c + 1);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setUnreadCount(0);
      setWsConnected(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    void fetchNotifications();

    const clearPing = () => {
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled || !enabledRef.current) return;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      const delay = backoffRef.current;
      // Backoff más agresivo para no spamear consola cuando el API está caído
      backoffRef.current = Math.min(Math.max(delay, 2000) * 2, 60_000);
      reconnectTimerRef.current = window.setTimeout(() => {
        connectWs();
      }, delay);
    };

    const connectWs = () => {
      if (cancelled || !enabledRef.current) return;
      const token = getStoredAccessToken();
      if (!token || isAccessTokenExpired(token)) {
        setWsConnected(false);
        scheduleReconnect();
        return;
      }

      // Sondeo HTTP barato: si el API no responde, no abrir WS (evita ERR_CONNECTION_REFUSED en consola)
      void (async () => {
        try {
          await http<NotificationsResponse>(
            endpoints.notifications.list("limit=1"),
            { method: "GET" }
          );
        } catch {
          if (cancelled) return;
          setWsConnected(false);
          scheduleReconnect();
          return;
        }
        if (cancelled || !enabledRef.current) return;

        try {
          if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
          }
        } catch {
          // ignore
        }

        const ws = new WebSocket(buildNotificationsWsUrl(token));
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) return;
          backoffRef.current = 2000;
          setWsConnected(true);
          clearPing();
          pingTimerRef.current = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 25_000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(String(event.data)) as WsIncoming;
            if (data?.type === "notification") {
              applyPush(data);
            }
          } catch {
            // ignore malformed
          }
        };

        ws.onerror = () => {
          // onclose reconecta
        };

        ws.onclose = () => {
          setWsConnected(false);
          clearPing();
          if (wsRef.current === ws) wsRef.current = null;
          scheduleReconnect();
        };
      })();
    };

    connectWs();

    const onFocus = () => {
      void fetchNotifications({ silent: true });
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        backoffRef.current = 2000;
        connectWs();
      }
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      clearPing();
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
    };
  }, [enabled, fetchNotifications, applyPush]);

  return {
    items,
    unreadCount,
    loading,
    error,
    wsConnected,
    fetchNotifications,
    deleteNotification,
    clearAllNotifications,
  };
}
