import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrders } from "@/hooks/useOrders";
import { useKanbanEtapas } from "@/hooks/useKanbanEtapas";
import { type ProductionOrder } from "@/data/mockData";
import { User, Calendar, Package, ArrowLeft, ChevronRight, History, Clock, X, Plus, Pencil, Trash2, GripVertical, Check, Loader2, Boxes, Scissors, DollarSign, Factory, ImagePlus, Paperclip, FileText, UserPlus, MessageSquare, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveFactoryCardInfo, groupOrderItemsForFactory } from "@/lib/order-fields";
import { FactoryVariantBreakdown } from "@/components/FactoryVariantBreakdown";
import { KanbanStageChip } from "@/components/KanbanStageChip";
import { KanbanCardEditDialog, cardFormFromProductionOrder, type KanbanCardFormValues } from "@/components/KanbanCardEditDialog";
import { KanbanNovedadesDialog } from "@/components/KanbanNovedadesDialog";
import { StageLaborCostDialog } from "@/components/StageLaborCostDialog";
import { KanbanStageSummaryDialog } from "@/components/KanbanStageSummaryDialog";
import { useToast } from "@/hooks/use-toast";
import { http } from "@/lib/http";
import {
  prepareCardsWithLedger,
  computeRealCostFromCards,
  computeFullRealCostFromOrder,
  freezeStageCostsOnMove,
  freezeWorkingCostsForNextAssignee,
  normalizeRealCostBreakdown,
  notifyOrderRealCostUpdated,
  cardHasKanbanMaterialRequests,
  reconcileOrphanLiveMaterials,
  cardHasAssigneeForStage,
} from "@/lib/order-real-cost";
import {
  notifyKanbanEtapasUpdated,
  readProductionSession,
  mergeProductionUserFromApi,
  getSessionCapaActionsMap,
  applyKanbanCapaPermissionsFromApi,
  capaHasAction,
  canMoveCardToStage,
  canProductionUserActOnStage,
  canProductionUserOperateCard,
  cardAssignedToOperatorOnAllowedStage,
  getNextStageKey,
  parseStageKeys,
} from "@/lib/production-capa-permissions";
import { endpoints } from "@/lib/api-endpoints";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  KANBAN_STAGE_THEMES_BY_KEY,
  type KanbanStageTheme,
} from "@/lib/kanban-stage-theme";

/** Paleta elegante y sin repeticiones (pastel suave, no saturado) — compartida con costo real */
type StageTheme = Pick<KanbanStageTheme, "id" | "bar" | "header" | "column">;

const STAGE_THEMES_BY_KEY: Record<string, StageTheme> = Object.fromEntries(
  Object.entries(KANBAN_STAGE_THEMES_BY_KEY).map(([key, t]) => [
    key,
    { id: t.id, bar: t.bar, header: t.header, column: t.column },
  ])
);

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

function isStageRequiredForCard(stageKey: string, card: ProductionOrder | null): boolean {
  if (!card) return true;
  const k = stageKey.toLowerCase();

  // Bordado
  if (k === "embroidery" || k === "bordado" || k.includes("bordado")) {
    if (card.hasBordado === false) return false;
    if (card.tipoBordado === "—" && !card.hasBordado) return false;
  }

  // Estampado
  if (k === "printing" || k === "estampado" || k.includes("estampado")) {
    if ((card as any).hasEstampado === false) return false;
    const est = ((card as any).estampado || "").trim().toLowerCase();
    if (!est || est === "—" || est === "sin" || est.includes("sin estampado") || est.includes("sin estampa")) return false;
  }

  return true;
}

function resolveValidStageForCard(
  targetStage: string,
  card: ProductionOrder | null,
  allStages: { key: string }[]
): string {
  if (!targetStage || !card) return targetStage || "design";
  if (isStageRequiredForCard(targetStage, card)) return targetStage;

  // Si la etapa actual no es requerida (ej. Bordado cuando no lleva bordado),
  // buscar la siguiente etapa en allStages que SÍ sea requerida.
  const currentIndex = allStages.findIndex((s) => s.key === targetStage);
  if (currentIndex >= 0) {
    for (let i = currentIndex + 1; i < allStages.length; i++) {
      if (isStageRequiredForCard(allStages[i].key, card)) {
        return allStages[i].key;
      }
    }
  }

  // Fallback: primera etapa requerida
  const firstReq = allStages.find((s) => isStageRequiredForCard(s.key, card));
  return firstReq ? firstReq.key : targetStage;
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

const MOLD_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  listo: "Listo",
  aprobado: "Aprobado",
};

function formatMoneyCop(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCardLaborInfoForStage(card: ProductionOrder, stageKey: string) {
  const isCurrentStage = card.stage === stageKey;
  const stageConfig = card.stageLaborConfig?.[stageKey];

  let unitLabor = 0;
  let liveLaborTotal = 0;

  if (stageConfig && stageConfig.enabled && stageConfig.perUnit != null && Number(stageConfig.perUnit) > 0) {
    unitLabor = Number(stageConfig.perUnit);
    liveLaborTotal = (Number(card.quantity) || 0) * unitLabor;
  }

  // 1. Entradas en costLedger para esta etapa/capa con categoría "labor"
  const ledgerLaborEntries = (card.costLedger || []).filter(
    (e) =>
      e.stage === stageKey &&
      (e.category === "labor" || (e.actorKind === "satellite" && e.category === "labor"))
  );
  const ledgerLaborTotal = ledgerLaborEntries.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );

  // 2. Costo de satélite / taller si aplica
  const satEntries = (card.costLedger || []).filter(
    (e) => e.stage === stageKey && e.category === "satellite"
  );
  const ledgerSatTotal = satEntries.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );
  const liveSatTotal =
    isCurrentStage && card.satelliteCost != null && Number(card.satelliteCost) > 0
      ? Number(card.satelliteCost)
      : 0;

  // Para la capa actual activa, la mano de obra depende exclusivamente de si se configuró valor para esta capa
  const totalLabor = isCurrentStage
    ? liveLaborTotal
    : (liveLaborTotal > 0 ? liveLaborTotal : ledgerLaborTotal);

  const satelliteTotal = isCurrentStage
    ? (liveSatTotal > 0 ? liveSatTotal : (stageConfig?.enabled ? liveLaborTotal : 0))
    : ledgerSatTotal;

  const finalUnitLabor =
    unitLabor > 0
      ? unitLabor
      : totalLabor > 0 && Number(card.quantity) > 0
        ? totalLabor / Number(card.quantity)
        : 0;

  return {
    totalLabor,
    unitLabor: finalUnitLabor,
    satelliteTotal,
    hasLabor: totalLabor > 0,
    hasSatellite: satelliteTotal > 0,
    hasCost: totalLabor > 0 || satelliteTotal > 0,
  };
}

