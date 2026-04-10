import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { productionOrders, productionStages, type ProductionOrder } from "@/data/mockData";
import { AlertTriangle, User, Calendar, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const stageColors: Record<string, string> = {
  design: "border-t-info",
  cutting: "border-t-warning",
  sewing: "border-t-accent",
  embroidery: "border-t-primary",
  quality: "border-t-success",
  dispatch: "border-t-muted-foreground",
};

export default function Production() {
  const [orders, setOrders] = useState<ProductionOrder[]>(productionOrders);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const getOrdersForStage = (stage: string) => orders.filter((o) => o.stage === stage);

  const handleDragStart = (id: string) => setDraggedId(id);

  const handleDrop = (targetStage: ProductionOrder["stage"]) => {
    if (!draggedId) return;
    setOrders((prev) =>
      prev.map((o) => (o.id === draggedId ? { ...o, stage: targetStage, daysInStage: 0 } : o))
    );
    setDraggedId(null);
  };

  return (
    <AppLayout title="Producción" subtitle="Tablero Kanban de producción">
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-8rem)]">
        {productionStages.map((stage) => {
          const stageOrders = getOrdersForStage(stage.key);
          return (
            <div
              key={stage.key}
              className="flex-shrink-0 w-72 flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage.key)}
            >
              {/* Column header */}
              <div className={cn("rounded-t-lg border-t-4 bg-card border border-border px-3 py-2.5 flex items-center justify-between", stageColors[stage.key])}>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
                  <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                    {stageOrders.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
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
    </AppLayout>
  );
}
