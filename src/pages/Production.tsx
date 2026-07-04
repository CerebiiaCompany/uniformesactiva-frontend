import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrders } from "@/hooks/useOrders";
import { type ProductionOrder } from "@/data/mockData";
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
  const { orders: rawOrders, fetchOrders } = useOrders();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [prodOrders, setProdOrders] = useState<ProductionOrder[]>([]);
  const [stages, setStages] = useState<Stage[]>([
    { key: "design", label: "Diseño", colorClass: defaultStageColors.design },
    { key: "cutting", label: "Corte", colorClass: defaultStageColors.cutting },
    { key: "sewing", label: "Costura", colorClass: defaultStageColors.sewing },
    { key: "embroidery", label: "Bordado", colorClass: defaultStageColors.embroidery },
    { key: "quality", label: "Calidad", colorClass: defaultStageColors.quality }
  ]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClosing, setHistoryClosing] = useState(false);
  const [editingColKey, setEditingColKey] = useState<string | null>(null);
  const [editingColLabel, setEditingColLabel] = useState("");
  const [dragType, setDragType] = useState<"card" | "column" | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
  const [cardDialog, setCardDialog] = useState<{
    open: boolean; mode: "add" | "edit"; stageKey?: string; cardId?: string;
    items: string; assignee: string; quantity: number; dueDate: string;
  }>({ open: false, mode: "add", items: "", assignee: "", quantity: 0, dueDate: "" });

  // Cargar órdenes reales en producción
  useEffect(() => {
    fetchOrders({ estado: "in_production" });
  }, []);

  // Mapeo de datos reales al tipo de la UI
  useEffect(() => {
    if (rawOrders && rawOrders.length > 0) {
      const transformed = rawOrders.map(o => ({
        id: `PO-${o.id}`,
        orderId: o.id,
        customerName: o.cliente_nombre,
        items: o.items.map(i => i.subproducto_nombre).join(", "),
        quantity: o.items.reduce((s, i) => s + i.cantidad, 0),
        stage: "design" as const,
        assignee: o.tomado_por_nombre || "Sin asignar",
        dueDate: o.fecha_estimada_entrega?.slice(0, 10) ?? "",
        daysInStage: 0,
        isDelayed: false,
        stageHistory: [{ stage: "design" as const, enteredAt: o.fecha_creacion }]
      }));
      setProdOrders(transformed);
    }
  }, [rawOrders]);

  const activeOrders = rawOrders.filter((o) => o.estado !== "delivered");
  const filteredProdOrders = prodOrders.filter((po) => po.orderId === selectedOrderId);
  const selectedOrder = activeOrders.find((o) => o.id === selectedOrderId);

  const stageLabels: Record<string, string> = {};
  stages.forEach((s) => { stageLabels[s.key] = s.label; });

  const getOrdersForStage = (stage: string) => filteredProdOrders.filter((o) => o.stage === stage);

  const handleCardDragStart = (e: React.DragEvent, id: string) => { setDragType("card"); setDraggedCardId(id); e.dataTransfer.effectAllowed = "move"; };
  const handleCardDrop = (targetStage: string) => {
    if (dragType !== "card" || !draggedCardId) return;
    const now = new Date().toISOString();
    setProdOrders((prev) => prev.map((o) => o.id !== draggedCardId ? o : { ...o, stage: targetStage as ProductionOrder["stage"], stageHistory: [...o.stageHistory, { stage: targetStage as ProductionOrder["stage"], enteredAt: now }] }));
    setDraggedCardId(null); setDragType(null);
  };

  const handleColDragStart = (e: React.DragEvent, key: string) => { setDragType("column"); setDraggedColKey(key); e.dataTransfer.effectAllowed = "move"; };
  const handleColDropOnCol = (targetKey: string) => {
    if (dragType !== "column" || !draggedColKey || draggedColKey === targetKey) { setDraggedColKey(null); setDragType(null); return; }
    setStages((prev) => {
      const fromIdx = prev.findIndex((s) => s.key === draggedColKey);
      const toIdx = prev.findIndex((s) => s.key === targetKey);
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDraggedColKey(null); setDragType(null);
  };

  const startEditCol = (s: Stage) => { setEditingColKey(s.key); setEditingColLabel(s.label); };
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
    const newStage: Stage = { key, label: "Nueva etapa", colorClass: colorPalette[stages.length % colorPalette.length] };
    setStages((prev) => [...prev, newStage]);
    setEditingColKey(key); setEditingColLabel(newStage.label);
  };

  const openAddCard = (stageKey: string) => setCardDialog({ open: true, mode: "add", stageKey, items: "", assignee: "", quantity: 1, dueDate: selectedOrder?.fecha_estimada_entrega?.slice(0, 10) ?? "" });
  const openEditCard = (card: ProductionOrder) => setCardDialog({ open: true, mode: "edit", cardId: card.id, stageKey: card.stage, items: card.items, assignee: card.assignee, quantity: card.quantity, dueDate: card.dueDate });
  const saveCard = () => {
    const { mode, cardId, stageKey, items, assignee, quantity, dueDate } = cardDialog;
    if (!items.trim()) return;
    if (mode === "add" && stageKey && selectedOrderId && selectedOrder) {
      setProdOrders((prev) => [...prev, { id: `PO-${Date.now()}`, orderId: selectedOrderId, customerName: selectedOrder.cliente_nombre, items, assignee, quantity, dueDate, stage: stageKey as ProductionOrder["stage"], daysInStage: 0, isDelayed: false, stageHistory: [{ stage: stageKey as ProductionOrder["stage"], enteredAt: new Date().toISOString() }] }]);
    } else if (mode === "edit" && cardId) {
      setProdOrders((prev) => prev.map((o) => o.id === cardId ? { ...o, items, assignee, quantity, dueDate } : o));
    }
    setCardDialog((d) => ({ ...d, open: false }));
  };
  const deleteCard = (id: string) => setProdOrders((prev) => prev.filter((o) => o.id !== id));
  const closeHistory = () => { setHistoryClosing(true); setTimeout(() => { setHistoryOpen(false); setHistoryClosing(false); }, 400); };

  const stageKeySet = new Set(stages.map((s) => s.key));
  const orderHistory = filteredProdOrders.flatMap((po) => po.stageHistory.map((h) => ({ ...h, taskId: po.id, taskItems: po.items }))).filter((h) => stageKeySet.has(h.stage)).sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime());
  const stageDurations = orderHistory.map((h, i, arr) => ({ stage: h.stage, duration: arr[i + 1] ? calcDuration(h.enteredAt, arr[i + 1].enteredAt) : "En curso" }));

  if (!selectedOrderId) {
    return (
      <AppLayout title="Operativo" subtitle="Órdenes activas en planta">
        <div className="grid gap-3">
          {activeOrders.map((order) => (
            <button key={order.id} onClick={() => setSelectedOrderId(order.id)} className="w-full text-left bg-card border border-border rounded-xl p-4 hover:shadow-lg hover:border-primary/30 transition-all duration-200 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Package className="h-5 w-5 text-primary" /></div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5"><span className="text-sm font-bold text-foreground">
                      ORD-{order.id.slice(0, 3)}
                    </span><StatusBadge status={order.estado} /></div>
                    <p className="text-xs text-muted-foreground">{order.cliente_nombre}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{order.items.map(i => i.subproducto_nombre).join(", ")}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Operativo — ${selectedOrderId}`} subtitle={selectedOrder ? `${selectedOrder.cliente_nombre}` : ""}>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => setSelectedOrderId(null)} className="gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver</Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="gap-2"><History className="h-4 w-4" /> Historial</Button>
          <Button variant="default" size="sm" onClick={addCol} className="gap-2"><Plus className="h-4 w-4" /> Añadir tablero</Button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-12rem)]">
        {stages.map((stage) => {
          const stageOrders = getOrdersForStage(stage.key);
          const isEditing = editingColKey === stage.key;
          return (
            <div key={stage.key} className={cn("flex-shrink-0 w-72 flex flex-col transition-opacity", draggedColKey === stage.key && "opacity-40")} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragType === "column") handleColDropOnCol(stage.key); else handleCardDrop(stage.key); }}>
              <div className={cn("rounded-t-lg border-t-4 bg-card border border-border px-3 py-2.5 flex items-center justify-between gap-2 group", stage.colorClass)}>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <button draggable={!isEditing} onDragStart={(e) => handleColDragStart(e, stage.key)} className="cursor-grab text-muted-foreground hover:text-foreground shrink-0"><GripVertical className="h-4 w-4" /></button>
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1"><Input autoFocus value={editingColLabel} onChange={(e) => setEditingColLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commitEditCol(); }} onBlur={commitEditCol} className="h-7 text-sm" /><button onMouseDown={commitEditCol} className="text-success"><Check className="h-4 w-4" /></button></div>
                  ) : (
                    <><h3 className="text-sm font-semibold text-foreground truncate">{stage.label}</h3><span className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5">{stageOrders.length}</span></>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditCol(stage)} className="p-1 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => deleteCol(stage.key)} className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
              <div className="flex-1 bg-muted/30 border-x border-b border-border rounded-b-lg p-2 space-y-2 min-h-[200px]">
                {stageOrders.map((order) => (
                  <div key={order.id} draggable onDragStart={(e) => handleCardDragStart(e, order.id)} className="bg-card rounded-lg border border-border p-3 cursor-grab hover:shadow-md transition-shadow relative group/card">
                    <div className="absolute top-2 right-2 flex opacity-0 group-hover/card:opacity-100"><button onClick={() => openEditCard(order)} className="p-1"><Pencil className="h-3 w-3" /></button><button onClick={() => deleteCard(order.id)} className="p-1"><Trash2 className="h-3 w-3" /></button></div>
                    <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold">{order.orderId}</span></div>
                    <p className="text-xs text-muted-foreground mb-2">{order.items}</p>
                    <p className="text-xs font-medium mb-3">{order.customerName}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground"><span><User className="h-3 w-3 inline" /> {order.assignee}</span><span><Calendar className="h-3 w-3 inline" /> {order.dueDate.slice(5)}</span></div>
                  </div>
                ))}
                <button onClick={() => openAddCard(stage.key)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed text-xs hover:bg-card"><Plus className="h-3.5 w-3.5" /> Añadir tarjeta</button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={cardDialog.open} onOpenChange={(open) => setCardDialog((d) => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>{cardDialog.mode === "add" ? "Nueva tarjeta" : "Editar"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={cardDialog.items} onChange={(e) => setCardDialog((d) => ({ ...d, items: e.target.value }))} placeholder="Descripción" />
            <div className="grid grid-cols-2 gap-3"><Input value={cardDialog.assignee} onChange={(e) => setCardDialog((d) => ({ ...d, assignee: e.target.value }))} placeholder="Responsable" /><Input type="number" value={cardDialog.quantity} onChange={(e) => setCardDialog((d) => ({ ...d, quantity: Number(e.target.value) }))} /></div>
            <Input type="date" value={cardDialog.dueDate} onChange={(e) => setCardDialog((d) => ({ ...d, dueDate: e.target.value }))} />
          </div>
          <DialogFooter><Button onClick={saveCard}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}