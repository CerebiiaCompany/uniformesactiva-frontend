import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { isAdminUser } from "@/lib/auth-roles";
import {
  useNotifications,
  type AppNotification,
} from "@/hooks/useNotifications";

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
  } catch {
    return "";
  }
}

export function AdminNotificationsBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => isAdminUser());

  useEffect(() => {
    const sync = () => setIsAdmin(isAdminUser());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("local-session-update", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("local-session-update", sync);
    };
  }, []);

  const {
    items,
    unreadCount,
    loading,
    deleteNotification,
    clearAllNotifications,
    fetchNotifications,
  } = useNotifications(isAdmin);

  if (!isAdmin) return null;

  const handleClick = async (n: AppNotification) => {
    await deleteNotification(n.id);
    setOpen(false);
    const path = (n.link_path || "").trim();
    if (path.startsWith("/")) {
      navigate(path);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void fetchNotifications({ silent: true });
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-primary text-[9px] font-semibold text-primary-foreground flex items-center justify-center leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border/80">
          <div>
            <p className="text-sm font-semibold text-foreground">Notificaciones</p>
            <p className="text-[11px] text-muted-foreground">
              {items.length > 0 ? `${items.length} en la bandeja` : "Al día"}
            </p>
          </div>
          {items.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] gap-1 text-muted-foreground"
              onClick={() => void clearAllNotifications()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpiar todas
            </Button>
          ) : null}
        </div>

        <ScrollArea className="h-[min(420px,60vh)]">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No hay notificaciones todavía.
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void handleClick(n)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors",
                      !n.is_read && "bg-primary/[0.04]"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read ? (
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      ) : (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-foreground truncate">
                          {n.title}
                        </p>
                        <p className="text-[12px] text-muted-foreground leading-snug mt-0.5 line-clamp-3">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/80 mt-1">
                          {relativeTime(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
