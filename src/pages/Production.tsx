import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrders } from "@/hooks/useOrders";
import { useKanbanEtapas } from "@/hooks/useKanbanEtapas";
import { useRemoveMaterialStock } from "@/hooks/useRemoveMaterialStock";
import { type ProductionOrder } from "@/data/mockData";
import { User, Calendar, Package, ArrowLeft, ChevronRight, History, Clock, X, Plus, Pencil, Trash2, GripVertical, Check, Loader2, Boxes, Scissors, DollarSign, Factory, ImagePlus, Paperclip, FileText, UserPlus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveFactoryCardInfo, groupOrderItemsForFactory } from "@/lib/order-fields";
import { FactoryVariantBreakdown } from "@/components/FactoryVariantBreakdown";
import { KanbanStageChip } from "@/components/KanbanStageChip";
import {
  KanbanCardEditDialog,
  cardFormFromProductionOrder,
  type KanbanCardFormValues,
} from "@/components/KanbanCardEditDialog";
import { KanbanNovedadesDialog } from "@/components/KanbanNovedadesDialog";
import { useToast } from "@/hooks/use-toast";
import { HttpError } from "@/lib/http";
import {
  prepareCardsWithLedger,
  computeRealCostFromCards,
  freezeStageCostsOnMove,
  freezeWorkingCostsForNextAssignee,
  notifyOrderRealCostUpdated,
} from "@/lib/order-real-cost";
import {
  notifyKanbanEtapasUpdated,
  readProductionSession,
  getSessionCapaActionsMap,
  capaHasAction,
  canMoveCardToStage,
  canProductionUserActOnStage,
  canProductionUserOperateCard,
  getNextStageKey,
  parseStageKeys,
} from "@/lib/production-capa-permissions";
import { endpoints } from "@/lib/api-endpoints";
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

function deductedMap(list?: { materialId: string; quantity: number }[]) {
  const map = new Map<string, number>();
  (list || []).forEach((item) => {
    map.set(item.materialId, Number(item.quantity) || 0);
  });
  return map;
}