export default function Production() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightHandledRef = useRef<string | null>(null);
  const { orders: rawOrders, loading: ordersLoading, fetchOrders, updateOrderStage, fetchEtapaLogs, updateKanbanAssignment, updateKanbanTarjetas } = useOrders();
  const [productionListReady, setProductionListReady] = useState(false);
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
  const [savingCard, setSavingCard] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClosing, setHistoryClosing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [timeline, setTimeline] = useState<ProductionTimelineEntry[]>([]);
  const [editingColKey, setEditingColKey] = useState<string | null>(null);
  const [editingColLabel, setEditingColLabel] = useState("");
  const [dragType, setDragType] = useState<"card" | "column" | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
  const [pendingCardMove, setPendingCardMove] = useState<{
    cardId: string;
    orderId: string | null;
    fromStage: string;
    toStage: string;
  } | null>(null);
  const [isMovingCard, setIsMovingCard] = useState(false);
  const [cardDialog, setCardDialog] = useState<{
    open: boolean;
    mode: "add" | "edit";
    stageKey?: string;
    cardId?: string;
    focusSection?: "materials" | null;
  }>({ open: false, mode: "add", focusSection: null });
  const [cardFormInitial, setCardFormInitial] = useState<Partial<KanbanCardFormValues> | null>(null);
  const [prodSession, setProdSession] = useState(() => readProductionSession());
  const [capaActionsMap, setCapaActionsMap] = useState(() =>
    getSessionCapaActionsMap(readProductionSession())
  );
  const [productionUsers, setProductionUsers] = useState<
    { id: string; name: string; stageKeys: string[] }[]
  >([]);
  const [satelliteUsers, setSatelliteUsers] = useState<
    { id: string; name: string; stageKeys: string[] }[]
  >([]);
  const [assignOpenFor, setAssignOpenFor] = useState<string | null>(null);
  const [novedadesCard, setNovedadesCard] = useState<ProductionOrder | null>(null);
  const [summaryStage, setSummaryStage] = useState<KanbanEtapa | null>(null);
  const [summaryTargetOrder, setSummaryTargetOrder] = useState<ProductionOrder | null>(null);
  const [laborDialog, setLaborDialog] = useState<{
    open: boolean;
    card: ProductionOrder | null;
    stageKey: string;
    stageLabel: string;
  }>({ open: false, card: null, stageKey: "", stageLabel: "" });

  const [assignModal, setAssignModal] = useState<{
    open: boolean;
    card: ProductionOrder | null;
    selectedStages: string[];
    assigneeType: "production" | "satellite";
    selectedUserId: string;
  }>({
    open: false,
    card: null,
    selectedStages: [],
    assigneeType: "production",
    selectedUserId: "",
  });

  const openAssignModal = (card: ProductionOrder, currentStageKey: string) => {
    const initialType = card.satelliteAssigneeId ? "satellite" : "production";
    const initialUserId = card.satelliteAssigneeId || card.assigneeId || "";

    setAssignModal({
      open: true,
      card,
      selectedStages: [currentStageKey],
      assigneeType: initialType,
      selectedUserId: initialUserId,
    });
  };

  const assignCardToMultipleStages = async (
    card: ProductionOrder,
    targetStages: string[],
    userId: string,
    userName: string,
    kind: "production" | "satellite"
  ) => {
    if (!card || !card.orderId || targetStages.length === 0 || !userId) return;

    setSavingCard(true);
    try {
      let stageAssignees = { ...(card.stageAssignees || {}) };

      for (const sKey of targetStages) {
        const otherKindKey = kind === "production" ? `${sKey}__satellite` : sKey;
        delete stageAssignees[otherKindKey];

        const assignKey = kind === "satellite" ? `${sKey}__satellite` : sKey;
        stageAssignees[assignKey] = {
          userId,
          name: userName,
          kind,
        };

        await updateKanbanAssignment(card.orderId, {
          card_id: card.id,
          stage: sKey,
          assignee_id: userId,
          assignee_name: userName,
          kind,
        });
      }

      // Persistir stageAssignees completo en el backend
      try {
        await http(endpoints.orders.kanbanAsignacion(card.orderId), {
          method: "PATCH",
          body: JSON.stringify({
            kanban_asignaciones: {
              [card.id]: {
                stage: card.stage,
                ...(kind === "satellite"
                  ? { satelliteAssigneeId: userId, satelliteAssignee: userName, assigneeId: null, assignee: "Sin asignar" }
                  : { assigneeId: userId, assignee: userName, satelliteAssigneeId: null, satelliteAssignee: "Sin asignar" }),
                stageAssignees,
              },
            },
          }),
        });
      } catch {
        /* fallback silent */
      }

      const isCurrentStageIncluded = targetStages.includes(card.stage);

      const patch: Partial<ProductionOrder> = {
        stageAssignees,
        ...(isCurrentStageIncluded
          ? kind === "satellite"
            ? {
                assigneeId: null,
                assignee: "Sin asignar",
                satelliteAssigneeId: userId,
                satelliteAssignee: userName,
              }
            : {
                assigneeId: userId,
                assignee: userName,
                satelliteAssigneeId: null,
                satelliteAssignee: "Sin asignar",
              }
          : {}),
      };

      commitOrderCards(card.orderId, (cards) =>
        cards.map((c) => (c.id === card.id ? { ...c, ...patch } : c))
      );

      toast({
        title: "Asignación multicapa exitosa",
        description: `Se asignó a ${userName} (${kind === "satellite" ? "Satélite" : "Producción"}) en ${targetStages.length} capa(s).`,
      });

      setAssignModal({ open: false, card: null, selectedStages: [], assigneeType: "production", selectedUserId: "" });
      fetchOrders();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error en asignación",
        description: err?.message || "No se pudo realizar la asignación",
      });
    } finally {
      setSavingCard(false);
    }
  };

  const openLaborCostModal = (card: ProductionOrder, stageKey: string) => {
    if (!canManageBoard && !canProductionUserOperateCard(prodSession, card)) {
      toast({
        variant: "destructive",
        title: "Sin asignación",
        description:
          "Solo puedes registrar mano de obra cuando el administrador te asignó esta tarjeta en esta capa.",
      });
      return;
    }
    const label = stages.find((s) => s.key === stageKey)?.label || stageKey;
    setLaborDialog({
      open: true,
      card,
      stageKey,
      stageLabel: label,
    });
  };

  const saveLaborCostForStage = (data: { enabled: boolean; perUnit: number | null }) => {
    if (!laborDialog.card || !laborDialog.stageKey) return;
    const { card, stageKey } = laborDialog;

    if (!canManageBoard && !canProductionUserOperateCard(prodSession, card)) {
      toast({
        variant: "destructive",
        title: "Sin asignación",
        description: "No puedes modificar mano de obra sin estar asignado a esta capa.",
      });
      return;
    }

    let stageAssignees = { ...(card.stageAssignees || {}) };
    const hasExistingAssign =
      stageAssignees[stageKey] ||
      stageAssignees[`${stageKey}__satellite`] ||
      stageAssignees[`${stageKey}__production`];

    if (!hasExistingAssign) {
      if (card.satelliteAssigneeId && card.satelliteAssignee && card.satelliteAssignee !== "Sin asignar") {
        stageAssignees[`${stageKey}__satellite`] = {
          userId: card.satelliteAssigneeId,
          name: card.satelliteAssignee,
          kind: "satellite",
        };
      } else if (card.assigneeId && card.assignee && card.assignee !== "Sin asignar") {
        stageAssignees[stageKey] = {
          userId: card.assigneeId,
          name: card.assignee,
          kind: "production",
        };
      }
    }

    const stageLaborConfig = {
      ...(card.stageLaborConfig || {}),
      [stageKey]: {
        enabled: data.enabled,
        perUnit: data.enabled && data.perUnit != null ? data.perUnit : null,
      },
    };

    const isCurrentStage = card.stage === stageKey;
    const patch: Partial<ProductionOrder> = {
      stageLaborConfig,
      stageAssignees,
      ...(isCurrentStage
        ? {
            laborCostEnabled: data.enabled,
            laborCostPerUnit: data.enabled && data.perUnit != null ? data.perUnit : null,
          }
        : {}),
    };

    if (card.orderId) {
      commitOrderCards(card.orderId, (cards) =>
        cards.map((c) => (c.id === card.id ? { ...c, ...patch } : c))
      );
    } else {
      setProdOrders((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, ...patch } : c))
      );
    }

    toast({
      title: "Mano de obra guardada",
      description: `Tarifa actualizada para la capa ${laborDialog.stageLabel}.`,
    });
  };

  const handleMarkCardTerminado = async (
    order: ProductionOrder,
    stageKey: string,
    targetStageOverride?: string
  ) => {
    try {
      const stageKeyCompleted = stageKey || order.stage || "current";

      if (!cardHasAssigneeForStage(order, stageKeyCompleted)) {
        toast({
          variant: "destructive",
          title: "Asignación requerida",
          description:
            "Debes asignar a alguien en esta fase antes de terminar o mover la tarjeta. Sin responsable no se guarda el costo real de la orden.",
        });
        if (canManageBoard) {
          openAssignModal(order, stageKeyCompleted);
        }
        return;
      }

      // Asegurar stageAssignees con el responsable vivo (atribuir costo real al congelar)
      let workingOrder = order;
      const hasStageAssignRecord =
        order.stageAssignees?.[stageKeyCompleted] ||
        order.stageAssignees?.[`${stageKeyCompleted}__satellite`] ||
        order.stageAssignees?.[`${stageKeyCompleted}__production`];
      if (!hasStageAssignRecord) {
        const nextStageAssignees = { ...(order.stageAssignees || {}) };
        if (order.satelliteAssigneeId && order.satelliteAssignee && order.satelliteAssignee !== "Sin asignar") {
          nextStageAssignees[`${stageKeyCompleted}__satellite`] = {
            userId: order.satelliteAssigneeId,
            name: order.satelliteAssignee,
            kind: "satellite" as const,
          };
        } else if (order.assigneeId && order.assignee && order.assignee !== "Sin asignar") {
          nextStageAssignees[stageKeyCompleted] = {
            userId: order.assigneeId,
            name: order.assignee,
            kind: "production" as const,
          };
        }
        workingOrder = { ...order, stageAssignees: nextStageAssignees };
      }

      const stageLabor = getCardLaborInfoForStage(workingOrder, stageKey);
      let amount = stageLabor.totalLabor || stageLabor.satelliteTotal || Number(workingOrder.satelliteCost || 0);

      if (amount <= 0 && workingOrder.laborCostPerUnit && workingOrder.quantity) {
        amount = Number(workingOrder.laborCostPerUnit) * Number(workingOrder.quantity);
      }
      if (amount <= 0 && workingOrder.laborCost) {
        amount = Number(workingOrder.laborCost);
      }

      const stageAssign =
        workingOrder.stageAssignees?.[stageKeyCompleted] ||
        workingOrder.stageAssignees?.[`${stageKeyCompleted}__satellite`] ||
        workingOrder.stageAssignees?.[`${stageKeyCompleted}__production`];

      const isSatKind = stageAssign?.kind === "satellite" || Boolean(workingOrder.satelliteAssigneeId) || (Boolean(workingOrder.satelliteName) && !workingOrder.assigneeId);
      const prodUserId = (!isSatKind && stageAssign?.userId) || workingOrder.assigneeId || (prodSession.isProduction ? prodSession.userId : null);

      if (isSatKind) {
        let satelliteId = order.satelliteWorkshopId;

        if (!satelliteId) {
          try {
            const list = await http<any[]>(endpoints.satellites.list());
            const searchName = (order.satelliteName || order.satelliteAssignee || "").toLowerCase().trim();
            const targetUser = satelliteUsers.find((u) => u.id === order.satelliteAssigneeId);

            const match = list.find((s) => {
              const sName = (s.name || "").toLowerCase().trim();
              const sContact = (s.contact_name || "").toLowerCase().trim();
              if (targetUser && (s.id === targetUser.satelliteId || sName.includes(targetUser.name.toLowerCase()))) return true;
              if (searchName && (sName.includes(searchName) || searchName.includes(sName) || sContact.includes(searchName))) return true;
              return false;
            });

            if (match) satelliteId = match.id;
          } catch {
            /* ignore */
          }
        }

        if (satelliteId) {
          try {
            const ws = await http<any>(endpoints.satellites.detail(satelliteId));
            const prevSettlements = ws?.settlements || {};
            const rawOrderId = String(order.orderId || order.id || "").replace(/^PO-/, "");
            const cardId = order.id || `PO-${rawOrderId}`;
            const prevOrder = prevSettlements[rawOrderId] || prevSettlements[cardId] || {};
            const prevAmount = Number(prevOrder.amount || prevOrder.agreed_cost || 0);
            const prevStagesDone = prevOrder.stages_done || {};

            const isAlreadyAdded = Boolean(prevStagesDone[stageKeyCompleted]);
            const totalAccumAmount = isAlreadyAdded ? prevAmount : prevAmount + amount;

            const settlementPayload = {
              ...prevOrder,
              status: prevOrder.status || "pending",
              work_status: "recibido_completo",
              amount: totalAccumAmount,
              agreed_cost: totalAccumAmount,
              stages_done: {
                ...prevStagesDone,
                [stageKeyCompleted]: amount,
              },
              confirmed_at: new Date().toISOString(),
            };

            const nextSettlements = {
              ...prevSettlements,
              [rawOrderId]: settlementPayload,
              [cardId]: settlementPayload,
            };

            await http(endpoints.satellites.detail(satelliteId), {
              method: "PATCH",
              body: JSON.stringify({
                settlements: nextSettlements,
                payment_status: "pendiente",
              }),
            });
          } catch {
            /* ignore */
          }
        }
      } else if (prodUserId) {
        try {
          const userRes = await http<any>(endpoints.users.detail(prodUserId)).catch(() => null);
          const prevSettlements = userRes?.settlements || {};
          const rawOrderId = String(order.orderId || order.id || "").replace(/^PO-/, "");
          const cardId = order.id || `PO-${rawOrderId}`;
          const prevOrder = prevSettlements[rawOrderId] || prevSettlements[cardId] || {};
          const prevAmount = Number(prevOrder.amount || prevOrder.agreed_cost || 0);
          const prevStagesDone = prevOrder.stages_done || {};

          const isAlreadyAdded = Boolean(prevStagesDone[stageKeyCompleted]);
          const totalAccumAmount = isAlreadyAdded ? prevAmount : prevAmount + amount;

          const settlementPayload = {
            ...prevOrder,
            status: prevOrder.status || "pending",
            work_status: "recibido_completo",
            amount: totalAccumAmount,
            agreed_cost: totalAccumAmount,
            stages_done: {
              ...prevStagesDone,
              [stageKeyCompleted]: amount,
            },
            confirmed_at: new Date().toISOString(),
          };

          const nextSettlements = {
            ...prevSettlements,
            [rawOrderId]: settlementPayload,
            [cardId]: settlementPayload,
          };

          await http(endpoints.users.detail(prodUserId), {
            method: "PATCH",
            body: JSON.stringify({ settlements: nextSettlements }),
          }).catch(() => null);
        } catch {
          /* ignore */
        }
      }

      // Avanzar tarjeta a la siguiente etapa y desasignar
      const targetOrderId = workingOrder.orderId || (selectedOrder ? selectedOrder.id : null);
      const currentStage = stageKey || workingOrder.stage || "design";
      const visibleStages = stages.filter((s) => isStageRequiredForCard(s.key, workingOrder));
      const nextStage = targetStageOverride || getNextStageKey(visibleStages, currentStage) || currentStage;
      const prevLabel = stages.find((s) => s.key === currentStage)?.label || currentStage;
      const nextLabel = stages.find((s) => s.key === nextStage)?.label || nextStage;
      const now = new Date().toISOString();
      const frozenCosts = freezeStageCostsOnMove(workingOrder, currentStage, prevLabel);

      const movedPatch = {
        ...frozenCosts,
        stageAssignees: workingOrder.stageAssignees,
        stage: nextStage as ProductionOrder["stage"],
        daysInStage: 0,
        assignee: "Sin asignar",
        assigneeId: null as string | null,
        satelliteAssignee: "Sin asignar",
        satelliteAssigneeId: null as string | null,
        stageHistory: [
          ...(workingOrder.stageHistory || []),
          { stage: nextStage as ProductionOrder["stage"], enteredAt: now },
        ],
      };

      if (targetOrderId && workingOrder.id) {
        // 1) Persistir costos congelados + stageAssignees (auditoría de capa)
        commitOrderCards(targetOrderId, (cards) =>
          cards.map((o) => (o.id !== workingOrder.id ? o : { ...o, ...movedPatch }))
        );
        // 2) Avanzar etapa (BE exige que la capa saliente tuviera asignado)
        await updateOrderStage(targetOrderId, nextStage);
        // 3) Limpiar asignación viva de la nueva capa
        void updateKanbanAssignment(targetOrderId, {
          card_id: workingOrder.id,
          stage: nextStage,
          clear: true,
          assignee_id: null,
          kind: "both",
        });
      }

      toast({
        title: "Trabajo terminado",
        description: `Trabajo de «${prevLabel}» finalizado. El pedido avanzó a la fase de «${nextLabel}» (Sin asignar) y se sumaron ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount)} a POR PAGAR.`,
      });

      await fetchOrders();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "No se pudo marcar el trabajo como terminado",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const sync = async () => {
      try {
        const me = await http<Record<string, unknown>>(endpoints.users.me());
        if (me && typeof me === "object") {
          const session = mergeProductionUserFromApi(me);
          setProdSession(session);
          setCapaActionsMap(applyKanbanCapaPermissionsFromApi(me, session));
          return;
        }
      } catch {
        /* keep local session */
      }
      const session = readProductionSession();
      setProdSession(session);
      setCapaActionsMap(getSessionCapaActionsMap(session));
    };
    void sync();
    const onFocus = () => void sync();
    window.addEventListener("storage", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    const loadKanbanUsers = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(endpoints.users.list(), {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];

        const mapUser = (u: {
          id: string;
          first_name?: string;
          last_name?: string;
          username?: string;
          production_stage_key?: string;
          production_stage_keys?: string[];
        }) => ({
          id: String(u.id),
          name:
            `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
            u.username ||
            "Usuario",
          stageKeys: parseStageKeys(
            u.production_stage_keys?.length
              ? u.production_stage_keys
              : u.production_stage_key
          ),
        });

        const roleMatch = (roles: unknown[], needle: string) =>
          roles.some((r) => {
            const s = String(r);
            return s === needle || s.includes(needle);
          });

        const prod: typeof productionUsers = [];
        const sat: typeof satelliteUsers = [];

        for (const u of list) {
          const roles = Array.isArray(u.roles) ? u.roles : [];
          const active = !u.status || String(u.status).toLowerCase() === "active";
          if (!active) continue;
          if (roleMatch(roles, "Producción")) prod.push(mapUser(u));
          if (roleMatch(roles, "Satélite")) sat.push(mapUser(u));
        }
        setProductionUsers(prod);
        setSatelliteUsers(sat);
      } catch {
        // sin usuarios el select quedará vacío
      }
    };
    loadKanbanUsers();
  }, []);

  const userStageKeys = prodSession.stageKeys;
  const canManageBoard = prodSession.unrestricted;
  const capaAllowed = (stageKey: string, action: Parameters<typeof capaHasAction>[2]) =>
    capaHasAction(capaActionsMap, stageKey, action, userStageKeys);
  // Intersection: capas del usuario + «Ver tablero» del rol (matriz Kanban en Administración).
  const canViewBoardOnStage = (stageKey: string) => {
    if (canManageBoard) return true;
    if (!userStageKeys.length || !userStageKeys.includes(stageKey)) return false;
    return capaAllowed(stageKey, "ver_tablero");
  };
  const canEditOnStage = (stageKey: string) =>
    canManageBoard ||
    (userStageKeys.includes(stageKey) &&
      capaAllowed(stageKey, "editar_tarjeta"));
  // Satélites: siempre pueden solicitar materiales en las capas que el admin les asignó.
  // Producción: respeta «Solicitar inventario» por capa en Administración → Roles.
  const canRequestInventoryOnStage = (stageKey: string) =>
    canManageBoard ||
    (userStageKeys.includes(stageKey) &&
      (prodSession.isSatellite || capaAllowed(stageKey, "solicitar_inventario")));
  const userCanViewHistory =
    canManageBoard ||
    userStageKeys.some((k) => capaAllowed(k, "ver_historial"));
  const canViewStageSummary =
    prodSession.isAdmin ||
    prodSession.isProduction ||
    (prodSession.roles || []).some((r) => {
      const lower = r.toLowerCase().trim();
      return (
        lower === "administrador" ||
        lower === "admin" ||
        lower === "producción" ||
        lower === "produccion" ||
        lower === "inventario"
      );
    });
  const dialogStageKey = cardDialog.stageKey || "";

  // Migración única: datos viejos de localStorage → BD (luego se borran del navegador)
  useEffect(() => {
    const migrate = async () => {
      try {
        const raw = localStorage.getItem("ua:kanban-cards-v1");
        if (!raw) return;
        const store = JSON.parse(raw) as Record<string, ProductionOrder[]>;
        if (!store || typeof store !== "object") return;
        let changed = false;
        for (const order of rawOrders) {
          if (Array.isArray(order.kanban_tarjetas) && order.kanban_tarjetas.length) {
            if (store[order.id]) {
              delete store[order.id];
              changed = true;
            }
            continue;
          }
          const localCards = store[order.id];
          if (!Array.isArray(localCards) || !localCards.length) continue;
          const withLedger = prepareCardsWithLedger(localCards);
          const previousBreakdown = normalizeRealCostBreakdown(
            order.id,
            order.costo_real_desglose
          );
          const breakdown = await computeFullRealCostFromOrder(order.id, withLedger, {
            estado: "in_production",
            previousBreakdown,
          });
          const result = await updateKanbanTarjetas(order.id, withLedger, breakdown);
          if (!result.errorMessage) {
            delete store[order.id];
            changed = true;
            notifyOrderRealCostUpdated(order.id);
          }
        }
        if (changed) {
          const left = Object.keys(store).length;
          if (left === 0) {
            localStorage.removeItem("ua:kanban-cards-v1");
            localStorage.removeItem("ua:order-real-costs-v1");
          } else {
            localStorage.setItem("ua:kanban-cards-v1", JSON.stringify(store));
          }
          await fetchOrders({ estado: "in_production" });
        }
      } catch {
        // ignore migrate errors
      }
    };
    if (rawOrders.length) void migrate();
  }, [rawOrders, updateKanbanTarjetas, fetchOrders]);

  // Cargar órdenes reales en producción + columnas Kanban desde BD
  useEffect(() => {
    void (async () => {
      await fetchOrders({ estado: "in_production" });
      setProductionListReady(true);
    })();
    fetchEtapas();
  }, []);

  // Al volver al tab, refrescar etapas de pedidos (admin ve lo que movió Producción/Satélite)
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      fetchOrders({ estado: "in_production" });
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchOrders]);

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
  // Mapeo de datos reales al tipo de la UI (fusiona tarjetas Kanban persistidas)
  useEffect(() => {
    if (rawOrders && rawOrders.length > 0) {
      const now = Date.now();
      const transformed = rawOrders.flatMap((o) => {
        const factory = resolveFactoryCardInfo(o);
        const variants = groupOrderItemsForFactory(o.items || [], {
          fallbackColor: o.color,
        });
        const rawStage = (o.etapa_produccion || "design") as ProductionOrder["stage"];
        const stage = resolveValidStageForCard(
          rawStage,
          { hasBordado: factory.hasBordado, tipoBordado: factory.tipoBordado, hasEstampado: (o as any).hasEstampado, estampado: (o as any).estampado } as any,
          etapas.length ? etapas : stages
        ) as ProductionOrder["stage"];
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

        const baseCard: ProductionOrder = {
          id: `PO-${o.id}`,
          orderId: o.id,
          customerName: o.cliente_nombre,
          items: o.items.map((i) => i.subproducto_nombre).join(", "),
          quantity: o.items.reduce((s, i) => s + i.cantidad, 0),
          stage,
          // Responsable de capa: NO usar tomado_por (queda pegado entre capas)
          assignee: "Sin asignar",
          assigneeId: null,
          satelliteAssignee: "Sin asignar",
          satelliteAssigneeId: null,
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

        /** Solo muestra responsables de la capa actual según kanban_asignaciones. */
        const applyAsignaciones = (card: ProductionOrder): ProductionOrder => {
          const meta = o.kanban_asignaciones?.[card.id];
          const stageAssignees = {
            ...(card.stageAssignees || {}),
            ...(meta?.stageAssignees || {}),
          };

          // 1. Revisar si hay un responsable específico en stageAssignees para esta capa (card.stage)
          const curSatAssign = stageAssignees[`${card.stage}__satellite`] ||
            (stageAssignees[card.stage]?.kind === "satellite" ? stageAssignees[card.stage] : null);

          const curProdAssign = stageAssignees[card.stage]?.kind === "production"
            ? stageAssignees[card.stage]
            : null;

          if (curSatAssign?.userId) {
            return {
              ...card,
              assigneeId: null,
              assignee: "Sin asignar",
              satelliteAssigneeId: String(curSatAssign.userId),
              satelliteAssignee: curSatAssign.name || "Satélite",
              stageAssignees,
            };
          }

          if (curProdAssign?.userId) {
            return {
              ...card,
              assigneeId: String(curProdAssign.userId),
              assignee: curProdAssign.name || "Producción",
              satelliteAssigneeId: null,
              satelliteAssignee: "Sin asignar",
              stageAssignees,
            };
          }

          // 2. Fallback a meta global de kanban_asignaciones si coincide la etapa
          if (meta) {
            if (!meta.stage || meta.stage === card.stage) {
              const prodId = meta.assigneeId ? String(meta.assigneeId) : null;
              const satId = meta.satelliteAssigneeId ? String(meta.satelliteAssigneeId) : null;

              if (satId) {
                return {
                  ...card,
                  assigneeId: null,
                  assignee: "Sin asignar",
                  satelliteAssigneeId: satId,
                  satelliteAssignee: meta.satelliteAssignee || meta.assignee_name || "Satélite",
                  stageAssignees,
                };
              }
              if (prodId) {
                return {
                  ...card,
                  assigneeId: prodId,
                  assignee: meta.assignee || meta.assignee_name || "Producción",
                  satelliteAssigneeId: null,
                  satelliteAssignee: "Sin asignar",
                  stageAssignees,
                };
              }
            }
          }

          return {
            ...card,
            assigneeId: null,
            assignee: "Sin asignar",
            satelliteAssigneeId: null,
            satelliteAssignee: "Sin asignar",
            stageAssignees,
          };
        };

        const stored =
          Array.isArray(o.kanban_tarjetas) && o.kanban_tarjetas.length
            ? (o.kanban_tarjetas as ProductionOrder[])
            : null;
        if (stored?.length) {
          // Tarjetas desde BD. La capa actual sale de etapa_produccion.
          const allSameLocalStage = stored.every((c) => c.stage === stored[0].stage);
          const syncAllToOrderStage =
            stored.length === 1 ||
            (allSameLocalStage && stored[0].stage !== stage);

          const merged = stored.map((card) => {
            const meta = o.kanban_asignaciones?.[card.id];
            const rawResolvedStage = (
              syncAllToOrderStage
                ? stage
                : meta?.stage || card.stage || stage
            ) as ProductionOrder["stage"];

            const resolvedStage = resolveValidStageForCard(
              rawResolvedStage,
              card,
              etapas.length ? etapas : stages
            ) as ProductionOrder["stage"];

            return applyAsignaciones({
              ...card,
              orderId: o.id,
              customerName: o.cliente_nombre,
              stage: resolvedStage,
              stageHistory,
              daysInStage:
                resolvedStage === stage ? daysInStage : card.daysInStage ?? daysInStage,
              isDelayed: card.isDelayed ?? isDelayed,
              color: factory.color,
              hasBordado: factory.hasBordado,
              bordadoLabel: factory.bordadoLabel,
              tipoBordado: factory.tipoBordado,
              variants: card.variants?.length ? card.variants : variants,
              dueDate:
                card.dueDate ||
                o.fecha_estimada_entrega?.slice(0, 10) ||
                "",
            });
          });

          return merged;
        }
        // Si hay asignación guardada para la tarjeta base, aplicarla
        const baseId = baseCard.id;
        if (o.kanban_asignaciones?.[baseId]) {
          return [applyAsignaciones(baseCard)];
        }
        // Compat: asignación bajo cualquier card_id de esta orden
        const anyMeta = Object.entries(o.kanban_asignaciones || {})[0];
        if (anyMeta) {
          const [cardId, meta] = anyMeta;
          return [
            applyAsignaciones({
              ...baseCard,
              id: cardId,
            }),
          ];
        }
        return [baseCard];
      });
      const labels: Record<string, string> = {};
      stages.forEach((s) => {
        labels[s.key] = s.label;
      });
      setProdOrders(
        transformed.map((c) => reconcileOrphanLiveMaterials(c, labels))
      );
    }
  }, [rawOrders]);

  const commitOrderCards = (
    orderId: string,
    updater: (cards: ProductionOrder[]) => ProductionOrder[]
  ) => {
    setProdOrders((prev) => {
      const others = prev.filter((c) => c.orderId !== orderId);
      const current = prev.filter((c) => c.orderId === orderId);
      const nextForOrder = updater(current);
      const labels: Record<string, string> = {};
      stages.forEach((s) => {
        labels[s.key] = s.label;
      });
      const withLedger = prepareCardsWithLedger(nextForOrder, labels);
      const previousBreakdown = normalizeRealCostBreakdown(
        orderId,
        rawOrders.find((o) => o.id === orderId)?.costo_real_desglose
      );
      void computeFullRealCostFromOrder(orderId, withLedger, {
        estado: "in_production",
        previousBreakdown,
      }).then((breakdown) => {
        void updateKanbanTarjetas(orderId, withLedger, breakdown).then((result) => {
          if (result.errorMessage) {
            toast({
              variant: "destructive",
              title: "No se pudo guardar en el servidor",
              description: result.errorMessage,
            });
            return;
          }
          notifyOrderRealCostUpdated(orderId);
        });
      });
      return [...others, ...withLedger];
    });
  };

  const activeOrders = rawOrders.filter((o) => {
    if (o.estado === "delivered") return false;
    if (canManageBoard) return true;
    if (prodSession.isKanbanOperator && prodSession.stageKeys.length === 0) return false;

    return prodOrders.some((c) => {
      if (c.orderId !== o.id) return false;
      return cardAssignedToOperatorOnAllowedStage(prodSession, c);
    });
  });
  const filteredProdOrders = prodOrders.filter((po) => {
    if (po.orderId !== selectedOrderId) return false;
    if (canManageBoard) return true;
    return cardAssignedToOperatorOnAllowedStage(prodSession, po);
  });
  const selectedOrder = activeOrders.find((o) => o.id === selectedOrderId);

  useEffect(() => {
    if (!selectedOrderId) return;
    if (!selectedOrder) setSelectedOrderId(null);
  }, [selectedOrderId, selectedOrder]);

  // Deep-link desde notificaciones: /production?highlight=<orderId>
  useEffect(() => {
    const highlight = (searchParams.get("highlight") || "").trim();
    if (!highlight || highlightHandledRef.current === highlight) return;
    if (!productionListReady || ordersLoading) return;

    highlightHandledRef.current = highlight;
    const inActive = activeOrders.some((o) => o.id === highlight);
    const inRaw = rawOrders.some((o) => o.id === highlight);

    if (inActive) {
      setSelectedOrderId(highlight);
    } else if (inRaw) {
      toast({
        title: "Pedido no disponible en Operativo",
        description: "El pedido de la notificación no está activo en el tablero Kanban.",
      });
    } else {
      toast({
        title: "Pedido no encontrado",
        description: "La notificación apunta a un pedido que ya no está disponible.",
        variant: "destructive",
      });
    }

    const next = new URLSearchParams(searchParams);
    next.delete("highlight");
    setSearchParams(next, { replace: true });
  }, [
    searchParams,
    productionListReady,
    ordersLoading,
    activeOrders,
    rawOrders,
    setSearchParams,
    toast,
  ]);

  const stageLabels: Record<string, string> = {};
  stages.forEach((s) => { stageLabels[s.key] = s.label; });

  const getOrdersForStage = (stage: string) =>
    filteredProdOrders.filter((o) => o.stage === stage);

  const handleCardDragStart = (e: React.DragEvent, id: string) => {
    const card = prodOrders.find((o) => o.id === id);
    if (card && !canProductionUserOperateCard(prodSession, card)) {
      e.preventDefault();
      toast({
        variant: "destructive",
        title: "Sin permiso",
        description: prodSession.isKanbanOperator
          ? "Solo puedes mover tarjetas asignadas a ti en tus capas."
          : "Solo puedes mover tarjetas de tus capas asignadas.",
      });
      return;
    }
    if (card && !cardHasAssigneeForStage(card, card.stage)) {
      e.preventDefault();
      toast({
        variant: "destructive",
        title: "Asignación requerida",
        description:
          "Asigna a alguien en esta fase antes de arrastrar la tarjeta. Sin responsable no se guarda el costo real.",
      });
      if (canManageBoard && card) {
        openAssignModal(card, card.stage);
      }
      return;
    }
    setDragType("card");
    setDraggedCardId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCardDrop = async (targetStage: string) => {
    if (dragType !== "card" || !draggedCardId) return;
    const movedCardId = draggedCardId;
    const card = prodOrders.find((o) => o.id === movedCardId);
    const previousStage = card?.stage;

    setDraggedCardId(null);
    setDragType(null);

    if (!card || !previousStage) return;

    if (!canProductionUserOperateCard(prodSession, card)) {
      toast({
        variant: "destructive",
        title: "Sin permiso",
        description: prodSession.isKanbanOperator
          ? "Solo puedes mover tarjetas asignadas a ti."
          : "Solo puedes mover tarjetas de tus capas asignadas.",
      });
      return;
    }

    if (!cardHasAssigneeForStage(card, previousStage)) {
      toast({
        variant: "destructive",
        title: "Asignación requerida",
        description:
          "Debes asignar a alguien en esta fase antes de mover la tarjeta. Sin responsable no se guarda el costo real de la orden.",
      });
      if (canManageBoard) {
        openAssignModal(card, previousStage);
      }
      return;
    }

    const visibleStages = stages.filter((s) => isStageRequiredForCard(s.key, card));
    const fromIndex = visibleStages.findIndex((s) => s.key === previousStage);
    const toIndex = visibleStages.findIndex((s) => s.key === targetStage);

    if (previousStage === targetStage) return;

    // BLOQUEO TOTAL DE RETROCESO (Las órdenes solo pueden avanzar)
    if (toIndex <= fromIndex) {
      toast({
        variant: "destructive",
        title: "Movimiento bloqueado",
        description: "No se permite retroceder tarjetas en el flujo de producción. Las órdenes solo pueden avanzar.",
      });
      return;
    }

    // Operadores Kanban: solo a la capa siguiente requerida
    if (
      !prodSession.unrestricted &&
      !canMoveCardToStage(visibleStages, previousStage, targetStage)
    ) {
      const next = getNextStageKey(visibleStages, previousStage);
      const nextLabel = next
        ? stages.find((s) => s.key === next)?.label || next
        : null;
      toast({
        variant: "destructive",
        title: "Movimiento no permitido",
        description: nextLabel
          ? `Desde tu capa solo puedes avanzar a «${nextLabel}».`
          : "No hay una etapa siguiente para mover esta tarjeta.",
      });
      return;
    }

    // Arrastrar hacia adelante liquida y avanza igual que presionar Terminado
    await handleMarkCardTerminado(card, previousStage, targetStage);
  };

  const cancelPendingCardMove = () => {
    if (isMovingCard) return;
    setPendingCardMove(null);
  };

  const confirmPendingCardMove = async () => {
    if (!pendingCardMove || isMovingCard) return;

    const { cardId: movedCardId, orderId, fromStage: previousStage, toStage: targetStage } =
      pendingCardMove;
    const card = prodOrders.find((o) => o.id === movedCardId);
    if (!card) {
      setPendingCardMove(null);
      toast({
        variant: "destructive",
        title: "No se pudo mover",
        description: "La tarjeta ya no está disponible.",
      });
      return;
    }

    setIsMovingCard(true);
    const now = new Date().toISOString();

    try {
      if (!cardHasAssigneeForStage(card, previousStage)) {
        toast({
          variant: "destructive",
          title: "Asignación requerida",
          description:
            "Debes asignar a alguien en esta fase antes de mover la tarjeta. Sin responsable no se guarda el costo real.",
        });
        if (canManageBoard) openAssignModal(card, previousStage);
        setPendingCardMove(null);
        return;
      }

      // Congela costos de la capa saliente (atribuidos al usuario actual) y limpia campos vivos
      const prevLabel =
        stages.find((s) => s.key === previousStage)?.label || previousStage;
      const frozenCosts = freezeStageCostsOnMove(card, previousStage, prevLabel);

      const stageLaborConfig = {
        ...(card.stageLaborConfig || {}),
        ...(previousStage
          ? {
              [previousStage]: {
                enabled: Boolean(card.laborCostEnabled),
                perUnit: card.laborCostPerUnit != null ? Number(card.laborCostPerUnit) : null,
              },
            }
          : {}),
      };

      const targetLaborConfig = targetStage ? stageLaborConfig[targetStage] : undefined;
      const targetLaborEnabled = targetLaborConfig ? Boolean(targetLaborConfig.enabled) : false;
      const targetLaborPerUnit =
        targetLaborConfig && targetLaborConfig.perUnit != null ? Number(targetLaborConfig.perUnit) : null;

      // Al cambiar de capa se limpia Producción y Satélite: el admin reasigna
      const movedPatch = {
        ...frozenCosts,
        stage: targetStage as ProductionOrder["stage"],
        daysInStage: 0,
        assignee: "Sin asignar",
        assigneeId: null as string | null,
        satelliteAssignee: "Sin asignar",
        satelliteAssigneeId: null as string | null,
        stageLaborConfig,
        laborCostEnabled: targetLaborEnabled,
        laborCostPerUnit: targetLaborPerUnit,
        stageHistory: [
          ...(card.stageHistory || []),
          { stage: targetStage as ProductionOrder["stage"], enteredAt: now },
        ],
      };

      if (orderId) {
        commitOrderCards(orderId, (cards) =>
          cards.map((o) => (o.id !== movedCardId ? o : { ...o, ...movedPatch }))
        );
        void updateKanbanAssignment(orderId, {
          card_id: movedCardId,
          stage: targetStage,
          clear: true,
          assignee_id: null,
          kind: "both",
        });
      } else {
        setProdOrders((prev) =>
          prev.map((o) => (o.id !== movedCardId ? o : { ...o, ...movedPatch }))
        );
      }

      toast({
        title: "Tarjeta movida",
        description:
          "Asigna usuarios de Producción y/o Satélite para la nueva capa.",
      });

      setPendingCardMove(null);

      if (!orderId) return;

      const result = await updateOrderStage(orderId, targetStage);
      if (!result.order) {
        // Revertir UI si falla el backend
        commitOrderCards(orderId, (cards) =>
          cards.map((o) =>
            o.id === movedCardId
              ? { ...o, stage: (previousStage || "design") as ProductionOrder["stage"] }
              : o
          )
        );
        await fetchOrders({ estado: "in_production" });
      } else if (historyOpen && orderId === selectedOrderId) {
        const hist = (result.order.etapa_historial || []).map((h) => ({
          stage: h.etapa,
          enteredAt: h.entered_at,
        }));
        if (hist.length) {
          setTimeline(buildProductionTimeline(hist, stageLabels));
        }
      }
    } finally {
      setIsMovingCard(false);
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
    } else {
      notifyKanbanEtapasUpdated();
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
    } else {
      notifyKanbanEtapasUpdated();
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
    notifyKanbanEtapasUpdated();
    await fetchOrders({ estado: "in_production" });
  };
  const addCol = async () => {
    if (!canManageBoard) {
      toast({
        variant: "destructive",
        title: "Sin permiso",
        description: "Solo un administrador puede añadir o reordenar tableros.",
      });
      return;
    }
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
    notifyKanbanEtapasUpdated();
    setEditingColKey(result.etapa.key);
    setEditingColLabel(result.etapa.label);
  };

  const usersForStage = (stageKey: string) =>
    productionUsers.filter((u) => u.stageKeys.includes(stageKey));
  const satelliteUsersForStage = (stageKey: string) =>
    satelliteUsers.filter((u) => u.stageKeys.includes(stageKey));

  const assignCardToUser = async (
    card: ProductionOrder,
    userId: string,
    userName: string,
    kind: "production" | "satellite" = "production"
  ) => {
    if (!canManageBoard) {
      toast({
        variant: "destructive",
        title: "Sin permiso",
        description: "Solo un administrador puede asignar responsables por capa.",
      });
      return;
    }
    if (!card.orderId) return;

    const stageKey = card.stage;
    const stageLabel =
      stages.find((s) => s.key === stageKey)?.label || stageKey;

    // Congela materiales/MO del responsable anterior en el ledger (no se pierden en desglose)
    // y deja esos campos en blanco para el nuevo asignado.
    const frozenWorking = freezeWorkingCostsForNextAssignee(
      card,
      stageKey,
      stageLabel
    );

    // Exclusivo: producción XOR satélite — limpia el otro tipo
    const otherKind = kind === "production" ? "satellite" : "production";
    await updateKanbanAssignment(card.orderId, {
      card_id: card.id,
      stage: stageKey,
      clear: true,
      assignee_id: null,
      kind: otherKind,
    });

    const result = await updateKanbanAssignment(card.orderId, {
      card_id: card.id,
      stage: stageKey,
      assignee_id: userId,
      assignee_name: userName,
      kind,
    });
    if (result.errorMessage) {
      toast({
        variant: "destructive",
        title: "No se pudo asignar",
        description: result.errorMessage,
      });
      return;
    }

    const patch =
      kind === "satellite"
        ? {
            ...frozenWorking,
            assigneeId: null as string | null,
            assignee: "Sin asignar",
            satelliteAssigneeId: userId,
            satelliteAssignee: userName,
            stageAssignees: {
              ...(card.stageAssignees || {}),
              [`${stageKey}__satellite`]: {
                userId,
                name: userName,
                kind: "satellite",
              },
            },
          }
        : {
            ...frozenWorking,
            assigneeId: userId,
            assignee: userName,
            satelliteAssigneeId: null as string | null,
            satelliteAssignee: "Sin asignar",
            stageAssignees: {
              ...(card.stageAssignees || {}),
              [stageKey]: { userId, name: userName, kind: "production" },
            },
          };
    commitOrderCards(card.orderId, (cards) =>
      cards.map((c) => (c.id === card.id ? { ...c, ...patch } : c))
    );
    setAssignOpenFor(null);
    toast({
      title: kind === "satellite" ? "Satélite asignado" : "Producción asignada",
      description: `${userName} quedó a cargo de esta tarjeta en la capa actual.`,
    });
  };

  const openAddCard = (stageKey: string) => {
    if (!canProductionUserActOnStage(prodSession, stageKey) || !canEditOnStage(stageKey)) {
      toast({
        variant: "destructive",
        title: "Sin permiso",
        description: "Solo puedes añadir tarjetas en tus capas y con permiso de edición.",
      });
      return;
    }
    setCardFormInitial({
      items: "",
      assignee: "",
      quantity: 1,
      dueDate: selectedOrder?.fecha_estimada_entrega?.slice(0, 10) ?? "",
      satelliteId: "",
      satelliteCost: "",
      moldEnabled: false,
      moldStatus: "pendiente",
      moldResponsible: "",
      moldSizes: "",
      moldCost: "0.00",
      moldNotes: "",
      laborCostEnabled: false,
      laborCostPerUnit: "0.00",
      cardImages: [],
      cardFiles: [],
      novedades: [],
      requestedMaterials: [],
    });
    setCardDialog({ open: true, mode: "add", stageKey, focusSection: null });
  };

  const openEditCard = (
    card: ProductionOrder,
    options?: { focusSection?: "materials" | null }
  ) => {
    if (!canProductionUserOperateCard(prodSession, card) && !canManageBoard) {
      toast({
        variant: "destructive",
        title: "Sin permiso",
        description: "Solo puedes abrir tarjetas asignadas a ti en tus capas.",
      });
      return;
    }
    if (
      !canManageBoard &&
      !canEditOnStage(card.stage) &&
      !canRequestInventoryOnStage(card.stage)
    ) {
      toast({
        variant: "destructive",
        title: "Sin permiso",
        description: "Tu capa no tiene permiso para editar ni solicitar inventario.",
      });
      return;
    }
    setCardFormInitial(cardFormFromProductionOrder(card, card.stage));
    setCardDialog({
      open: true,
      mode: "edit",
      cardId: card.id,
      stageKey: card.stage,
      focusSection: options?.focusSection ?? null,
    });
  };

  const openEditCardMaterials = (card: ProductionOrder) => {
    openEditCard(card, { focusSection: "materials" });
  };

  const saveCard = async (incoming: KanbanCardFormValues & { satelliteName: string | null }) => {
    const { mode, cardId, stageKey } = cardDialog;
    if (!incoming.items.trim() || savingCard) return;

    const existingCard =
      mode === "edit" && cardId ? prodOrders.find((o) => o.id === cardId) : undefined;

    // Solo Administrador puede alterar descripción, responsable, cantidad, fecha y satélite
    const values =
      !prodSession.isAdmin && existingCard
        ? {
            ...incoming,
            items: existingCard.items,
            assignee: existingCard.assignee,
            quantity: existingCard.quantity,
            dueDate: existingCard.dueDate,
            satelliteId: existingCard.satelliteId || "",
            satelliteCost:
              existingCard.satelliteCost != null && Number.isFinite(existingCard.satelliteCost)
                ? String(existingCard.satelliteCost)
                : "",
            satelliteName: existingCard.satelliteName || null,
          }
        : incoming;

    const targetStage = stageKey || existingCard?.stage;
    if (targetStage && !canProductionUserActOnStage(prodSession, targetStage)) {
      toast({
        variant: "destructive",
        title: "Sin permiso",
        description: "Solo puedes guardar tarjetas de tus capas asignadas.",
      });
      return;
    }
    if (
      targetStage &&
      !canEditOnStage(targetStage) &&
      !canRequestInventoryOnStage(targetStage)
    ) {
      toast({
        variant: "destructive",
        title: "Sin permiso",
        description: "No tienes permiso para guardar esta tarjeta.",
      });
      return;
    }

    // Histórico de otras capas intacto; esta capa solo actualiza requestedMaterials vivos.
    // Al avanzar de capa, freezeWorkingCostsForNextAssignee congela lo vivo en materialsDeducted.
    const materialsDeducted = (existingCard?.materialsDeducted || []).filter((m) => {
      if (!m?.materialId || (Number(m.quantity) || 0) <= 0) return false;
      // No guardar vivos de la capa actual dentro del histórico (aún no congelados)
      if (targetStage && m.stage === targetStage) return false;
      return true;
    });

    setSavingCard(true);

    const satelliteId = values.satelliteId || null;
    const satelliteCostRaw = values.satelliteCost.trim();
    const satelliteCost =
      satelliteId && satelliteCostRaw !== "" && Number.isFinite(Number(satelliteCostRaw))
        ? Number(satelliteCostRaw)
        : null;

    const moldCostRaw = values.moldCost.trim();
    const moldCost =
      values.moldEnabled && moldCostRaw !== "" && Number.isFinite(Number(moldCostRaw))
        ? Number(moldCostRaw)
        : null;

    const moldFields = {
      moldEnabled: values.moldEnabled,
      moldStatus: values.moldEnabled ? values.moldStatus : undefined,
      moldResponsible: values.moldEnabled ? values.moldResponsible : "",
      moldSizes: values.moldEnabled ? values.moldSizes : "",
      moldCost: values.moldEnabled ? moldCost : null,
      moldNotes: values.moldEnabled ? values.moldNotes : "",
    };

    const laborCostRaw = values.laborCostPerUnit.trim();
    const laborCostPerUnit =
      values.laborCostEnabled && laborCostRaw !== "" && Number.isFinite(Number(laborCostRaw))
        ? Number(laborCostRaw)
        : null;

    const currentStage = stageKey || existingCard?.stage;
    const stageLaborConfig = {
      ...(existingCard?.stageLaborConfig || {}),
      ...(currentStage
        ? {
            [currentStage]: {
              enabled: values.laborCostEnabled,
              perUnit: values.laborCostEnabled && laborCostPerUnit != null ? laborCostPerUnit : null,
            },
          }
        : {}),
    };

    const laborAndFiles = {
      laborCostEnabled: values.laborCostEnabled,
      laborCostPerUnit: values.laborCostEnabled ? laborCostPerUnit : null,
      stageLaborConfig,
      cardImages: values.cardImages,
      cardFiles: values.cardFiles,
      novedades: values.novedades || [],
    };

    if (mode === "add" && stageKey && selectedOrderId && selectedOrder) {
      const factory = resolveFactoryCardInfo(selectedOrder);
      const variants = groupOrderItemsForFactory(selectedOrder.items || [], {
        fallbackColor: selectedOrder.color,
      });
      const newCard: ProductionOrder = {
        id: `PO-${Date.now()}`,
        orderId: selectedOrderId,
        customerName: selectedOrder.cliente_nombre,
        items: values.items,
        assignee: values.assignee,
        quantity: values.quantity,
        dueDate: values.dueDate,
        stage: stageKey as ProductionOrder["stage"],
        daysInStage: 0,
        isDelayed: false,
        stageHistory: [
          { stage: stageKey as ProductionOrder["stage"], enteredAt: new Date().toISOString() },
        ],
        color: factory.color,
        hasBordado: factory.hasBordado,
        bordadoLabel: factory.bordadoLabel,
        tipoBordado: factory.tipoBordado,
        variants,
        satelliteId,
        satelliteName: values.satelliteName,
        satelliteCost,
        ...moldFields,
        ...laborAndFiles,
        requestedMaterials: values.requestedMaterials,
        materialsDeducted,
      };
      commitOrderCards(selectedOrderId, (cards) => [...cards, newCard]);
    } else if (mode === "edit" && cardId) {
      const orderId = existingCard?.orderId || selectedOrderId;
      if (orderId) {
        commitOrderCards(orderId, (cards) =>
          cards.map((o) =>
            o.id === cardId
              ? {
                  ...o,
                  items: values.items,
                  assignee: values.assignee,
                  quantity: values.quantity,
                  dueDate: values.dueDate,
                  satelliteId,
                  satelliteName: values.satelliteName,
                  satelliteCost,
                  ...moldFields,
                  ...laborAndFiles,
                  requestedMaterials: values.requestedMaterials,
                  materialsDeducted,
                }
              : o
          )
        );
      }
    }

    const savedOrderId =
      (mode === "edit" ? existingCard?.orderId : selectedOrderId) || selectedOrderId || "";

    if (values.requestedMaterials.length > 0 || materialsDeducted.length > 0) {
      toast({
        title: "Solicitud registrada",
        description:
          "Los materiales adicionales quedaron en el desglose de costo real para el administrador. No se descontó stock real.",
      });
      if (savedOrderId) notifyOrderRealCostUpdated(savedOrderId);
    }

    setSavingCard(false);
    setCardDialog((d) => ({ ...d, open: false, focusSection: null }));
  };
  const deleteCard = (id: string) => {
    const card = prodOrders.find((o) => o.id === id);
    if (!card) return;
    if (
      !canManageBoard &&
      (!canProductionUserOperateCard(prodSession, card) || !canEditOnStage(card.stage))
    ) {
      toast({
        variant: "destructive",
        title: "Sin permiso",
        description: "No puedes eliminar tarjetas fuera de tus capas o sin permiso de edición.",
      });
      return;
    }
    if (!card.orderId) {
      setProdOrders((prev) => prev.filter((o) => o.id !== id));
      return;
    }
    commitOrderCards(card.orderId, (cards) => cards.filter((o) => o.id !== id));
  };
  const closeHistory = () => {
    setHistoryClosing(true);
    setTimeout(() => {
      setHistoryOpen(false);
      setHistoryClosing(false);
    }, 400);
  };

  const openHistory = async () => {
    if (!selectedOrderId || !selectedOrder) return;
    if (!userCanViewHistory) {
      toast({
        variant: "destructive",
        title: "Sin permiso",
        description: "Tu capa no tiene permiso para ver el historial.",
      });
      return;
    }
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
      <AppLayout title="Operativo" subtitle="Órdenes activas en planta" eyebrow="Operación">
        {activeOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {prodSession.isKanbanOperator && prodSession.stageKeys.length === 0
                ? "No tienes capas asignadas"
                : "En el momento no tiene pedidos asignados"}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
              {prodSession.isKanbanOperator && prodSession.stageKeys.length === 0
                ? "Un administrador debe configurar tus capas en Administración → Usuarios antes de que puedas ver pedidos en Fábrica."
                : prodSession.isKanbanOperator
                  ? "Cuando un administrador te asigne una tarjeta en una capa autorizada, el pedido aparecerá aquí."
                  : "No hay órdenes activas en planta por ahora."}
            </p>
          </div>
        ) : (
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
        )}
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Operativo — ORD-${selectedOrderId.slice(0, 3)}`} subtitle={selectedOrder ? `${selectedOrder.cliente_nombre}` : ""} eyebrow="Operación">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => setSelectedOrderId(null)} className="gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver</Button>
        <div className="flex items-center gap-2">
          {userCanViewHistory ? (
            <Button variant="outline" size="sm" onClick={openHistory} className="gap-2">
              <History className="h-4 w-4" /> Historial
            </Button>
          ) : null}
          {canManageBoard ? (
            <Button variant="default" size="sm" onClick={addCol} disabled={savingBoard || loadingEtapas} className="gap-2">
              {savingBoard ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Añadir tablero
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-12rem)]">
        {(() => {
          const primaryCard =
            filteredProdOrders[0] ||
            prodOrders.find((p) => p.orderId === selectedOrderId) ||
            null;
          const visibleStages = stages.filter((stage) =>
            isStageRequiredForCard(stage.key, primaryCard) &&
            canViewBoardOnStage(stage.key)
          );

          if (visibleStages.length === 0) {
            return (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center min-h-[320px]">
                <Factory className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-semibold text-foreground">
                  {!canManageBoard && prodSession.stageKeys.length === 0
                    ? "Sin capas autorizadas"
                    : "No hay tableros visibles para este pedido"}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-md">
                  {!canManageBoard && prodSession.stageKeys.length === 0
                    ? "Contacta al administrador para que te asigne las capas Kanban que puedes operar."
                    : !canManageBoard
                      ? `Solo puedes ver las capas que el administrador te asignó${
                          prodSession.stageKeys.length
                            ? `: ${prodSession.stageKeys
                                .map((k) => stageLabels[k] || k)
                                .join(", ")}`
                            : ""
                        }. Si te asignaron este pedido en otra capa, pide al administrador que actualice tus capas o reasigne el trabajo.`
                      : "Este pedido no tiene etapas Kanban configuradas todavía."}
                </p>
              </div>
            );
          }

          return visibleStages.map((stage, stageIndex) => {
            const rawStageOrders = getOrdersForStage(stage.key);
            const canViewThisStage = canViewBoardOnStage(stage.key);
            const stageOrders = canViewThisStage ? rawStageOrders : [];
            const isEditing = editingColKey === stage.key;
            const isOwnCapa =
              canManageBoard || userStageKeys.includes(stage.key);
            const draggedCard =
              dragType === "card" && draggedCardId
                ? prodOrders.find((o) => o.id === draggedCardId)
                : undefined;
            const nextOfDragged = draggedCard
              ? getNextStageKey(visibleStages, draggedCard.stage)
              : null;
            const fromIndex = draggedCard
              ? visibleStages.findIndex((s) => s.key === draggedCard.stage)
              : -1;
            const toIndex = visibleStages.findIndex((s) => s.key === stage.key);
            const isForward = draggedCard && fromIndex >= 0 && toIndex > fromIndex;
            const isValidDropTarget =
              Boolean(isForward) &&
              (canManageBoard ||
                (Boolean(draggedCard) &&
                  canProductionUserActOnStage(prodSession, draggedCard!.stage) &&
                  stage.key === nextOfDragged));
            const isDropTarget = dragType === "card" && draggedCardId != null && isValidDropTarget;
            const theme = resolveStageTheme(stage, stageIndex);
            return (
              <div
                key={stage.key}
                className={cn(
                  "flex-shrink-0 w-72 flex flex-col transition-opacity",
                  draggedColKey === stage.key && "opacity-40",
                  !canManageBoard && !isOwnCapa && dragType !== "card" && "opacity-80"
                )}
              onDragOver={(e) => {
                if (dragType === "column" && !canManageBoard) return;
                if (dragType === "card" && !isValidDropTarget) return;
                e.preventDefault();
              }}
              onDrop={() => {
                if (dragType === "column") {
                  if (canManageBoard) handleColDropOnCol(stage.key);
                  return;
                }
                handleCardDrop(stage.key);
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
                      draggable={!isEditing && canManageBoard}
                      onDragStart={(e) => {
                        if (!canManageBoard) {
                          e.preventDefault();
                          return;
                        }
                        handleColDragStart(e, stage.key);
                      }}
                      className={cn(
                        "cursor-grab text-muted-foreground hover:text-foreground shrink-0",
                        !canManageBoard && "cursor-default opacity-40"
                      )}
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
                  {!isEditing && canManageBoard && (
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
                {!canViewThisStage ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground/60 italic">
                    Sin permisos para ver tarjetas de esta capa
                  </div>
                ) : (
                  stageOrders.map((order) => {
                    const canOperate = canProductionUserOperateCard(prodSession, order);
                    const canSeeCapa = canProductionUserActOnStage(prodSession, order.stage);
                    const canEditCard = canOperate && canEditOnStage(order.stage);
                    const canInventoryCard =
                      canOperate && canRequestInventoryOnStage(order.stage);
                    const canSetLabor = canOperate || canManageBoard;
                    const stageUsers = usersForStage(order.stage);
                    const stageSatUsers = satelliteUsersForStage(order.stage);
                    const needsAssign = !cardHasAssigneeForStage(order, stage.key);
                    const hasProductionAssignee = Boolean(order.assigneeId);
                    const hasSatelliteAssignee = Boolean(order.satelliteAssigneeId);
                    const stageLabor = getCardLaborInfoForStage(order, stage.key);
                    const hasMaterialRequests = cardHasKanbanMaterialRequests(order);
                    // Visible en cualquier capa del tablero cuando hay solicitud viva de esta capa
                    const showSolicitasteBtn =
                      hasMaterialRequests &&
                      (canManageBoard || canInventoryCard || canOperate);
                    return (
                    <div
                      key={order.id}
                      draggable={canOperate && !needsAssign}
                    onDragStart={(e) => handleCardDragStart(e, order.id)}
                    className={cn(
                      "bg-card rounded-lg border border-border p-3 hover:shadow-md transition-shadow relative group/card",
                      canOperate && !needsAssign ? "cursor-grab" : "cursor-default opacity-90",
                      needsAssign && canManageBoard && "ring-1 ring-amber-300/80"
                    )}
                  >
                    {(canEditCard || canInventoryCard || canManageBoard || canViewStageSummary) && (
                      <div className="absolute top-2 right-2 flex opacity-0 group-hover/card:opacity-100 bg-card/90 rounded-md backdrop-blur-xs">
                        {canViewStageSummary && (
                          <button
                            type="button"
                            title="Ver resumen de esta capa para este pedido"
                            onClick={(e) => {
                              e.stopPropagation();
                              const etapaObj = etapas.find((e) => e.key === stage.key) || ({
                                id: stage.id,
                                key: stage.key,
                                label: stage.label,
                                activo: true,
                                orden: 0,
                              } as any);
                              setSummaryStage(etapaObj);
                              setSummaryTargetOrder(order);
                            }}
                            className="p-1 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <FileText className="h-3 w-3" />
                          </button>
                        )}
                        {(canEditCard || canInventoryCard || canManageBoard) && (
                          <button onClick={() => openEditCard(order)} className="p-1">
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        {canEditCard || canManageBoard ? (
                          <button onClick={() => deleteCard(order.id)} className="p-1">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        ) : null}
                      </div>
                    )}
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
                        <span className="text-foreground tabular-nums">{order.quantity} uds</span>
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
                      <div className="flex items-start justify-between gap-2 border-t border-border/50 pt-1 mt-1">
                        <span className="text-muted-foreground shrink-0 inline-flex items-center gap-1 font-medium">
                          <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          Mano de obra
                        </span>
                        <div className="text-right leading-tight">
                          {stageLabor.hasLabor ? (
                            canSetLabor ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLaborCostModal(order, stage.key);
                                }}
                                className="group/labor text-right hover:opacity-85 transition-opacity"
                                title="Haz clic para editar el costo de mano de obra en esta capa"
                              >
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums group-hover/labor:underline">
                                  {formatMoneyCop(stageLabor.totalLabor)}
                                </span>
                                {stageLabor.unitLabor > 0 && (
                                  <span className="block text-[9px] text-muted-foreground tabular-nums">
                                    {formatMoneyCop(stageLabor.unitLabor)}/ud
                                  </span>
                                )}
                              </button>
                            ) : (
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                {formatMoneyCop(stageLabor.totalLabor)}
                              </span>
                            )
                          ) : stageLabor.hasSatellite ? (
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                              {formatMoneyCop(stageLabor.satelliteTotal)}
                            </span>
                          ) : canSetLabor ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openLaborCostModal(order, stage.key);
                              }}
                              className="h-5 px-2 text-[10px] font-medium border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 gap-0.5 rounded shadow-none"
                              title="Asignar costo de mano de obra para esta capa"
                            >
                              <DollarSign className="h-2.5 w-2.5" />
                              Valor
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground mb-2">
                      <span className="truncate min-w-0">
                        <User className="h-3 w-3 inline" />{" "}
                        {hasProductionAssignee
                          ? `Producción · ${order.assignee}`
                          : hasSatelliteAssignee
                            ? `Satélite · ${order.satelliteAssignee}`
                            : "Sin asignar"}
                      </span>
                      <span className="shrink-0 inline-flex items-center gap-1.5">
                        {(order.novedades || []).length > 0 &&
                        (canManageBoard ||
                          canOperate ||
                          (prodSession.userId &&
                            order.novedades!.some((n) => n.autorId === prodSession.userId))) ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 text-red-600 hover:text-red-700 hover:underline"
                            title="Ver novedades"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNovedadesCard(order);
                            }}
                          >
                            <MessageSquare className="h-3 w-3" />
                            {order.novedades!.length}
                          </button>
                        ) : null}
                        <span>
                          <Calendar className="h-3 w-3 inline" /> {order.dueDate.slice(5)}
                        </span>
                      </span>
                    </div>
                    {canManageBoard ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-[10px] gap-1 mb-1 font-semibold"
                        onClick={() => openAssignModal(order, stage.key)}
                      >
                        <UserPlus className="h-3 w-3" />
                        {hasProductionAssignee || hasSatelliteAssignee
                          ? "Reasignar"
                          : "Asignar a"}
                      </Button>
                    ) : null}
                    <div className="mt-1.5 pt-1.5 border-t flex items-center justify-between gap-1">
                      <p
                        className="text-[10px] font-medium truncate min-w-0 flex-1"
                        title={
                          hasSatelliteAssignee
                            ? `Satélite: ${order.satelliteAssignee || order.satelliteName}`
                            : hasProductionAssignee
                              ? `Producción: ${order.assignee}`
                              : "Sin asignar"
                        }
                      >
                        {hasSatelliteAssignee
                          ? `Satélite: ${order.satelliteAssignee || order.satelliteName}`
                          : hasProductionAssignee
                            ? `Producción: ${order.assignee}`
                            : "Sin asignar"}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {showSolicitasteBtn ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditCardMaterials(order);
                            }}
                            className="h-6 px-2 text-[10px] font-medium border-red-300/60 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 gap-1 rounded shadow-none"
                            title="Actualizar materiales solicitados en esta capa"
                          >
                            Solicitaste
                            <Pencil className="h-3 w-3" />
                          </Button>
                        ) : null}
                        {(canManageBoard || canOperate) ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={needsAssign}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (needsAssign) {
                                toast({
                                  variant: "destructive",
                                  title: "Asignación requerida",
                                  description:
                                    "Asigna a alguien en esta fase antes de marcar Terminado. Sin responsable no se guarda el costo real.",
                                });
                                if (canManageBoard) openAssignModal(order, stage.key);
                                return;
                              }
                              handleMarkCardTerminado(order, stage.key);
                            }}
                            className="h-6 px-2 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shrink-0 rounded shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                            title={
                              needsAssign
                                ? "Asigna a alguien en esta fase antes de terminar"
                                : "Marcar trabajo como terminado en esta capa para avanzar el pedido y sumar la mano de obra a por pagar"
                            }
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Terminado
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
                {isOwnCapa && canManageBoard ? (
                  <button onClick={() => openAddCard(stage.key)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed text-xs hover:bg-card"><Plus className="h-3.5 w-3.5" /> Añadir tarjeta</button>
                ) : null}
                {canViewStageSummary ? (
                  <button
                    type="button"
                    onClick={() => {
                      const etapaObj = etapas.find((e) => e.key === stage.key) || ({
                        id: stage.id,
                        key: stage.key,
                        label: stage.label,
                        activo: true,
                        orden: 0,
                      } as any);
                      setSummaryStage(etapaObj);
                      setSummaryTargetOrder(null);
                    }}
                    className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border/80 bg-background/80 hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shadow-xs"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Ver resumen
                  </button>
                ) : null}
              </div>
            </div>
          );
          });
        })()}
      </div>

      <KanbanCardEditDialog
        open={cardDialog.open}
        mode={cardDialog.mode}
        stageKey={cardDialog.stageKey || dialogStageKey}
        initial={cardFormInitial}
        onOpenChange={(open) =>
          setCardDialog((d) => ({ ...d, open, focusSection: open ? d.focusSection : null }))
        }
        onSave={saveCard}
        saving={savingCard}
        focusSection={cardDialog.focusSection ?? null}
        canRequestInventory={
          !dialogStageKey || canRequestInventoryOnStage(dialogStageKey)
        }
        readOnly={Boolean(dialogStageKey) && !canEditOnStage(dialogStageKey)}
        canEditCoreFields={prodSession.isAdmin}
        canAssignSatellite={prodSession.isAdmin}
      />

      <KanbanNovedadesDialog
        open={Boolean(novedadesCard)}
        onOpenChange={(open) => {
          if (!open) setNovedadesCard(null);
        }}
        card={novedadesCard}
      />

      <StageLaborCostDialog
        open={laborDialog.open}
        onOpenChange={(open) => setLaborDialog((d) => ({ ...d, open }))}
        card={laborDialog.card}
        stageKey={laborDialog.stageKey}
        stageLabel={laborDialog.stageLabel}
        onSave={saveLaborCostForStage}
      />

      <KanbanStageSummaryDialog
        open={Boolean(summaryStage)}
        onOpenChange={(open) => {
          if (!open) {
            setSummaryStage(null);
            setSummaryTargetOrder(null);
          }
        }}
        stage={summaryStage}
        orders={prodOrders}
        targetOrder={summaryTargetOrder}
      />

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
              ) : (
                <>
                  {timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Aún no hay movimientos de etapa para este pedido.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-muted/50 px-4 py-3">
                          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Etapas completadas
                          </p>
                          <p className="text-2xl text-foreground mt-1 tabular-nums">
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
                              <div
                                key={`tl-${entry.stage}-${entry.startedAt}`}
                                className="relative flex gap-3 pb-6 last:pb-0"
                              >
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
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      <AlertDialog
        open={!!pendingCardMove}
        onOpenChange={(open) => {
          if (!open) cancelPendingCardMove();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Mover tarjeta de capa?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a mover esta tarjeta a{" "}
              <span className="font-medium text-foreground">
                {pendingCardMove
                  ? stages.find((s) => s.key === pendingCardMove.toStage)?.label ||
                    pendingCardMove.toStage
                  : ""}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMovingCard}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMovingCard}
              onClick={(e) => {
                e.preventDefault();
                void confirmPendingCardMove();
              }}
            >
              {isMovingCard ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Moviendo...
                </>
              ) : (
                "Confirmar movimiento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Asignación Multicapa */}
      <Dialog
        open={assignModal.open}
        onOpenChange={(open) => {
          if (!open)
            setAssignModal({
              open: false,
              card: null,
              selectedStages: [],
              assigneeType: "production",
              selectedUserId: "",
            });
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Asignación Multicapa — ORD-{assignModal.card?.orderId?.slice(0, 3)}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Selecciona las capas a asignar y elige el usuario o taller satélite responsable. Puedes seleccionar múltiples capas para asignar a la misma persona.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 1. Selección de capas con Checkboxes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Capas a asignar ({assignModal.selectedStages.length} seleccionadas)
                </Label>
                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      const currentStageIndex = stages.findIndex(
                        (s) => s.key === assignModal.card?.stage
                      );
                      const validStages = stages
                        .filter((s, idx) => {
                          const isPast = currentStageIndex >= 0 && idx < currentStageIndex;
                          const isReq = isStageRequiredForCard(s.key, assignModal.card);
                          return !isPast && isReq;
                        })
                        .map((s) => s.key);
                      setAssignModal((prev) => ({
                        ...prev,
                        selectedStages: validStages,
                      }));
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    Seleccionar todas
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAssignModal((prev) => ({
                        ...prev,
                        selectedStages: [],
                      }))
                    }
                    className="text-muted-foreground hover:underline"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-muted/20 p-3 rounded-lg border">
                {(() => {
                  const currentStageIndex = stages.findIndex(
                    (s) => s.key === assignModal.card?.stage
                  );
                  return stages.map((stage, idx) => {
                    const isPastStage = currentStageIndex >= 0 && idx < currentStageIndex;
                    const isRequired = isStageRequiredForCard(stage.key, assignModal.card);
                    const isChecked = !isPastStage && isRequired && assignModal.selectedStages.includes(stage.key);
                    const theme = resolveStageTheme(stage, idx);

                    if (isPastStage) {
                      return (
                        <div
                          key={stage.key}
                          className="flex items-center gap-2 p-2.5 pt-3 rounded-lg border text-xs bg-muted/40 border-muted/50 text-muted-foreground/60 cursor-not-allowed relative overflow-hidden select-none"
                          title="Capa completada previamente"
                        >
                          <span className="absolute top-0 left-0 right-0 h-1 bg-muted-foreground/20" />
                          <div className="h-4 w-4 shrink-0 rounded-xs border border-muted-foreground/30 bg-muted/50 flex items-center justify-center">
                            <X className="h-3 w-3 text-red-500/80" strokeWidth={3} />
                          </div>
                          <span className="line-through flex-1 truncate">{stage.label}</span>
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600/80 bg-red-100/50 px-1 py-0.5 rounded border border-red-200/50 shrink-0">
                            Finalizada
                          </span>
                        </div>
                      );
                    }

                    if (!isRequired) {
                      return (
                        <div
                          key={stage.key}
                          className="flex items-center gap-2 p-2.5 pt-3 rounded-lg border text-xs bg-muted/30 border-muted/40 text-muted-foreground/50 cursor-not-allowed relative overflow-hidden select-none"
                          title="Este pedido no requiere esta capa (ej. Sin bordado o sin estampado)"
                        >
                          <span className="absolute top-0 left-0 right-0 h-1 bg-amber-400/30" />
                          <div className="h-4 w-4 shrink-0 rounded-xs border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-center">
                            <X className="h-3 w-3 text-amber-600/80" strokeWidth={3} />
                          </div>
                          <span className="line-through flex-1 truncate">{stage.label}</span>
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/40 px-1 py-0.5 rounded border border-amber-200 dark:border-amber-800 shrink-0">
                            No Requiere
                          </span>
                        </div>
                      );
                    }

                    return (
                      <label
                        key={stage.key}
                        className={cn(
                          "flex items-center gap-2 p-2.5 pt-3 rounded-lg border text-xs cursor-pointer transition-all relative overflow-hidden",
                          isChecked
                            ? `${theme.header} font-semibold text-foreground ring-2 ring-primary/40 border-primary/50 shadow-xs`
                            : "bg-card border-border hover:bg-muted/40 text-muted-foreground"
                        )}
                      >
                        {/* Barrita superior con el color exacto de la etapa */}
                        <span className={cn("absolute top-0 left-0 right-0 h-1", theme.bar)} />
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            setAssignModal((prev) => {
                              const set = new Set(prev.selectedStages);
                              if (checked) set.add(stage.key);
                              else set.delete(stage.key);
                              return { ...prev, selectedStages: Array.from(set) };
                            });
                          }}
                        />
                        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0 shadow-xs", theme.bar)} />
                        <span className="truncate flex-1">{stage.label}</span>
                      </label>
                    );
                  });
                })()}
              </div>
            </div>

            {/* 2. Selección de Tipo de Responsable */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Tipo de Responsable
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setAssignModal((prev) => ({
                      ...prev,
                      assigneeType: "production",
                      selectedUserId: "",
                    }))
                  }
                  className={cn(
                    "flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all",
                    assignModal.assigneeType === "production"
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  <User className="h-4 w-4" />
                  Usuario Producción
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAssignModal((prev) => ({
                      ...prev,
                      assigneeType: "satellite",
                      selectedUserId: "",
                    }))
                  }
                  className={cn(
                    "flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all",
                    assignModal.assigneeType === "satellite"
                      ? "bg-red-600 text-white border-red-600 shadow-xs"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  <Factory className="h-4 w-4" />
                  Taller Satélite
                </button>
              </div>
            </div>

            {/* 3. Dropdown de Selección de Persona / Taller */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                {assignModal.assigneeType === "production"
                  ? "Seleccionar Usuario de Producción"
                  : "Seleccionar Taller o Usuario Satélite"}
              </Label>

              <Select
                value={assignModal.selectedUserId}
                onValueChange={(val) =>
                  setAssignModal((prev) => ({ ...prev, selectedUserId: val }))
                }
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue
                    placeholder={
                      assignModal.assigneeType === "production"
                        ? "Selecciona usuario de producción..."
                        : "Selecciona taller o usuario satélite..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {assignModal.assigneeType === "production" ? (
                    productionUsers.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No hay usuarios de producción disponibles
                      </SelectItem>
                    ) : (
                      productionUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))
                    )
                  ) : satelliteUsers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No hay usuarios satélite disponibles
                    </SelectItem>
                  ) : (
                    satelliteUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} {u.satelliteId ? "· (Taller)" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setAssignModal({
                  open: false,
                  card: null,
                  selectedStages: [],
                  assigneeType: "production",
                  selectedUserId: "",
                })
              }
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                savingCard ||
                assignModal.selectedStages.length === 0 ||
                !assignModal.selectedUserId
              }
              onClick={() => {
                const isProd = assignModal.assigneeType === "production";
                const userList = isProd ? productionUsers : satelliteUsers;
                const foundUser = userList.find(
                  (u) => u.id === assignModal.selectedUserId
                );
                if (!foundUser || !assignModal.card) return;

                assignCardToMultipleStages(
                  assignModal.card,
                  assignModal.selectedStages,
                  foundUser.id,
                  foundUser.name,
                  assignModal.assigneeType
                );
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5"
            >
              {savingCard ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirmar Asignación ({assignModal.selectedStages.length} capas)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}