import { useState } from "react";
import { Order, StatusHistoryEntry } from "@/data/mockData";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Separator } from "@/components/ui/separator";
import { Check, ChevronRight, Clock, Package, User, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_FLOW: Array<{ key: Order["status"]; label: string }> = [
  { key: "pending", label: "Pendiente" },
  { key: "in_production", label: "En producción" },
  { key: "delivered", label: "Entregado" },
];

function formatDateTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

interface OrderStatusPanelProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"], history: StatusHistoryEntry[]) => void;
}

export function OrderStatusPanel({ order, open, onOpenChange, onStatusChange }: OrderStatusPanelProps) {
  if (!order) return null;

  const currentIndex = STATUS_FLOW.findIndex((s) => s.key === order.status);

  const getHistoryEntry = (statusKey: Order["status"]) =>
    order.statusHistory.find((h) => h.status === statusKey);

  const handleAdvance = () => {
    if (currentIndex >= STATUS_FLOW.length - 1) return;
    const nextStatus = STATUS_FLOW[currentIndex + 1].key;
    const now = new Date().toISOString();
    const newHistory: StatusHistoryEntry[] = [
      ...order.statusHistory,
      { status: nextStatus, timestamp: now },
    ];
    onStatusChange(order.id, nextStatus, newHistory);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[40vw] sm:max-w-[40vw] p-0 border-l border-border bg-background/95 backdrop-blur-xl"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 pb-4">
            <SheetHeader>
              <SheetTitle className="text-lg font-bold text-foreground">
                Estado de fábrica
              </SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <Package className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Orden</p>
                  <p className="font-semibold text-foreground">{order.id}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">Cliente</p>
                    <p className="text-sm font-medium text-foreground">{order.customerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">Entrega</p>
                    <p className="text-sm font-medium text-foreground">{order.dueDate}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Estado actual:</span>
                <StatusBadge status={order.status} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Timeline */}
          <div className="flex-1 overflow-auto p-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">
              Progreso de la orden
            </p>

            <div className="relative">
              {STATUS_FLOW.map((step, idx) => {
                const historyEntry = getHistoryEntry(step.key);
                const isCompleted = idx < currentIndex;
                const isCurrent = idx === currentIndex;
                const isNext = idx === currentIndex + 1;
                const isFuture = idx > currentIndex + 1;
                const isLast = idx === STATUS_FLOW.length - 1;

                return (
                  <div key={step.key} className="relative flex gap-4">
                    {/* Vertical line */}
                    {!isLast && (
                      <div
                        className={cn(
                          "absolute left-[19px] top-[40px] w-0.5 h-[calc(100%-40px)]",
                          isCompleted ? "bg-primary" : "bg-border"
                        )}
                      />
                    )}

                    {/* Circle indicator */}
                    <div className="relative z-10 shrink-0">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                          isCompleted && "bg-primary text-primary-foreground shadow-md shadow-primary/25",
                          isCurrent && "bg-primary/15 border-2 border-primary text-primary ring-4 ring-primary/10",
                          (isNext || isFuture) && "bg-muted border-2 border-border text-muted-foreground"
                        )}
                      >
                        {isCompleted ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <span className="text-sm font-bold">{idx + 1}</span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className={cn("flex-1 pb-8", isLast && "pb-0")}>
                      <div
                        className={cn(
                          "rounded-lg border p-4 transition-all duration-300",
                          isCompleted && "border-primary/30 bg-primary/5",
                          isCurrent && "border-primary/50 bg-primary/10 shadow-sm",
                          (isNext || isFuture) && "border-border bg-muted/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <p
                            className={cn(
                              "font-semibold",
                              (isCompleted || isCurrent) ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {step.label}
                          </p>
                          {isCompleted && (
                            <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              Completado
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[11px] font-medium text-primary bg-primary/15 px-2 py-0.5 rounded-full animate-pulse">
                              Actual
                            </span>
                          )}
                        </div>

                        {historyEntry && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(historyEntry.timestamp)}
                          </div>
                        )}

                        {isNext && !isFuture && (
                          <div className="mt-3">
                            <Button
                              size="sm"
                              onClick={handleAdvance}
                              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                            >
                              Avanzar
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}

                        {isCurrent && currentIndex < STATUS_FLOW.length - 1 && (
                          <div className="mt-3">
                            <Button
                              size="sm"
                              onClick={handleAdvance}
                              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                            >
                              Avanzar a {STATUS_FLOW[currentIndex + 1].label}
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {currentIndex === STATUS_FLOW.length - 1 && (
              <div className="mt-6 rounded-lg border border-success/30 bg-success/10 p-4 text-center">
                <Check className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-sm font-semibold text-success">Orden completada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Todos los estados han sido finalizados
                </p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
