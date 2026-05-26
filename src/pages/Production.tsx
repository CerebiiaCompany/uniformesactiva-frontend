import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { productionOrders, productionStages, orders, type ProductionOrder } from "@/data/mockData";
import { AlertTriangle, User, Calendar, Package, ArrowLeft, ChevronRight, History, Clock, X, Plus, Pencil, Trash2, GripVertical, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const defaultStageColors: Record<string, string> = {
  design: "border-t-info",
  cutting: "border-t-warning",
  sewing: "border-t-accent",
  embroidery: "border-t-primary",
  quality: "border-t-success",
  printing: "border-t-warning",
  dispatch: "border-t-muted-foreground",
};

const colorPalette = [
  "border-t-info",
  "border-t-warning",
  "border-t-accent",
  "border-t-primary",
  "border-t-success",
  "border-t-destructive",
  "border-t-muted-foreground",
];

interface Stage {
  key: string;
  label: string;
  colorClass: string;
}

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
  const [stages, setStages] = useState<Stage[]>(
    productionStages.map((s) => ({ key: s.key, label: s.label, colorClass: defaultStageColors[s.key] ?? "border-t-muted-foreground" }))
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClosing, setHistoryClosing] = useState(false);

  // Column editing
  const [editingColKey, setEditingColKey] = useState<string | null>(null);
  const [editingColLabel, setEditingColLabel] = useState("");

  // Drag state
  const [dragType, setDragType] = useState<"card" | "column" | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedColKey, setDraggedColKey] = useState<string | null>(null);

  // Card dialog
  const [cardDialog, setCardDialog] = useState<{
    open: boolean;
    mode: "add" | "edit";
    stageKey?: string;
    cardId?: string;
    items: string;
    assignee: string;
    quantity: number;
    dueDate: string;
  }>({ open: false, mode: "add", items: "", assignee: "", quantity: 0, dueDate: "" });

  const activeOrders = orders.filter((o) => o.status !== "delivered");
  const filteredProdOrders = prodOrders.filter((po) => po.orderId === selectedOrderId);
  const selectedOrder = activeOrders.find((o) => o.id === selectedOrderId);

  const stageLabels: Record<string, string> = {};
  stages.forEach((s) => { stageLabels[s.key] = s.label; });

  const getOrdersForStage = (stage: string) => filteredProdOrders.filter((o) => o.stage === stage);

  // ===== Card drag =====
  const handleCardDragStart = (e: React.DragEvent, id: string) => {
    setDragType("card");
    setDraggedCardId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCardDrop = (targetStage: string) => {
    if (dragType !== "card" || !draggedCardId) return;
    const now = new Date().toISOString();
    setProdOrders((prev) =>
      prev.map((o) => {
        if (o.id !== draggedCardId) return o;
        if (o.stage === targetStage) return o;
        return {
          ...o,
          stage: targetStage as ProductionOrder["stage"],
          daysInStage: 0,
          stageHistory: [...o.stageHistory, { stage: targetStage as ProductionOrder["stage"], enteredAt: now }],
        };
      })
    );
    setDraggedCardId(null);
    setDragType(null);
  };

  // ===== Column drag =====
  const handleColDragStart = (e: React.DragEvent, key: string) => {
    setDragType("column");
    setDraggedColKey(key);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleColDropOnCol = (targetKey: string) => {
    if (dragType !== "column" || !draggedColKey || draggedColKey === targetKey) {
      setDraggedColKey(null);
      setDragType(null);
      return;
    }
    setStages((prev) => {
      const fromIdx = prev.findIndex((s) => s.key === draggedColKey);
      const toIdx = prev.findIndex((s) => s.key === targetKey);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDraggedColKey(null);
    setDragType(null);
  };

  // ===== Column CRUD =====
  const startEditCol = (s: Stage) => {
    setEditingColKey(s.key);
    setEditingColLabel(s.label);
  };
  const commitEditCol = () => {
    if (!editingColKey) return;
    const label = editingColLabel.trim();
    if (!label) { setEditingColKey(null); return; }
    setStages((prev) => prev.map((s) => s.key === editingColKey ? { ...s, label } : s));
    setEditingColKey(null);
  };
  const deleteCol = (key: string) => {
    if (stages.length <= 1) return;
    const fallback = stages.find((s) => s.key !== key)!;
    setProdOrders((prev) => prev.map((o) => o.stage === key ? { ...o, stage: fallback.key as ProductionOrder["stage"] } : o));
    setStages((prev) => prev.filter((s) => s.key !== key));
  };
  const addCol = () => {
    const key = `custom-${Date.now()}`;
    const colorClass = colorPalette[stages.length % colorPalette.length];
    const newStage: Stage = { key, label: "Nueva etapa", colorClass };
    setStages((prev) => [...prev, newStage]);
    setEditingColKey(key);
    setEditingColLabel(newStage.label);
  };

  // ===== Card CRUD =====
  const openAddCard = (stageKey: string) => {
    setCardDialog({
      open: true, mode: "add", stageKey,
      items: "", assignee: "", quantity: 1,
      dueDate: selectedOrder?.dueDate ?? new Date().toISOString().slice(0, 10),
    });
  };
  const openEditCard = (card: ProductionOrder) => {
    setCardDialog({
      open: true, mode: "edit", cardId: card.id, stageKey: card.stage,
      items: card.items, assignee: card.assignee, quantity: card.quantity, dueDate: card.dueDate,
    });
  };
  const saveCard = () => {
    const { mode, cardId, stageKey, items, assignee, quantity, dueDate } = cardDialog;
    if (!items.trim()) return;
    if (mode === "add" && stageKey && selectedOrderId && selectedOrder) {
      const now = new Date().toISOString();
      const newCard: ProductionOrder = {
        id: `PO-${Date.now()}`,
        orderId: selectedOrderId,
        customerName: selectedOrder.customerName,
        items, assignee, quantity, dueDate,
        stage: stageKey as ProductionOrder["stage"],
        daysInStage: 0,
        isDelayed: false,
        stageHistory: [{ stage: stageKey as ProductionOrder["stage"], enteredAt: now }],
      };
      setProdOrders((prev) => [...prev, newCard]);
    } else if (mode === "edit" && cardId) {
      setProdOrders((prev) => prev.map((o) => o.id === cardId ? { ...o, items, assignee, quantity, dueDate } : o));
    }
    setCardDialog((d) => ({ ...d, open: false }));
  };
  const deleteCard = (id: string) => {
    setProdOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const closeHistory = () => {
    setHistoryClosing(true);
    setTimeout(() => {
      setHistoryOpen(false);
      setHistoryClosing(false);
    }, 400);
  };

  const stageKeySet = new Set(stages.map((s) => s.key));
  const orderHistory = filteredProdOrders
    .flatMap((po) => po.stageHistory.map((h) => ({ ...h, taskId: po.id, taskItems: po.items })))
    .filter((h) => stageKeySet.has(h.stage))
    .sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime());

  const stageDurations: { stage: string; duration: string }[] = [];
  for (let i = 0; i < orderHistory.length; i++) {
    const next = orderHistory[i + 1];
    stageDurations.push({
      stage: orderHistory[i].stage,
      duration: next ? calcDuration(orderHistory[i].enteredAt, next.enteredAt) : "En curso",
    });
  }

  // Ensure every active order has at least one default card representing it
  useEffect(() => {
    if (stages.length === 0) return;
    const firstStageKey = stages[0].key as ProductionOrder["stage"];
    const missing = activeOrders.filter((o) => !prodOrders.some((po) => po.orderId === o.id));
    if (missing.length === 0) return;
    const now = new Date().toISOString();
    const newCards: ProductionOrder[] = missing.map((o) => ({
      id: `PO-auto-${o.id}`,
      orderId: o.id,
      customerName: o.customerName,
      items: o.items,
      quantity: o.quantity,
      stage: firstStageKey,
      assignee: "Sin asignar",
      dueDate: o.dueDate,
      daysInStage: 0,
      isDelayed: false,
      stageHistory: [{ stage: firstStageKey, enteredAt: now }],
    }));
    setProdOrders((prev) => [...prev, ...newCards]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.length === 0]);

  // Order list view
  if (!selectedOrderId) {
    return (
      <AppLayout title="Operativo" subtitle="Órdenes activas en planta">
        <div className="grid gap-3">
          {activeOrders.map((order) => {
            const relatedProd = prodOrders.filter((po) => po.orderId === order.id);
            const currentStage = relatedProd.length > 0
              ? stages.find((s) => s.key === relatedProd[0].stage)?.label ?? "—"
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

  // Kanban view
  return (
    <AppLayout
      title={`Operativo — ${selectedOrderId}`}
      subtitle={selectedOrder ? `${selectedOrder.customerName} · ${selectedOrder.items}` : ""}
    >
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedOrderId(null)}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a órdenes
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="gap-2">
            <History className="h-4 w-4" />
            Ver historial
          </Button>
          <Button variant="default" size="sm" onClick={addCol} className="gap-2">
            <Plus className="h-4 w-4" />
            Añadir tablero
          </Button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-12rem)]">
        {stages.map((stage) => {
          const stageOrders = getOrdersForStage(stage.key);
          const isEditing = editingColKey === stage.key;
          return (
            <div
              key={stage.key}
              className={cn(
                "flex-shrink-0 w-72 flex flex-col transition-opacity",
                draggedColKey === stage.key && "opacity-40"
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragType === "column") handleColDropOnCol(stage.key);
                else handleCardDrop(stage.key);
              }}
            >
              <div className={cn("rounded-t-lg border-t-4 bg-card border border-border px-3 py-2.5 flex items-center justify-between gap-2 group", stage.colorClass)}>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <button
                    draggable={!isEditing}
                    onDragStart={(e) => handleColDragStart(e, stage.key)}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
                    title="Arrastrar tablero"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        autoFocus
                        value={editingColLabel}
                        onChange={(e) => setEditingColLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEditCol();
                          if (e.key === "Escape") setEditingColKey(null);
                        }}
                        onBlur={commitEditCol}
                        className="h-7 text-sm"
                      />
                      <button onMouseDown={(e) => { e.preventDefault(); commitEditCol(); }} className="text-success shrink-0">
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold text-foreground truncate">{stage.label}</h3>
                      <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium shrink-0">
                        {stageOrders.length}
                      </span>
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => startEditCol(stage)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Editar nombre"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteCol(stage.key)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Eliminar tablero"
                      disabled={stages.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 bg-muted/30 border-x border-b border-border rounded-b-lg p-2 space-y-2 min-h-[200px]">
                {stageOrders.map((order) => (
                  <div
                    key={order.id}
                    draggable
                    onDragStart={(e) => handleCardDragStart(e, order.id)}
                    className={cn(
                      "bg-card rounded-lg border border-border p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow animate-fade-in group/card relative",
                      order.isDelayed && "border-destructive/30 bg-destructive/5"
                    )}
                  >
                    <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditCard(order); }}
                        className="p-1 rounded bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Editar tarjeta"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCard(order.id); }}
                        className="p-1 rounded bg-background/80 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="Eliminar tarjeta"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mb-2 pr-14">
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
                <button
                  onClick={() => openAddCard(stage.key)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-card hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir tarjeta
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Card Add/Edit Dialog */}
      <Dialog open={cardDialog.open} onOpenChange={(open) => setCardDialog((d) => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cardDialog.mode === "add" ? "Nueva tarjeta" : "Editar tarjeta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="items" className="text-xs">Descripción</Label>
              <Input id="items" value={cardDialog.items} onChange={(e) => setCardDialog((d) => ({ ...d, items: e.target.value }))} placeholder="Ej. 100 Polos azules" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="assignee" className="text-xs">Responsable</Label>
                <Input id="assignee" value={cardDialog.assignee} onChange={(e) => setCardDialog((d) => ({ ...d, assignee: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="quantity" className="text-xs">Cantidad</Label>
                <Input id="quantity" type="number" value={cardDialog.quantity} onChange={(e) => setCardDialog((d) => ({ ...d, quantity: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="dueDate" className="text-xs">Fecha de entrega</Label>
              <Input id="dueDate" type="date" value={cardDialog.dueDate} onChange={(e) => setCardDialog((d) => ({ ...d, dueDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialog((d) => ({ ...d, open: false }))}>Cancelar</Button>
            <Button onClick={saveCard}>{cardDialog.mode === "add" ? "Crear" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

              <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">Tiempo por etapa</h3>
              <div className="space-y-2 mb-6">
                {stageDurations.map((sd, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                    <span className="text-xs font-medium text-foreground">{stageLabels[sd.stage] ?? sd.stage}</span>
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
                        <p className="text-xs font-semibold text-foreground">{stageLabels[entry.stage] ?? entry.stage}</p>
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
