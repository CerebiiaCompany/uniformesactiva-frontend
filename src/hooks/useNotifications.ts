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
  | "mold_request"
  | "order_payment"
  | "inventory_exit"
  | "order_ready_for_dispatch"
  | "order_in_production"
  | "order_delivered"
  | "order_delayed"
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
  const backoffRef = useRef(2000);
  /** Evita reintentos WS mientras el API HTTP no responde. */
  const apiHealthyRef = useRef(false);

  const fetchNotifications = useCallback(async (opts?: { silent?: boolean }) => {
    if (!enabledRef.current) return false;
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const data = await http<NotificationsResponse>(
        endpoints.notifications.list("limit=40")
      );
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Number(data.unread_count) || 0);
      apiHealthyRef.current = true;
      return true;
    } catch (err) {
      apiHealthyRef.current = false;
      if (err instanceof UnauthorizedError) return false;
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
      return false;
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
      apiHealthyRef.current = false;
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
      // Backoff largo para no spamear Network/consola cuando el API está caído o reiniciando
      backoffRef.current = Math.min(Math.max(delay, 3000) * 2, 120_000);
      reconnectTimerRef.current = window.setTimeout(() => {
        void connectWs();
      }, delay);
    };

    const connectWs = async () => {
      if (cancelled || !enabledRef.current) return;
      const token = getStoredAccessToken();
      if (!token || isAccessTokenExpired(token)) {
        setWsConnected(false);
        scheduleReconnect();
        return;
      }

      // Sin sondeo HTTP extra (limit=1): reutiliza el fetch inicial / focus.
      // Solo abre WS si el API respondió OK recientemente.
      if (!apiHealthyRef.current) {
        const ok = await fetchNotifications({ silent: true });
        if (cancelled) return;
        if (!ok) {
          setWsConnected(false);
          scheduleReconnect();
          return;
        }
      }

      try {
        if (wsRef.current) {
          wsRef.current.onclose = null;
          wsRef.current.close();
        }
      } catch {
        // ignore
      }

      let ws: WebSocket;
      try {
        ws = new WebSocket(buildNotificationsWsUrl(token));
      } catch {
        setWsConnected(false);
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        backoffRef.current = 3000;
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
        // Tras corte WS, exigir un fetch OK antes de reabrir (evita ERR_EMPTY_RESPONSE en loop)
        apiHealthyRef.current = false;
        scheduleReconnect();
      };
    };

    void (async () => {
      const ok = await fetchNotifications();
      if (cancelled) return;
      if (ok) {
        void connectWs();
      } else {
        scheduleReconnect();
      }
    })();

    const onFocus = () => {
      void (async () => {
        const ok = await fetchNotifications({ silent: true });
        if (!ok) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          backoffRef.current = 3000;
          void connectWs();
        }
      })();
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
