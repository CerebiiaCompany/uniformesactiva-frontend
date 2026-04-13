import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { productionOrders, productionStages, orders, type ProductionOrder } from "@/data/mockData";
import { AlertTriangle, User, Calendar, Package, ArrowLeft, ChevronRight } from "lucide-react";
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

export default function Production() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [prodOrders, setProdOrders] = useState<ProductionOrder[]>(productionOrders);

  // Non-dispatched orders only
  const activeOrders = orders.filter((o) => o.status !== "delivered");

  // Kanban filtered by selected order
  const filteredProdOrders = prodOrders.filter((po) => po.orderId === selectedOrderId);
  const selectedOrder = activeOrders.find((o) => o.id === selectedOrderId);

  const getOrdersForStage = (stage: string) => filteredProdOrders.filter((o) => o.stage === stage);

  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDraggedId(id);

  const handleDrop = (targetStage: ProductionOrder["stage"]) => {
    if (!draggedId) return;
    setProdOrders((prev) =>
      prev.map((o) => (o.id === draggedId ? { ...o, stage: targetStage, daysInStage: 0 } : o))
    );
    setDraggedId(null);
  };

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
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedOrderId(null)}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a órdenes
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
    </AppLayout>
  );
}
