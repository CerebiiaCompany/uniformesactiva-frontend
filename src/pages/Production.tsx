import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { productionOrders, productionStages, orders, type ProductionOrder } from "@/data/mockData";
import { AlertTriangle, User, Calendar, Package, ArrowLeft, ChevronRight, History, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const stageColors: Record<string, string> = {
  design: "border-t-info",
  cutting: "border-t-warning",
  sewing: "border-t-accent",
  embroidery: "border-t-primary",
  quality: "border-t-success",
  printing: "border-t-warning",
  dispatch: "border-t-muted-foreground",
};

const stageLabels: Record<string, string> = {};
productionStages.forEach((s) => { stageLabels[s.key] = s.label; });

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function calcDuration(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  if (days > 0) return `${days}d ${remainHours}h`;
  return `${hours}h`;
}

export default function Production() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [prodOrders, setProdOrders] = useState<ProductionOrder[]>(productionOrders);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClosing, setHistoryClosing] = useState(false);

  const activeOrders = orders.filter((o) => o.status !== "delivered");
  const filteredProdOrders = prodOrders.filter((po) => po.orderId === selectedOrderId);
  const selectedOrder = activeOrders.find((o) => o.id === selectedOrderId);

  const getOrdersForStage = (stage: string) => filteredProdOrders.filter((o) => o.stage === stage);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const handleDragStart = (id: string) => setDraggedId(id);

  const handleDrop = (targetStage: ProductionOrder["stage"]) => {
    if (!draggedId) return;
    const now = new Date().toISOString();
    setProdOrders((prev) =>
      prev.map((o) => {
        if (o.id !== draggedId) return o;
        if (o.stage === targetStage) return o;
        return {
          ...o,
          stage: targetStage,
          daysInStage: 0,
          stageHistory: [...o.stageHistory, { stage: targetStage, enteredAt: now }],
        };
      })
    );
    setDraggedId(null);
  };

  const closeHistory = () => {
    setHistoryClosing(true);
    setTimeout(() => {
      setHistoryOpen(false);
      setHistoryClosing(false);
    }, 400);
  };

  // Combine all stage histories for this order's production tasks
  const orderHistory = filteredProdOrders
    .flatMap((po) => po.stageHistory.map((h) => ({ ...h, taskId: po.id, taskItems: po.items })))
    .sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime());

  // Calculate time per stage
  const stageDurations: { stage: string; duration: string }[] = [];
  for (let i = 0; i < orderHistory.length; i++) {
    const next = orderHistory[i + 1];
    stageDurations.push({
      stage: orderHistory[i].stage,
      duration: next ? calcDuration(orderHistory[i].enteredAt, next.enteredAt) : "En curso",
    });
  }

  // Order list view
  if (!selectedOrderId) {
    return (
      <AppLayout title="Operativo" subtitle="Órdenes activas en planta">
        <div className="grid gap-3">
          {activeOrders.map((order) => {
            const relatedProd = prodOrders.filter((po) => po.orderId === order.id);
            const currentStage = relatedProd.length > 0
              ? productionStages.find((s) => s.key === relatedProd[0].stage)?.label ?? "—"
              : "Sin asignar";

            return (
              <button
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                className="w-full text-left bg-card border border-border rounded-xl p-4 hover:shadow-lg hover:border-primary/30 transition-all duration-200 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-foreground">{order.id}</span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{order.customerName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{order.items}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-muted-foreground">Etapa actual</p>
                      <p className="text-xs font-semibold text-foreground">{currentStage}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-muted-foreground">Entrega</p>
                      <p className="text-xs font-semibold text-foreground">{order.dueDate.slice(5)}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-muted-foreground">Cantidad</p>
                      <p className="text-xs font-semibold text-foreground">{order.quantity} uds</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </button>
            );
          })}
          {activeOrders.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No hay órdenes activas en planta.
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // Kanban view for selected order
  return (
    <AppLayout
      title={`Operativo — ${selectedOrderId}`}
      subtitle={selectedOrder ? `${selectedOrder.customerName} · ${selectedOrder.items}` : ""}
    >
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedOrderId(null)}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a órdenes
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHistoryOpen(true)}
          className="gap-2"
        >
          <History className="h-4 w-4" />
          Ver historial
        </Button>
      </div>

      {filteredProdOrders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Esta orden aún no tiene tareas de producción asignadas.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-12rem)]">
          {productionStages.map((stage) => {
            const stageOrders = getOrdersForStage(stage.key);
            return (
              <div
                key={stage.key}
                className="flex-shrink-0 w-72 flex flex-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(stage.key)}
              >
                <div className={cn("rounded-t-lg border-t-4 bg-card border border-border px-3 py-2.5 flex items-center justify-between", stageColors[stage.key])}>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
                    <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                      {stageOrders.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 bg-muted/30 border-x border-b border-border rounded-b-lg p-2 space-y-2 min-h-[200px]">
                  {stageOrders.map((order) => (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={() => handleDragStart(order.id)}
                      className={cn(
                        "bg-card rounded-lg border border-border p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow animate-fade-in",
                        order.isDelayed && "border-destructive/30 bg-destructive/5"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-foreground">{order.orderId}</span>
                        {order.isDelayed && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{order.items}</p>
                      <p className="text-xs font-medium text-foreground mb-3">{order.customerName}</p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {order.assignee}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {order.dueDate.slice(5)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Package className="h-3 w-3" /> {order.quantity} uds
                        </span>
                        <span className="text-[10px] text-muted-foreground">{order.daysInStage}d en etapa</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History Side Panel */}
      {historyOpen && (
        <>
          <div
            className={cn(
              "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-400",
              historyClosing ? "opacity-0" : "opacity-100"
            )}
            onClick={closeHistory}
          />
          <div
            className={cn(
              "fixed top-0 right-0 h-full w-full sm:w-[40%] bg-card border-l border-border z-50 shadow-2xl transition-transform duration-400 ease-in-out overflow-y-auto",
              historyClosing ? "translate-x-full" : "translate-x-0"
            )}
          >
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Historial de producción
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedOrderId} · {selectedOrder?.customerName}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeHistory} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4">
              {/* Summary */}
              <div className="mb-6 grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Etapas completadas</p>
                  <p className="text-lg font-bold text-foreground">{orderHistory.length > 1 ? orderHistory.length - 1 : 0}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Etapa actual</p>
                  <p className="text-sm font-bold text-primary">{stageLabels[filteredProdOrders[0]?.stage] ?? "—"}</p>
                </div>
              </div>

              {/* Duration per stage */}
              <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Tiempo por etapa</h3>
              <div className="space-y-2 mb-6">
                {stageDurations.map((sd, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                    <span className="text-xs font-medium text-foreground">{stageLabels[sd.stage]}</span>
                    <span className={cn(
                      "text-xs font-semibold",
                      sd.duration === "En curso" ? "text-primary" : "text-muted-foreground"
                    )}>
                      <Clock className="h-3 w-3 inline mr-1" />
                      {sd.duration}
                    </span>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Línea de tiempo</h3>
              <div className="relative pl-6">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
                {orderHistory.map((entry, i) => {
                  const isLast = i === orderHistory.length - 1;
                  const endTime = !isLast ? orderHistory[i + 1].enteredAt : null;
                  return (
                    <div key={i} className="relative pb-6 last:pb-0">
                      <div className={cn(
                        "absolute left-[-15px] top-1 h-3 w-3 rounded-full border-2",
                        isLast
                          ? "bg-primary border-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
                          : "bg-card border-muted-foreground"
                      )} />
                      <div className="ml-2 space-y-1">
                        <p className="text-xs font-semibold text-foreground">{stageLabels[entry.stage]}</p>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[10px] text-muted-foreground">
                            <span className="font-medium text-foreground/80">Hora de inicio:</span> {formatDateTime(entry.enteredAt)}
                          </p>
                          {endTime && (
                            <p className="text-[10px] text-muted-foreground">
                              <span className="font-medium text-foreground/80">Hora de fin:</span> {formatDateTime(endTime)}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            <span className="font-medium text-foreground/80">Duración:</span>{" "}
                            {!isLast ? calcDuration(entry.enteredAt, endTime!) : (
                              <span className="text-primary font-medium">● En curso</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
