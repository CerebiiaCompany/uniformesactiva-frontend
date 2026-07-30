import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrders } from "@/hooks/useOrders";
import { useKanbanEtapas } from "@/hooks/useKanbanEtapas";
import { type ProductionOrder } from "@/data/mockData";
import { User, Calendar, Package, ArrowLeft, ChevronRight, History, Clock, X, Plus, Pencil, Trash2, GripVertical, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveFactoryCardInfo, groupOrderItemsForFactory } from "@/lib/order-fields";
import { FactoryVariantBreakdown } from "@/components/FactoryVariantBreakdown";
import { useToast } from "@/hooks/use-toast";

/** Paleta elegante y sin repeticiones (pastel suave, no saturado) */
type StageTheme = { id: string; bar: string; header: string; column: string };

const STAGE_THEMES_BY_KEY: Record<string, StageTheme> = {
  design: {
    id: "design",
    bar: "bg-[#9EB6C8]",
    header: "bg-[#F4F7F9]",
    column: "bg-[#F7F9FB]",
  },
  cutting: {
    id: "cutting",
    bar: "bg-[#D4B59A]",
    header: "bg-[#FAF6F2]",
    column: "bg-[#FBF8F5]",
  },
  sewing: {
    id: "sewing",
    bar: "bg-[#A8BFA3]",
    header: "bg-[#F4F7F3]",
    column: "bg-[#F7FAF6]",
  },
  embroidery: {
    id: "embroidery",
    bar: "bg-[#B7A8C9]",
    header: "bg-[#F6F4F9]",
    column: "bg-[#F9F7FB]",
  },
  quality: {
    id: "quality",
    bar: "bg-[#8FBFB5]",
    header: "bg-[#F2F8F6]",
    column: "bg-[#F5FAF8]",
  },
  printing: {
    id: "printing",
    bar: "bg-[#C9A8A8]",
    header: "bg-[#F9F4F4]",
    column: "bg-[#FBF7F7]",
  },
  dispatch: {
    id: "dispatch",
    bar: "bg-[#A8B0B8]",
    header: "bg-[#F5F6F7]",
    column: "bg-[#F8F9FA]",
  },
};

/** Temas extras para tableros personalizados (todos distintos entre sí) */
const CUSTOM_STAGE_THEMES: StageTheme[] = [
  { id: "dusty-rose", bar: "bg-[#C9A4B0]", header: "bg-[#F9F4F6]", column: "bg-[#FBF8F9]" },
  { id: "soft-sand", bar: "bg-[#C9C0A4]", header: "bg-[#F9F8F3]", column: "bg-[#FBFAF7]" },
  { id: "periwinkle", bar: "bg-[#A4AEC9]", header: "bg-[#F4F5F9]", column: "bg-[#F7F8FB]" },
  { id: "seafoam", bar: "bg-[#A4C9BE]", header: "bg-[#F4F9F7]", column: "bg-[#F7FBFA]" },
  { id: "apricot", bar: "bg-[#D4B4A0]", header: "bg-[#FAF6F3]", column: "bg-[#FBF8F6]" },
  { id: "mist-lilac", bar: "bg-[#B8A4C9]", header: "bg-[#F7F4F9]", column: "bg-[#F9F7FB]" },
  { id: "sage-mist", bar: "bg-[#A4C9A8]", header: "bg-[#F4F9F5]", column: "bg-[#F7FBF8]" },
  { id: "slate-mist", bar: "bg-[#A8B4C0]", header: "bg-[#F5F7F9]", column: "bg-[#F8F9FB]" },
];

function resolveStageTheme(stage: Pick<Stage, "key" | "colorClass">, index: number): StageTheme {
  if (STAGE_THEMES_BY_KEY[stage.key]) return STAGE_THEMES_BY_KEY[stage.key];
  const byStoredId = CUSTOM_STAGE_THEMES.find((t) => t.id === stage.colorClass);
  if (byStoredId) return byStoredId;
  return CUSTOM_STAGE_THEMES[index % CUSTOM_STAGE_THEMES.length];
}

