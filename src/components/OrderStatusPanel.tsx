import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Separator } from "@/components/ui/separator";
import { Check, ChevronRight, Package, User, Calendar, X, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Order, useOrders, OrderLog } from "@/hooks/useOrders";
import { Textarea } from "@/components/ui/textarea";

const STATUS_FLOW: Array<{ key: string; label: string }> = [
  { key: "pending", label: "Pendiente" },
  { key: "in_production", label: "En producción" },
  { key: "delivered", label: "Entregado" },
];

interface OrderStatusPanelProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: () => void;
}

export function OrderStatusPanel({ order, open, onOpenChange, onStatusChange }: OrderStatusPanelProps) {
  const [loading, setLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [observacion, setObservacion] = useState("");

  // Integración del historial
  const [logs, setLogs] = useState<OrderLog[]>([]);
  const { fetchOrderLogs, updateOrderStatus } = useOrders();

  useEffect(() => {
    if (open && order) {
      fetchOrderLogs(order.id).then(setLogs);
    }
  }, [open, order]);

  if (!order) return null;

  const currentIndex = STATUS_FLOW.findIndex((s) => s.key === order.estado);

  const handleUpdateStatus = async () => {
    const nextStatus = STATUS_FLOW[currentIndex + 1]?.key;
    if (!nextStatus) return;

    setLoading(true);
    const success = await updateOrderStatus(order.id, nextStatus, observacion || null);

    if (success) {
      setObservacion("");
      setIsConfirming(false);
      onStatusChange();
      onOpenChange(false);
    } else {
      alert("Error al actualizar el estado");
    }
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[40vw] sm:max-w-[40vw] p-0 border-l border-border bg-background/95 backdrop-blur-xl"
      >
        <div className="flex flex-col h-full">
          <div className="p-6 pb-4">
            <SheetHeader>
              <SheetTitle className="text-lg font-bold text-foreground">Estado de fábrica</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <Package className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Orden</p>
                  <p className="font-semibold text-foreground">#{order.id}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">Cliente</p>
                    <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
                      {order.cliente_nombre}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">Inicio</p>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(order.fecha_creacion).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Estado actual:</span>
                <StatusBadge status={order.estado} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex-1 overflow-auto p-6 space-y-8">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">Progreso de la orden</p>
              <div className="relative">
                {STATUS_FLOW.map((step, idx) => {
                  const isCompleted = idx < currentIndex;
                  const isCurrent = idx === currentIndex;
                  const isNext = idx === currentIndex + 1;
                  const isFuture = idx > currentIndex + 1;

                  return (
                    <div key={step.key} className="relative flex gap-4">
                      {idx < STATUS_FLOW.length - 1 && (
                        <div className={cn("absolute left-[19px] top-[40px] w-0.5 h-[calc(100%-40px)]", isCompleted ? "bg-primary" : "bg-border")} />
                      )}
                      <div className="relative z-10 shrink-0">
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300", isCompleted && "bg-primary text-primary-foreground", isCurrent && "bg-primary/15 border-2 border-primary text-primary", (isNext || isFuture) && "bg-muted border-2 border-border text-muted-foreground")}>
                          {isCompleted ? <Check className="h-5 w-5" /> : <span className="text-sm font-bold">{idx + 1}</span>}
                        </div>
                      </div>
                      <div className={cn("flex-1 pb-8", idx === STATUS_FLOW.length - 1 && "pb-0")}>
                        <div className={cn("rounded-lg border p-4", isCurrent && "border-primary/50 bg-primary/10")}>
                          <p className="font-semibold">{step.label}</p>
                          {isNext && !isConfirming && (
                            <Button size="sm" onClick={() => setIsConfirming(true)} className="mt-3 gap-1.5">
                              Avanzar <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                          {isNext && isConfirming && (
                            <div className="mt-3 space-y-3">
                              <Textarea
                                placeholder="Observación (opcional)"
                                value={observacion}
                                onChange={(e) => setObservacion(e.target.value)}
                                className="text-sm"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleUpdateStatus} disabled={loading} className="flex-1">
                                  {loading ? "Procesando..." : "Confirmar"}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setIsConfirming(false)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Nueva sección de historial */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <History className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Historial</p>
              </div>
              <div className="space-y-4">
                {logs.map((log) => (
                  <div key={log.id} className="text-sm border-l-2 border-muted pl-4">
                    <p className="font-medium text-foreground capitalize">
                      {log.estado_anterior.replace('_', ' ')} → {log.estado_nuevo.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.fecha_hora).toLocaleString()}
                    </p>
                    {log.observacion && (
                      <p className="text-xs mt-1 italic text-muted-foreground">"{log.observacion}"</p>
                    )}
                  </div>
                ))}
                {logs.length === 0 && <p className="text-xs text-muted-foreground italic">Sin cambios registrados.</p>}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}