export default function Production() {
  const { toast } = useToast();
  const { orders: rawOrders, fetchOrders, updateOrderStage, fetchEtapaLogs, updateKanbanAssignment, updateKanbanTarjetas } = useOrders();
  const { removeStock } = useRemoveMaterialStock();
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
  }>({ open: false, mode: "add" });
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

  useEffect(() => {
    const sync = () => {
      const session = readProductionSession();
      setProdSession(session);
      setCapaActionsMap(getSessionCapaActionsMap(session));
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
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
  const canEditOnStage = (stageKey: string) =>
    canManageBoard ||
    (userStageKeys.includes(stageKey) &&
      capaHasAction(capaActionsMap, stageKey, "editar_tarjeta"));
  const canRequestInventoryOnStage = (stageKey: string) =>
    canManageBoard ||
    (userStageKeys.includes(stageKey) &&
      capaHasAction(capaActionsMap, stageKey, "solicitar_inventario"));
  const userCanViewHistory =
    canManageBoard ||
    userStageKeys.some((k) => capaHasAction(capaActionsMap, k, "ver_historial"));
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
          const breakdown = computeRealCostFromCards(order.id, withLedger);
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
    fetchOrders({ estado: "in_production" });
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
          const cleared = {
            ...card,
            assigneeId: null as string | null,
            assignee: "Sin asignar",
            satelliteAssigneeId: null as string | null,
            satelliteAssignee: "Sin asignar",
          };

          if (!meta) return cleared;

          // Solo mostrar responsables si la asignación es de ESTA capa
          if (!meta.stage || meta.stage !== card.stage) {
            return {
              ...cleared,
              stageAssignees: meta.stageAssignees || card.stageAssignees,
            };
          }

          const prodId = meta.assigneeId ? String(meta.assigneeId) : null;
          const satId = meta.satelliteAssigneeId
            ? String(meta.satelliteAssigneeId)
            : null;

          // Exclusivo en UI: si hay producción, no mostrar satélite (y viceversa)
          if (prodId) {
            return {
              ...card,
              assigneeId: prodId,
              assignee: meta.assignee || "Sin asignar",
              satelliteAssigneeId: null,
              satelliteAssignee: "Sin asignar",
              stageAssignees: meta.stageAssignees || card.stageAssignees,
            };
          }
          if (satId) {
            return {
              ...card,
              assigneeId: null,
              assignee: "Sin asignar",
              satelliteAssigneeId: satId,
              satelliteAssignee: meta.satelliteAssignee || "Sin asignar",
              stageAssignees: meta.stageAssignees || card.stageAssignees,
            };
          }
          return {
            ...cleared,
            stageAssignees: meta.stageAssignees || card.stageAssignees,
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
            const resolvedStage = (
              syncAllToOrderStage
                ? stage
                : meta?.stage || card.stage || stage
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
      setProdOrders(transformed);
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
      const breakdown = computeRealCostFromCards(orderId, withLedger);
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
      return [...others, ...withLedger];
    });
  };

  const activeOrders = rawOrders.filter((o) => {
    if (o.estado === "delivered") return false;
    if (canManageBoard) return true;
    // Producción / Satélite: solo órdenes con tarjeta asignada a este usuario
    const myId = prodSession.userId;
    if (!myId) return false;
    const fromCards = prodOrders.some(
      (c) =>
        c.orderId === o.id &&
        (c.assigneeId === myId || c.satelliteAssigneeId === myId)
    );
    if (fromCards) return true;
    const asignaciones = o.kanban_asignaciones || {};
    return Object.values(asignaciones).some(
      (a) => a?.assigneeId === myId || a?.satelliteAssigneeId === myId
    );
  });
  const filteredProdOrders = prodOrders.filter((po) => {
    if (po.orderId !== selectedOrderId) return false;
    if (canManageBoard) return true;
    if (!prodSession.userId) return false;
    if (prodSession.isSatellite) {
      return po.satelliteAssigneeId === prodSession.userId;
    }
    if (prodSession.isProduction) {
      return po.assigneeId === prodSession.userId;
    }
    return false;
  });
  const selectedOrder = activeOrders.find((o) => o.id === selectedOrderId);

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
    setDragType("card");
    setDraggedCardId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCardDrop = (targetStage: string) => {
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

    // Operadores Kanban: solo a la capa siguiente, nunca saltar etapas
    if (
      !prodSession.unrestricted &&
      !canMoveCardToStage(stages, previousStage, targetStage)
    ) {
      const next = getNextStageKey(stages, previousStage);
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

    if (previousStage === targetStage) return;

    setPendingCardMove({
      cardId: movedCardId,
      orderId: card.orderId || null,
      fromStage: previousStage,
      toStage: targetStage,
    });
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
      // Congela costos de la capa saliente (atribuidos al usuario actual) y limpia campos vivos
      const prevLabel =
        stages.find((s) => s.key === previousStage)?.label || previousStage;
      const frozenCosts = freezeStageCostsOnMove(card, previousStage, prevLabel);

      // Al cambiar de capa se limpia Producción y Satélite: el admin reasigna
      const movedPatch = {
        ...frozenCosts,
        stage: targetStage as ProductionOrder["stage"],
        daysInStage: 0,
        assignee: "Sin asignar",
        assigneeId: null as string | null,
        satelliteAssignee: "Sin asignar",
        satelliteAssigneeId: null as string | null,
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
    setCardDialog({ open: true, mode: "add", stageKey });
  };

  const openEditCard = (card: ProductionOrder) => {
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
    setCardFormInitial(cardFormFromProductionOrder(card));
    setCardDialog({ open: true, mode: "edit", cardId: card.id, stageKey: card.stage });
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

    const alreadyDeducted = deductedMap(existingCard?.materialsDeducted);
    const orderRef = selectedOrderId
      ? `ORD-${selectedOrderId.slice(0, 8)} · Solicitud Kanban`
      : "Solicitud Kanban";

    const deltas: { materialId: string; materialName: string; quantity: number }[] = [];
    if (!targetStage || canRequestInventoryOnStage(targetStage)) {
      for (const mat of values.requestedMaterials) {
        const prevQty = alreadyDeducted.get(mat.materialId) || 0;
        const nextQty = Number(mat.quantity) || 0;
        const delta = nextQty - prevQty;
        if (delta > 0.0001) {
          deltas.push({
            materialId: mat.materialId,
            materialName: mat.materialName,
            quantity: delta,
          });
        }
      }
    }

    setSavingCard(true);
    const succeededDeltas: typeof deltas = [];
    try {
      for (const delta of deltas) {
        await removeStock({
          materialId: delta.materialId,
          quantity: delta.quantity,
          reference: orderRef,
          note: `Material solicitado en tarjeta: ${delta.materialName}`,
        });
        succeededDeltas.push(delta);
      }
    } catch (err) {
      if (succeededDeltas.length > 0) {
        const partial = new Map(alreadyDeducted);
        for (const d of succeededDeltas) {
          partial.set(d.materialId, (partial.get(d.materialId) || 0) + d.quantity);
        }
        const materialsDeductedPartial = Array.from(partial.entries()).map(
          ([materialId, quantity]) => ({ materialId, quantity })
        );
        if (existingCard) {
          setProdOrders((prev) =>
            prev.map((o) =>
              o.id === existingCard.id ? { ...o, materialsDeducted: materialsDeductedPartial } : o
            )
          );
        }
      }
      const message =
        err instanceof HttpError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo descontar el inventario.";
      toast({
        title: "Stock insuficiente o error al descontar",
        description: message,
        variant: "destructive",
      });
      setSavingCard(false);
      return;
    }

    const nextDeducted = new Map(alreadyDeducted);
    for (const mat of values.requestedMaterials) {
      const prevQty = nextDeducted.get(mat.materialId) || 0;
      const nextQty = Number(mat.quantity) || 0;
      nextDeducted.set(mat.materialId, Math.max(prevQty, nextQty));
    }
    const materialsDeducted = Array.from(nextDeducted.entries()).map(([materialId, quantity]) => ({
      materialId,
      quantity,
    }));

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

    const laborAndFiles = {
      laborCostEnabled: values.laborCostEnabled,
      laborCostPerUnit: values.laborCostEnabled ? laborCostPerUnit : null,
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

    if (deltas.length > 0) {
      toast({
        title: "Inventario actualizado",
        description: `Se descontaron ${deltas.length} material(es) del stock.`,
      });
    }

    setSavingCard(false);
    setCardDialog((d) => ({ ...d, open: false }));
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
              En el momento no tiene pedidos asignados
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
              {prodSession.isKanbanOperator
                ? "Cuando un administrador te asigne una tarjeta en Fábrica, el pedido aparecerá aquí."
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
        {stages.map((stage, stageIndex) => {
          const stageOrders = getOrdersForStage(stage.key);
          const isEditing = editingColKey === stage.key;
          const isOwnCapa =
            canManageBoard || userStageKeys.includes(stage.key);
          const draggedCard =
            dragType === "card" && draggedCardId
              ? prodOrders.find((o) => o.id === draggedCardId)
              : undefined;
          const nextOfDragged = draggedCard
            ? getNextStageKey(stages, draggedCard.stage)
            : null;
          const isValidDropTarget =
            canManageBoard ||
            (Boolean(draggedCard) &&
              canProductionUserActOnStage(prodSession, draggedCard!.stage) &&
              (stage.key === draggedCard!.stage || stage.key === nextOfDragged));
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
                {stageOrders.map((order) => {
                  const canOperate = canProductionUserOperateCard(prodSession, order);
                  const canSeeCapa = canProductionUserActOnStage(prodSession, order.stage);
                  const canEditCard = canOperate && canEditOnStage(order.stage);
                  const canInventoryCard =
                    canOperate && canRequestInventoryOnStage(order.stage);
                  const stageUsers = usersForStage(order.stage);
                  const stageSatUsers = satelliteUsersForStage(order.stage);
                  const needsAssign = !order.assigneeId && !order.satelliteAssigneeId;
                  const hasProductionAssignee = Boolean(order.assigneeId);
                  const hasSatelliteAssignee = Boolean(order.satelliteAssigneeId);
                  return (
                  <div
                    key={order.id}
                    draggable={canOperate}
                    onDragStart={(e) => handleCardDragStart(e, order.id)}
                    className={cn(
                      "bg-card rounded-lg border border-border p-3 hover:shadow-md transition-shadow relative group/card",
                      canOperate ? "cursor-grab" : "cursor-default opacity-90",
                      needsAssign && canManageBoard && "ring-1 ring-amber-300/80"
                    )}
                  >
                    {(canEditCard || canInventoryCard || canManageBoard) && (
                      <div className="absolute top-2 right-2 flex opacity-0 group-hover/card:opacity-100">
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
                      <Popover
                        open={assignOpenFor === order.id}
                        onOpenChange={(open) =>
                          setAssignOpenFor(open ? order.id : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full h-7 text-[10px] gap-1 mb-1"
                          >
                            <UserPlus className="h-3 w-3" />
                            {hasProductionAssignee || hasSatelliteAssignee
                              ? "Reasignar"
                              : "Asignar a"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 p-2" align="start">
                          <p className="text-[11px] text-muted-foreground px-1 mb-2">
                            Solo un tipo a la vez: Producción o Satélite.
                          </p>
                          <p className="text-xs font-medium mb-2 px-1">
                            Usuarios Producción · esta capa
                          </p>
                          {stageUsers.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground px-1 py-2">
                              No hay usuarios de Producción con esta capa.
                            </p>
                          ) : (
                            <div className="max-h-36 overflow-y-auto space-y-0.5 mb-2">
                              {stageUsers.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  className={cn(
                                    "w-full text-left text-xs rounded-md px-2 py-1.5 hover:bg-muted",
                                    order.assigneeId === u.id && "bg-muted font-medium"
                                  )}
                                  onClick={() =>
                                    assignCardToUser(order, u.id, u.name, "production")
                                  }
                                >
                                  {u.name}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="border-t border-border my-2" />
                          <p className="text-xs font-medium mb-2 px-1">
                            Usuarios Satélite · esta capa
                          </p>
                          {stageSatUsers.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground px-1 py-2">
                              No hay usuarios Satélite con esta capa. Créalos en
                              Administración.
                            </p>
                          ) : (
                            <div className="max-h-36 overflow-y-auto space-y-0.5">
                              {stageSatUsers.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  className={cn(
                                    "w-full text-left text-xs rounded-md px-2 py-1.5 hover:bg-muted",
                                    order.satelliteAssigneeId === u.id &&
                                      "bg-muted font-medium"
                                  )}
                                  onClick={() =>
                                    assignCardToUser(order, u.id, u.name, "satellite")
                                  }
                                >
                                  {u.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    ) : canSeeCapa && !canOperate ? (
                      <p className="text-[10px] text-amber-700 mb-1">
                        Pendiente de asignación por admin
                      </p>
                    ) : null}
                    {/* Taller externo: no mostrar si el responsable es Producción */}
                    {!hasProductionAssignee && order.satelliteName ? (
                      <p className="mt-1 text-[10px] font-medium text-red-700 truncate" title={order.satelliteName}>
                        Satélite: {order.satelliteName}
                      </p>
                    ) : null}
                  </div>
                  );
                })}
                {isOwnCapa && canManageBoard ? (
                  <button onClick={() => openAddCard(stage.key)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed text-xs hover:bg-card"><Plus className="h-3.5 w-3.5" /> Añadir tarjeta</button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <KanbanCardEditDialog
        open={cardDialog.open}
        mode={cardDialog.mode}
        initial={cardFormInitial}
        onOpenChange={(open) => setCardDialog((d) => ({ ...d, open }))}
        onSave={saveCard}
        saving={savingCard}
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

                  <div>
                    <h3 className="text-xs font-bold tracking-wide text-foreground uppercase mb-3">
                      Configuración de tarjetas
                    </h3>
                    {filteredProdOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No hay tarjetas Kanban configuradas para este pedido.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {filteredProdOrders.map((card) => {
                          const laborTotal =
                            (Number(card.quantity) || 0) * (Number(card.laborCostPerUnit) || 0);
                          return (
                            <div
                              key={card.id}
                              className="rounded-xl border border-border p-3.5 space-y-3"
                            >
                              <div>
                                <p className="text-sm font-semibold text-foreground">{card.items}</p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                  <KanbanStageChip
                                    stageKey={card.stage}
                                    label={stageLabels[card.stage] || card.stage}
                                    className="text-[10px] px-2 py-0.5"
                                  />
                                  {card.assignee ? <span>· {card.assignee}</span> : null}
                                  {card.quantity ? <span>· {card.quantity} uds</span> : null}
                                  {card.dueDate ? <span>· entrega {card.dueDate}</span> : null}
                                </div>
                              </div>

                              <div className="space-y-2 text-xs">
                                <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
                                  <p className="font-semibold inline-flex items-center gap-1.5">
                                    <Boxes className="h-3.5 w-3.5 text-red-600" />
                                    Materiales solicitados
                                  </p>
                                  {(card.requestedMaterials || []).length === 0 ? (
                                    <p className="text-muted-foreground">Sin materiales.</p>
                                  ) : (
                                    <ul className="space-y-0.5 text-muted-foreground">
                                      {card.requestedMaterials!.map((m) => (
                                        <li key={m.materialId}>
                                          {m.materialName} × {m.quantity}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>

                                <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
                                  <p className="font-semibold inline-flex items-center gap-1.5">
                                    <Scissors className="h-3.5 w-3.5 text-red-600" />
                                    Moldería
                                  </p>
                                  {!card.moldEnabled ? (
                                    <p className="text-muted-foreground">No activada.</p>
                                  ) : (
                                    <div className="text-muted-foreground space-y-0.5">
                                      <p>
                                        Estado:{" "}
                                        {MOLD_STATUS_LABELS[card.moldStatus || ""] ||
                                          card.moldStatus ||
                                          "—"}
                                      </p>
                                      {card.moldResponsible ? (
                                        <p>Responsable: {card.moldResponsible}</p>
                                      ) : null}
                                      {card.moldSizes ? <p>Tallas: {card.moldSizes}</p> : null}
                                      {card.moldCost != null ? (
                                        <p>Costo: {formatMoneyCop(Number(card.moldCost))}</p>
                                      ) : null}
                                      {card.moldNotes ? <p>Notas: {card.moldNotes}</p> : null}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
                                  <p className="font-semibold inline-flex items-center gap-1.5">
                                    <DollarSign className="h-3.5 w-3.5 text-red-600" />
                                    Mano de obra
                                  </p>
                                  {!card.laborCostEnabled ? (
                                    <p className="text-muted-foreground">No activada.</p>
                                  ) : (
                                    <div className="text-muted-foreground space-y-0.5">
                                      <p>
                                        Costo/ud:{" "}
                                        {formatMoneyCop(Number(card.laborCostPerUnit) || 0)}
                                      </p>
                                      <p>Total estimado: {formatMoneyCop(laborTotal)}</p>
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
                                  <p className="font-semibold inline-flex items-center gap-1.5">
                                    <Factory className="h-3.5 w-3.5 text-red-600" />
                                    Satélite
                                  </p>
                                  {!card.satelliteName ? (
                                    <p className="text-muted-foreground">Sin satélite.</p>
                                  ) : (
                                    <div className="text-muted-foreground space-y-0.5">
                                      <p>{card.satelliteName}</p>
                                      {card.satelliteCost != null ? (
                                        <p>Costo: {formatMoneyCop(Number(card.satelliteCost))}</p>
                                      ) : null}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
                                  <p className="font-semibold inline-flex items-center gap-1.5">
                                    <ImagePlus className="h-3.5 w-3.5 text-red-600" />
                                    Imágenes
                                  </p>
                                  {(card.cardImages || []).length === 0 ? (
                                    <p className="text-muted-foreground">Sin imágenes.</p>
                                  ) : (
                                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                                      {card.cardImages!.map((img) => (
                                        <a
                                          key={img.id}
                                          href={img.dataUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="block rounded border overflow-hidden"
                                          title={img.name}
                                        >
                                          <img
                                            src={img.dataUrl}
                                            alt={img.name}
                                            className="h-14 w-full object-cover"
                                          />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
                                  <p className="font-semibold inline-flex items-center gap-1.5">
                                    <Paperclip className="h-3.5 w-3.5 text-red-600" />
                                    Archivos adjuntos
                                  </p>
                                  {(card.cardFiles || []).length === 0 ? (
                                    <p className="text-muted-foreground">Sin archivos.</p>
                                  ) : (
                                    <ul className="space-y-1">
                                      {card.cardFiles!.map((file) => (
                                        <li key={file.id}>
                                          <a
                                            href={file.dataUrl}
                                            download={file.name}
                                            className="inline-flex items-center gap-1.5 text-red-600 hover:underline"
                                          >
                                            <FileText className="h-3 w-3" />
                                            <span className="truncate">{file.name}</span>
                                            <span className="text-muted-foreground">
                                              ({formatBytes(file.size)})
                                            </span>
                                          </a>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>

                                <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
                                  <p className="font-semibold inline-flex items-center gap-1.5">
                                    <MessageSquare className="h-3.5 w-3.5 text-red-600" />
                                    Novedades
                                    {(card.novedades || []).length > 0 ? (
                                      <span className="font-normal text-muted-foreground">
                                        ({card.novedades!.length})
                                      </span>
                                    ) : null}
                                  </p>
                                  {(card.novedades || []).length === 0 ? (
                                    <p className="text-muted-foreground">Sin novedades.</p>
                                  ) : (
                                    <ul className="space-y-2">
                                      {card.novedades!.map((n) => (
                                        <li key={n.id} className="space-y-0.5">
                                          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                                            <span className="font-medium text-foreground/80 truncate">
                                              {n.autorNombre || "Usuario"}
                                            </span>
                                            <span className="shrink-0">
                                              {n.createdAt
                                                ? new Date(n.createdAt).toLocaleString("es-CO", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                  })
                                                : ""}
                                            </span>
                                          </div>
                                          <p className="text-muted-foreground whitespace-pre-wrap">
                                            {n.texto}
                                          </p>
                                          {((n.images || []).length > 0 ||
                                            (n.files || []).length > 0) && (
                                            <p className="text-[10px] text-muted-foreground">
                                              Evidencia: {(n.images || []).length} imagen(es),{" "}
                                              {(n.files || []).length} archivo(s)
                                            </p>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  {(card.novedades || []).length > 0 ? (
                                    <button
                                      type="button"
                                      className="text-[11px] font-medium text-red-600 hover:underline"
                                      onClick={() => setNovedadesCard(card)}
                                    >
                                      Abrir novedades
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
    </AppLayout>
  );
}