interface Stage {
  id: string;
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
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  if (days > 0) return `${days}d ${remainHours}h`;
  if (hours > 0) return `${hours}h`;
  const minutes = Math.max(1, Math.floor(ms / 60000));
  return `${minutes}m`;
}

interface ProductionTimelineEntry {
  stage: string;
  label: string;
  startedAt: string;
  endedAt: string | null;
  duration: string;
  isCurrent: boolean;
}

function buildProductionTimeline(
  points: { stage: string; enteredAt: string }[],
  stageLabels: Record<string, string>
): ProductionTimelineEntry[] {
  if (!points.length) return [];
  return points.map((point, index, arr) => {
    const next = arr[index + 1];
    const isCurrent = index === arr.length - 1;
    return {
      stage: point.stage,
      label: stageLabels[point.stage] || point.stage,
      startedAt: point.enteredAt,
      endedAt: next?.enteredAt ?? null,
      duration: next ? calcDuration(point.enteredAt, next.enteredAt) : "En curso",
      isCurrent,
    };
  });
}

export default function Production() {
  const { toast } = useToast();
  const { orders: rawOrders, fetchOrders, updateOrderStage, fetchEtapaLogs } = useOrders();
  const {
    etapas,
    loading: loadingEtapas,
    fetchEtapas,
    createEtapa,
    updateEtapa,
    deleteEtapa,
    reorderEtapas,
  } = useKanbanEtapas();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [prodOrders, setProdOrders] = useState<ProductionOrder[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [savingBoard, setSavingBoard] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClosing, setHistoryClosing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [timeline, setTimeline] = useState<ProductionTimelineEntry[]>([]);
  const [editingColKey, setEditingColKey] = useState<string | null>(null);
  const [editingColLabel, setEditingColLabel] = useState("");
  const [dragType, setDragType] = useState<"card" | "column" | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
  const [cardDialog, setCardDialog] = useState<{
    open: boolean; mode: "add" | "edit"; stageKey?: string; cardId?: string;
    items: string; assignee: string; quantity: number; dueDate: string;
  }>({ open: false, mode: "add", items: "", assignee: "", quantity: 0, dueDate: "" });

  // Cargar órdenes reales en producción + columnas Kanban desde BD
  useEffect(() => {
    fetchOrders({ estado: "in_production" });
    fetchEtapas();
  }, []);

  useEffect(() => {
    if (!etapas.length) return;
    setStages(
      etapas.map((e) => ({
        id: e.id,
        key: e.key,
        label: e.label,
        colorClass: e.color_class || "border-t-primary",
      }))
    );
  }, [etapas]);
  // Mapeo de datos reales al tipo de la UI
  useEffect(() => {
    if (rawOrders && rawOrders.length > 0) {
      const now = Date.now();
      const transformed = rawOrders.map(o => {
        const factory = resolveFactoryCardInfo(o);
        const variants = groupOrderItemsForFactory(o.items || [], {
          fallbackColor: o.color,
        });
        const stage = (o.etapa_produccion || "design") as ProductionOrder["stage"];
        const history = (o.etapa_historial || []).map((h) => ({
          stage: (h.etapa || "design") as ProductionOrder["stage"],
          enteredAt: h.entered_at || o.fecha_creacion,
        }));
        const stageHistory =
          history.length > 0
            ? history
            : [{ stage, enteredAt: o.fecha_creacion }];
        const lastEntered = stageHistory[stageHistory.length - 1]?.enteredAt || o.fecha_creacion;
        const daysInStage = Math.max(
          0,
          Math.floor((now - new Date(lastEntered).getTime()) / 86400000)
        );
        const due = o.fecha_estimada_entrega ? new Date(o.fecha_estimada_entrega).getTime() : null;
        const isDelayed = due != null ? due < now : daysInStage >= 7;

        return {
          id: `PO-${o.id}`,
          orderId: o.id,
          customerName: o.cliente_nombre,
          items: o.items.map(i => i.subproducto_nombre).join(", "),
          quantity: o.items.reduce((s, i) => s + i.cantidad, 0),
          stage,
          assignee: o.tomado_por_nombre || "Sin asignar",
          dueDate: o.fecha_estimada_entrega?.slice(0, 10) ?? "",
          daysInStage,
          isDelayed,
          stageHistory,
          color: factory.color,
          hasBordado: factory.hasBordado,
          bordadoLabel: factory.bordadoLabel,
          tipoBordado: factory.tipoBordado,
          variants,
        };
      });
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
  const handleCardDrop = async (targetStage: string) => {
    if (dragType !== "card" || !draggedCardId) return;
    const card = prodOrders.find((o) => o.id === draggedCardId);
    const previousStage = card?.stage;
    const orderId = card?.orderId;
    const now = new Date().toISOString();

    setProdOrders((prev) =>
      prev.map((o) =>
        o.id !== draggedCardId
          ? o
          : {
              ...o,
              stage: targetStage as ProductionOrder["stage"],
              daysInStage: 0,
              stageHistory: [
                ...o.stageHistory,
                { stage: targetStage as ProductionOrder["stage"], enteredAt: now },
              ],
            }
      )
    );
    setDraggedCardId(null);
    setDragType(null);

    if (!orderId || previousStage === targetStage) return;

    const result = await updateOrderStage(orderId, targetStage);
    if (!result.order) {
      // Revertir UI si falla el backend
      setProdOrders((prev) =>
        prev.map((o) =>
          o.orderId !== orderId
            ? o
            : {
                ...o,
                stage: (previousStage || "design") as ProductionOrder["stage"],
              }
        )
      );
      await fetchOrders({ estado: "in_production" });
    } else if (historyOpen && orderId === selectedOrderId) {
      // Refrescar panel si está abierto sobre el mismo pedido
      const hist = (result.order.etapa_historial || []).map((h) => ({
        stage: h.etapa,
        enteredAt: h.entered_at,
      }));
      if (hist.length) {
        setTimeline(buildProductionTimeline(hist, stageLabels));
      }
    }
  };

  const handleColDragStart = (e: React.DragEvent, key: string) => { setDragType("column"); setDraggedColKey(key); e.dataTransfer.effectAllowed = "move"; };
  const handleColDropOnCol = async (targetKey: string) => {
    if (dragType !== "column" || !draggedColKey || draggedColKey === targetKey) {
      setDraggedColKey(null);
      setDragType(null);
      return;
    }
    const prevStages = stages;
    const fromIdx = prevStages.findIndex((s) => s.key === draggedColKey);
    const toIdx = prevStages.findIndex((s) => s.key === targetKey);
    if (fromIdx < 0 || toIdx < 0) {
      setDraggedColKey(null);
      setDragType(null);
      return;
    }
    const next = [...prevStages];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setStages(next);
    setDraggedColKey(null);
    setDragType(null);

    const result = await reorderEtapas(next.map((s, i) => ({ id: s.id, orden: i })));
    if (!result.ok) {
      setStages(prevStages);
      toast({
        title: "No se pudo reordenar",
        description: result.errorMessage || undefined,
        variant: "destructive",
      });
      await fetchEtapas();
    }
  };

  const startEditCol = (s: Stage) => { setEditingColKey(s.key); setEditingColLabel(s.label); };
  const commitEditCol = async () => {
    if (!editingColKey) return;
    const label = editingColLabel.trim();
    if (!label) { setEditingColKey(null); return; }
    const stage = stages.find((s) => s.key === editingColKey);
    if (!stage) { setEditingColKey(null); return; }
    if (stage.label === label) { setEditingColKey(null); return; }

    const prevLabel = stage.label;
    setStages((prev) => prev.map((s) => s.key === editingColKey ? { ...s, label } : s));
    setEditingColKey(null);

    const result = await updateEtapa(stage.id, { label });
    if (!result.etapa) {
      setStages((prev) => prev.map((s) => s.key === editingColKey ? { ...s, label: prevLabel } : s));
      toast({
        title: "No se pudo renombrar",
        description: result.errorMessage || undefined,
        variant: "destructive",
      });
      await fetchEtapas();
    }
  };
  const deleteCol = async (key: string) => {
    if (stages.length <= 1) return;
    const stage = stages.find((s) => s.key === key);
    if (!stage) return;
    const fallback = stages.find((s) => s.key !== key)!;
    const prevStages = stages;
    const prevOrders = prodOrders;

    setProdOrders((prev) => prev.map((o) => o.stage === key ? { ...o, stage: fallback.key as ProductionOrder["stage"] } : o));
    setStages((prev) => prev.filter((s) => s.key !== key));

    const result = await deleteEtapa(stage.id);
    if (!result.ok) {
      setStages(prevStages);
      setProdOrders(prevOrders);
      toast({
        title: "No se pudo eliminar",
        description: result.errorMessage || undefined,
        variant: "destructive",
      });
      await fetchEtapas();
      return;
    }
    await fetchOrders({ estado: "in_production" });
  };
  const addCol = async () => {
    if (savingBoard) return;
    setSavingBoard(true);
    // Elegir un tema custom que no esté ya usado en el tablero
    const used = new Set(stages.map((s) => s.colorClass));
    const nextTheme =
      CUSTOM_STAGE_THEMES.find((t) => !used.has(t.id)) ||
      CUSTOM_STAGE_THEMES[stages.length % CUSTOM_STAGE_THEMES.length];
    const result = await createEtapa({
      label: "Nueva etapa",
      color_class: nextTheme.id,
    });
    setSavingBoard(false);
    if (!result.etapa) {
      toast({
        title: "No se pudo crear el tablero",
        description: result.errorMessage || undefined,
        variant: "destructive",
      });
      return;
    }
    setEditingColKey(result.etapa.key);
    setEditingColLabel(result.etapa.label);
  };

  const openAddCard = (stageKey: string) => setCardDialog({ open: true, mode: "add", stageKey, items: "", assignee: "", quantity: 1, dueDate: selectedOrder?.fecha_estimada_entrega?.slice(0, 10) ?? "" });
  const openEditCard = (card: ProductionOrder) => setCardDialog({ open: true, mode: "edit", cardId: card.id, stageKey: card.stage, items: card.items, assignee: card.assignee, quantity: card.quantity, dueDate: card.dueDate });
  const saveCard = () => {
    const { mode, cardId, stageKey, items, assignee, quantity, dueDate } = cardDialog;
    if (!items.trim()) return;
    if (mode === "add" && stageKey && selectedOrderId && selectedOrder) {
      const factory = resolveFactoryCardInfo(selectedOrder);
      const variants = groupOrderItemsForFactory(selectedOrder.items || [], {
        fallbackColor: selectedOrder.color,
      });
      setProdOrders((prev) => [...prev, {
        id: `PO-${Date.now()}`,
        orderId: selectedOrderId,
        customerName: selectedOrder.cliente_nombre,
        items,
        assignee,
        quantity,
        dueDate,
        stage: stageKey as ProductionOrder["stage"],
        daysInStage: 0,
        isDelayed: false,
        stageHistory: [{ stage: stageKey as ProductionOrder["stage"], enteredAt: new Date().toISOString() }],
        color: factory.color,
        hasBordado: factory.hasBordado,
        bordadoLabel: factory.bordadoLabel,
        tipoBordado: factory.tipoBordado,
        variants,
      }]);
    } else if (mode === "edit" && cardId) {
      setProdOrders((prev) => prev.map((o) => o.id === cardId ? { ...o, items, assignee, quantity, dueDate } : o));
    }
    setCardDialog((d) => ({ ...d, open: false }));
  };
  const deleteCard = (id: string) => setProdOrders((prev) => prev.filter((o) => o.id !== id));
  const closeHistory = () => {
    setHistoryClosing(true);
    setTimeout(() => {
      setHistoryOpen(false);
      setHistoryClosing(false);
    }, 400);
  };

  const openHistory = async () => {
    if (!selectedOrderId || !selectedOrder) return;
    setHistoryOpen(true);
    setHistoryClosing(false);
    setHistoryLoading(true);
    try {
      const logs = await fetchEtapaLogs(selectedOrderId);
      const sortedLogs = [...logs]
        .filter((l) => l.etapa_nueva)
        .sort(
          (a, b) =>
            new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
        );

      // Reconstruye la ruta completa: incluye etapa_anterior del primer log
      // (p. ej. Diseño → Corte) para que Diseño cuente como etapa.
      const fromApi: { stage: string; enteredAt: string }[] = [];
      const fallbackStart =
        selectedOrder.fecha_creacion || new Date().toISOString();

      sortedLogs.forEach((log, index) => {
        const anterior = (log.etapa_anterior || "").trim();
        if (index === 0 && anterior && anterior !== log.etapa_nueva) {
          const alreadyHasAnterior = fromApi.some((p) => p.stage === anterior);
          if (!alreadyHasAnterior) {
            fromApi.push({ stage: anterior, enteredAt: fallbackStart });
          }
        }
        const last = fromApi[fromApi.length - 1];
        if (!last || last.stage !== log.etapa_nueva) {
          fromApi.push({
            stage: log.etapa_nueva,
            enteredAt: log.fecha_hora,
          });
        }
      });

      const fromOrder =
        (selectedOrder.etapa_historial || [])
          .filter((h) => h.etapa && h.entered_at)
          .map((h) => ({
            stage: h.etapa,
            enteredAt: h.entered_at,
          }))
          .sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime());

      const card = filteredProdOrders[0];
      const fromCard =
        card?.stageHistory
          ?.filter((h) => h.stage && h.enteredAt)
          .map((h) => ({ stage: h.stage, enteredAt: h.enteredAt })) ?? [];

      let points = fromApi.length > 0 ? fromApi : fromOrder.length > 0 ? fromOrder : fromCard;

      // Si no hay historial, al menos mostrar la etapa actual del pedido
      if (!points.length) {
        const stage =
          selectedOrder.etapa_produccion ||
          card?.stage ||
          stages[0]?.key ||
          "design";
        points = [
          {
            stage,
            enteredAt: selectedOrder.fecha_creacion || new Date().toISOString(),
          },
        ];
      } else {
        // Si el pedido empezó en Diseño y el historial no lo trae, anteponerlo
        const firstStageKey = stages[0]?.key || "design";
        const current =
          selectedOrder.etapa_produccion ||
          card?.stage ||
          points[points.length - 1]?.stage;

        if (
          firstStageKey &&
          current &&
          current !== firstStageKey &&
          points[0]?.stage !== firstStageKey
        ) {
          points = [
            {
              stage: firstStageKey,
              enteredAt: selectedOrder.fecha_creacion || points[0].enteredAt,
            },
            ...points,
          ];
        }

        // Asegurar que la etapa actual del pedido cierre la línea de tiempo
        const last = points[points.length - 1];
        if (current && last && last.stage !== current) {
          points = [
            ...points,
            {
              stage: current,
              enteredAt: new Date().toISOString(),
            },
          ];
        }
      }

      setTimeline(buildProductionTimeline(points, stageLabels));
    } finally {
      setHistoryLoading(false);
    }
  };

  const completedStagesCount = timeline.filter((t) => !t.isCurrent).length;
  const currentStageEntry = timeline.find((t) => t.isCurrent) || timeline[timeline.length - 1];
  const currentStageLabel = currentStageEntry?.label || "—";

  if (!selectedOrderId) {
    return (
      <AppLayout title="Operativo" subtitle="Órdenes activas en planta">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {activeOrders.map((order) => {
            const factory = resolveFactoryCardInfo(order);
            return (
            <button
              key={order.id}
              onClick={() => setSelectedOrderId(order.id)}
              className="h-full text-left bg-card border border-border rounded-xl p-3.5 hover:shadow-lg hover:border-primary/30 transition-all duration-200 group flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-foreground">
                        ORD-{order.id.slice(0, 3)}
                      </span>
                      <StatusBadge status={order.estado} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {order.cliente_nombre}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
              </div>

              <div className="mb-2">
                {factory.hasBordado ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800"
                    title="Con bordado"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                    Bordado
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800"
                    title="Sin bordado"
                  >
                    <X className="h-3 w-3" strokeWidth={3} />
                    Bordado
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <FactoryVariantBreakdown
                  variants={groupOrderItemsForFactory(order.items || [], {
                    fallbackColor: order.color,
                  })}
                  compact
                />
              </div>

              {factory.hasBordado && factory.tipoBordado !== "—" && (
                <p className="mt-2 text-[10px] text-muted-foreground leading-snug">
                  Tipo bordado:{" "}
                  <span className="font-medium text-foreground">{factory.tipoBordado}</span>
                </p>
              )}
            </button>
            );
          })}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Operativo — ORD-${selectedOrderId.slice(0, 3)}`} subtitle={selectedOrder ? `${selectedOrder.cliente_nombre}` : ""}>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => setSelectedOrderId(null)} className="gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver</Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openHistory} className="gap-2">
            <History className="h-4 w-4" /> Historial
          </Button>
          <Button variant="default" size="sm" onClick={addCol} disabled={savingBoard || loadingEtapas} className="gap-2">
            {savingBoard ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Añadir tablero
          </Button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-12rem)]">
        {stages.map((stage, stageIndex) => {
          const stageOrders = getOrdersForStage(stage.key);
          const isEditing = editingColKey === stage.key;
          const isDropTarget = dragType === "card" && draggedCardId != null;
          const theme = resolveStageTheme(stage, stageIndex);
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
              <div
                className={cn(
                  "rounded-t-lg border border-border/70 border-b-0 overflow-hidden transition-shadow",
                  isDropTarget && "ring-1 ring-black/5"
                )}
              >
                {/* Barrita de color única y suave por etapa */}
                <div
                  className={cn("h-2 w-full shrink-0", theme.bar)}
                  aria-hidden
                />
                <div
                  className={cn(
                    "px-3 py-2.5 flex items-center justify-between gap-2 group",
                    theme.header
                  )}
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <button
                      draggable={!isEditing}
                      onDragStart={(e) => handleColDragStart(e, stage.key)}
                      className="cursor-grab text-muted-foreground hover:text-foreground shrink-0"
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
                          }}
                          onBlur={commitEditCol}
                          className="h-7 text-sm"
                        />
                        <button onMouseDown={commitEditCol} className="text-success">
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {stage.label}
                        </h3>
                        <span className="text-[10px] bg-white/90 text-muted-foreground rounded-full px-2 py-0.5 border border-border/50">
                          {stageOrders.length}
                        </span>
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditCol(stage)}
                        className="p-1 rounded hover:bg-white/70"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteCol(stage.key)}
                        className="p-1 rounded hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "flex-1 border border-t-0 border-border/70 rounded-b-lg p-2 space-y-2 min-h-[200px]",
                  theme.column
                )}
              >
                {stageOrders.map((order) => (
                  <div key={order.id} draggable onDragStart={(e) => handleCardDragStart(e, order.id)} className="bg-card rounded-lg border border-border p-3 cursor-grab hover:shadow-md transition-shadow relative group/card">
                    <div className="absolute top-2 right-2 flex opacity-0 group-hover/card:opacity-100"><button onClick={() => openEditCard(order)} className="p-1"><Pencil className="h-3 w-3" /></button><button onClick={() => deleteCard(order.id)} className="p-1"><Trash2 className="h-3 w-3" /></button></div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold pr-8">
                        ORD-{order.orderId.slice(0, 3)}
                      </span>
                    </div>
                    <p className="text-xs font-medium mb-2">{order.customerName}</p>
                    <FactoryVariantBreakdown
                      variants={order.variants || []}
                      compact
                      className="mb-2"
                    />
                    <div className="mb-3 space-y-1 rounded-md bg-muted/40 px-2 py-1.5 text-[10px] leading-snug">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Total</span>
                        <span className="font-semibold text-foreground tabular-nums">{order.quantity} uds</span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Bordado</span>
                        {order.hasBordado ? (
                          <Check className="h-3.5 w-3.5 text-green-600" strokeWidth={3} aria-label="Con bordado" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-red-600" strokeWidth={3} aria-label="Sin bordado" />
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Tipo</span>
                        <span className="font-medium text-foreground text-right">{order.tipoBordado || "—"}</span>
                      </div>
                    </div>
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

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Cerrar historial"
            className={cn(
              "absolute inset-0 bg-black/40 transition-opacity",
              historyClosing ? "opacity-0" : "opacity-100"
            )}
            onClick={closeHistory}
          />
          <aside
            className={cn(
              "relative z-10 h-full w-full max-w-md bg-background border-l border-border shadow-xl overflow-y-auto",
              "transition-transform duration-400 ease-out",
              historyClosing ? "translate-x-full" : "translate-x-0 animate-in slide-in-from-right"
            )}
          >
            <div className="sticky top-0 z-10 bg-background border-b border-border px-5 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-destructive shrink-0" />
                  <h2 className="text-base font-bold text-foreground">Historial de producción</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  ORD-{selectedOrderId.slice(0, 3)}
                  {selectedOrder?.cliente_nombre ? ` · ${selectedOrder.cliente_nombre}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeHistory}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Cargando historial...</p>
                </div>
              ) : timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Aún no hay movimientos de etapa para este pedido.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/50 px-4 py-3">
                      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Etapas completadas
                      </p>
                      <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
                        {completedStagesCount}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-4 py-3">
                      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Etapa actual
                      </p>
                      <p className="text-lg font-bold text-destructive mt-1 truncate">
                        {currentStageLabel}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold tracking-wide text-foreground uppercase mb-3">
                      Tiempo por etapa
                    </h3>
                    <div className="space-y-2">
                      {timeline.map((entry) => (
                        <div
                          key={`${entry.stage}-${entry.startedAt}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                        >
                          <span className="text-sm font-medium text-foreground truncate">
                            {entry.label}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs font-medium shrink-0",
                              entry.isCurrent ? "text-destructive" : "text-muted-foreground"
                            )}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            {entry.duration}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold tracking-wide text-foreground uppercase mb-4">
                      Línea de tiempo
                    </h3>
                    <div className="relative space-y-0">
                      {timeline.map((entry, index) => {
                        const isLast = index === timeline.length - 1;
                        return (
                          <div key={`tl-${entry.stage}-${entry.startedAt}`} className="relative flex gap-3 pb-6 last:pb-0">
                            {!isLast && (
                              <span className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
                            )}
                            <span
                              className={cn(
                                "relative z-10 mt-1 h-4 w-4 rounded-full border-2 shrink-0",
                                entry.isCurrent
                                  ? "border-destructive bg-destructive"
                                  : "border-muted-foreground/40 bg-background"
                              )}
                            />
                            <div className="min-w-0 flex-1 -mt-0.5">
                              <p className="text-sm font-semibold text-foreground">{entry.label}</p>
                              <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                                <p>Hora de inicio: {formatDateTime(entry.startedAt)}</p>
                                {entry.endedAt && (
                                  <p>Hora de fin: {formatDateTime(entry.endedAt)}</p>
                                )}
                                <p
                                  className={cn(
                                    entry.isCurrent && "text-destructive font-medium"
                                  )}
                                >
                                  Duración: {entry.isCurrent ? "· En curso" : entry.duration}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </AppLayout>
  );
}