import type { Order } from "@/hooks/useOrders";
import type { Satellite, SatelliteSettlement } from "@/hooks/useSatellites";
import type { ProductionOrder } from "@/data/mockData";
import type { PedidoCompra } from "@/types/tns";
import {
  buildSatelliteOrderDetails,
  formatMoneyCop,
  laborAmountForUsers,
  summarizeSatelliteOrders,
  workStatusLabel,
  type SatelliteOrderDetail,
  type SatelliteWorkshop,
} from "@/lib/satellite-dashboard";
import { parseStageKeys } from "@/lib/production-capa-permissions";

export type StoredSatelliteUser = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  area: string;
  cargo: string;
  satelliteId: string | null;
  stageKeys: string[];
  roles: string[];
  isSatellite: boolean;
};

export type SatelliteUserAlert = {
  id: string;
  shortId: string;
  customerName: string;
  description: string;
  daysLate: number;
  dueDate: string | null;
  stageLabel: string;
};

export type SatelliteStageActivity = {
  stageKey: string;
  stageLabel: string;
  /** Resumen de lo realizado en esa capa */
  actions: string[];
  laborAmount: number;
  materials: { name: string; quantity: number }[];
  novedadesCount: number;
  isCurrent: boolean;
  updatedAt: string | null;
};

export type SatelliteOrderHistory = {
  orderId: string;
  orderCode: string;
  customerName: string;
  description: string;
  quantity: number;
  orderStatus: string;
  paymentStatus: "pending" | "paid";
  workStatus: SatelliteOrderDetail["workStatus"];
  totalLabor: number;
  stages: SatelliteStageActivity[];
};

export type SatelliteUserPanelData = {
  user: StoredSatelliteUser;
  workshopName: string | null;
  assignedOrders: number;
  pendingOrders: number;
  debtPending: number;
  paidTotal: number;
  confirmComplete: number;
  confirmMissing: number;
  confirmInProgress: number;
  orders: SatelliteOrderDetail[];
  alerts: SatelliteUserAlert[];
  orderHistory: SatelliteOrderHistory[];
};

function normalizeRole(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  const m = s.match(/name=['"]([^'"]+)['"]/);
  return (m?.[1] || s).trim();
}

export function readStoredSatelliteUser(): StoredSatelliteUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw) as Record<string, unknown>;
    const roles = (Array.isArray(u.roles) ? u.roles : [])
      .map(normalizeRole)
      .filter(Boolean);
    const isSatellite = roles.includes("Satélite");
    if (!isSatellite) return null;

    const firstName = String(u.first_name || "").trim();
    const lastName = String(u.last_name || "").trim();
    const fullName =
      `${firstName} ${lastName}`.trim() || String(u.username || "Usuario satélite");

    return {
      id: String(u.id || "").trim(),
      username: String(u.username || ""),
      email: String(u.email || ""),
      firstName,
      lastName,
      fullName,
      phone: String(u.phone || ""),
      area: String(u.area || ""),
      cargo: String(u.cargo || ""),
      satelliteId: u.satellite_id ? String(u.satellite_id) : null,
      stageKeys: parseStageKeys(
        Array.isArray(u.production_stage_keys)
          ? u.production_stage_keys
          : u.production_stage_key
      ),
      roles,
      isSatellite: true,
    };
  } catch {
    return null;
  }
}

function daysLate(dueDate: string | null | undefined, orderStatus: string): number {
  if (!dueDate || orderStatus === "delivered") return 0;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function userParticipatedInStage(
  card: ProductionOrder,
  userId: string,
  stageKey: string
): boolean {
  if (!stageKey) return false;
  const assignees = card.stageAssignees || {};
  if (assignees[`${stageKey}__satellite`]?.userId === userId) return true;
  if (
    assignees[stageKey]?.userId === userId &&
    assignees[stageKey]?.kind === "satellite"
  ) {
    return true;
  }
  if (card.satelliteAssigneeId === userId && card.stage === stageKey) return true;
  return (card.costLedger || []).some(
    (e) => e.userId === userId && e.stage === stageKey
  );
}

function collectUserStagesForCard(
  card: ProductionOrder,
  userId: string,
  stageLabels: Record<string, string>
): Map<string, SatelliteStageActivity> {
  const byStage = new Map<string, SatelliteStageActivity>();

  const ensure = (stageKey: string): SatelliteStageActivity => {
    const existing = byStage.get(stageKey);
    if (existing) return existing;
    const created: SatelliteStageActivity = {
      stageKey,
      stageLabel: stageLabels[stageKey] || stageKey || "Sin etapa",
      actions: [],
      laborAmount: 0,
      materials: [],
      novedadesCount: 0,
      isCurrent: false,
      updatedAt: null,
    };
    byStage.set(stageKey, created);
    return created;
  };

  for (const [key, entry] of Object.entries(card.stageAssignees || {})) {
    if (!entry?.userId || entry.userId !== userId) continue;
    const isSatelliteSlot =
      key.endsWith("__satellite") || entry.kind === "satellite";
    if (!isSatelliteSlot) continue;
    const stageKey = key.replace(/__satellite$/, "");
    const activity = ensure(stageKey);
    if (!activity.actions.includes("Asignado a la capa")) {
      activity.actions.push("Asignado a la capa");
    }
  }

  if (card.satelliteAssigneeId === userId && card.stage) {
    const activity = ensure(card.stage);
    activity.isCurrent = true;
    if (!activity.actions.includes("Responsable actual")) {
      activity.actions.push("Responsable actual");
    }
  }

  for (const entry of card.costLedger || []) {
    if (!entry.userId || entry.userId !== userId) continue;
    const stageKey = entry.stage || card.stage || "";
    if (!stageKey) continue;
    const activity = ensure(stageKey);
    if (entry.category === "labor") {
      activity.laborAmount += Number(entry.amount) || 0;
      if (!activity.actions.includes("Registró mano de obra")) {
        activity.actions.push("Registró mano de obra");
      }
    } else if (entry.category === "materials") {
      if (!activity.actions.includes("Solicitó / usó materiales")) {
        activity.actions.push("Solicitó / usó materiales");
      }
    } else if (entry.category === "mold") {
      if (!activity.actions.includes("Registró moldería")) {
        activity.actions.push("Registró moldería");
      }
    } else if (entry.label) {
      const label = `Registró: ${entry.label}`;
      if (!activity.actions.includes(label)) activity.actions.push(label);
    }
    if (entry.updatedAt) {
      if (!activity.updatedAt || entry.updatedAt > activity.updatedAt) {
        activity.updatedAt = entry.updatedAt;
      }
    }
  }

  if (card.satelliteAssigneeId === userId && card.laborCostEnabled && card.stage) {
    const activity = ensure(card.stage);
    const live =
      (Number(card.quantity) || 0) * (Number(card.laborCostPerUnit) || 0);
    const hasLedgerLabor = (card.costLedger || []).some(
      (e) =>
        e.userId === userId && e.stage === card.stage && e.category === "labor"
    );
    if (!hasLedgerLabor && live > 0) {
      activity.laborAmount += live;
      if (!activity.actions.includes("Registró mano de obra")) {
        activity.actions.push("Registró mano de obra");
      }
    }
  }

  if (card.satelliteAssigneeId === userId && card.stage) {
    const mats = card.requestedMaterials || [];
    if (mats.length) {
      const activity = ensure(card.stage);
      for (const m of mats) {
        activity.materials.push({
          name: m.materialName,
          quantity: Number(m.quantity) || 0,
        });
      }
      if (!activity.actions.includes("Solicitó / usó materiales")) {
        activity.actions.push("Solicitó / usó materiales");
      }
    }
  }

  const userNotes = (card.novedades || []).filter((n) => n.autorId === userId);
  if (userNotes.length) {
    const targetStage =
      card.satelliteAssigneeId === userId && card.stage
        ? card.stage
        : [...byStage.keys()][0] || card.stage || "design";
    if (userParticipatedInStage(card, userId, targetStage) || byStage.size === 0) {
      const activity = ensure(targetStage);
      activity.novedadesCount += userNotes.length;
      if (!activity.actions.includes("Dejó novedad / evidencia")) {
        activity.actions.push("Dejó novedad / evidencia");
      }
      for (const n of userNotes) {
        if (n.createdAt && (!activity.updatedAt || n.createdAt > activity.updatedAt)) {
          activity.updatedAt = n.createdAt;
        }
      }
    }
  }

  if (card.satelliteAssigneeId === userId && card.stage) {
    const imgs = (card.cardImages || []).length;
    const files = (card.cardFiles || []).length;
    if (imgs + files > 0) {
      const activity = ensure(card.stage);
      if (!activity.actions.includes("Adjuntó imágenes / archivos")) {
        activity.actions.push("Adjuntó imágenes / archivos");
      }
    }
  }

  return byStage;
}

export function buildSatelliteOrderHistory(params: {
  userId: string;
  orders: Order[];
  stageLabels: Record<string, string>;
  orderDetails: SatelliteOrderDetail[];
}): SatelliteOrderHistory[] {
  const { userId, orderDetails } = params;
  if (!userId) return [];

  const history: SatelliteOrderHistory[] = [];

  for (const detail of orderDetails || []) {
    const stages: SatelliteStageActivity[] = (detail.stagesWorked || []).map((s) => ({
      stageKey: s.stageKey,
      stageLabel: s.stageLabel,
      actions: s.actions && s.actions.length > 0 ? s.actions : ["Asignado a la capa"],
      laborAmount: s.laborAmount,
      materials: s.materials || [],
      novedadesCount: s.novedadesCount || 0,
      isCurrent: Boolean(s.isCurrent),
      updatedAt: s.updatedAt || null,
    }));

    const totalLabor =
      detail.agreedCost != null && Number.isFinite(detail.agreedCost)
        ? detail.agreedCost
        : stages.reduce((sum, st) => sum + st.laborAmount, 0) || detail.cost;

    history.push({
      orderId: detail.orderId,
      orderCode: detail.orderCode,
      customerName: detail.customerName,
      description: detail.description,
      quantity: detail.quantity,
      orderStatus: detail.orderStatus,
      paymentStatus: detail.paymentStatus,
      workStatus: detail.workStatus,
      totalLabor,
      stages,
    });
  }

  return history;
}

export function buildSatelliteUserPanel(params: {
  user: StoredSatelliteUser;
  orders: Order[];
  stageLabels: Record<string, string>;
  workshop: Satellite | SatelliteWorkshop | null;
  tnsPedidos?: PedidoCompra[];
}): SatelliteUserPanelData {
  const { user, orders, stageLabels, workshop, tnsPedidos = [] } = params;
  const settlements: Record<string, SatelliteSettlement> = workshop?.settlements || {};

  const workshopRef: SatelliteWorkshop = workshop
    ? {
        id: workshop.id,
        name: workshop.name,
        nit: (workshop as Record<string, unknown>).nit as string || (workshop as Record<string, unknown>).nit_tercero as string || "",
        contact_name: workshop.contact_name || user.fullName,
        phone: workshop.phone || user.phone || "",
        address: workshop.address || "",
        specialties: workshop.specialties || user.stageKeys || [],
        notes: workshop.notes || "",
        status: workshop.status || "active",
        payment_status: workshop.payment_status || "al_dia",
        settlements,
      }
    : {
        id: user.satelliteId || user.id,
        name: user.fullName,
        contact_name: user.fullName,
        phone: user.phone || "",
        address: "",
        specialties: user.stageKeys || [],
        notes: "",
        status: "active",
        payment_status: "al_dia",
        settlements,
      };

  const orderDetails = buildSatelliteOrderDetails({
    userIds: user.id ? [user.id] : [],
    orders,
    stageLabels,
    settlements,
    workshopId: workshopRef.id,
    userNamesById: user.id ? { [user.id]: user.fullName } : {},
    workshop: workshopRef,
    tnsPedidos,
  });

  const summary = summarizeSatelliteOrders(orderDetails);

  let confirmComplete = 0;
  let confirmMissing = 0;
  let confirmInProgress = 0;
  for (const d of orderDetails) {
    if (d.workStatus === "recibido_completo") confirmComplete += 1;
    else if (d.workStatus === "recibido_faltantes") confirmMissing += 1;
    else confirmInProgress += 1;
  }

  const alerts: SatelliteUserAlert[] = orderDetails
    .map((d) => {
      // Excluir órdenes de TNS y órdenes que ya están pagadas o entregadas
      if (
        d.source === "tns" ||
        d.orderCode.startsWith("PED-") ||
        d.paymentStatus === "paid" ||
        d.orderStatus === "delivered"
      ) {
        return null;
      }
      const late = daysLate(d.dueDate || null, d.orderStatus);
      if (late <= 0) return null;
      return {
        id: d.orderId,
        shortId: d.orderCode,
        customerName: d.customerName,
        description: d.description,
        daysLate: late,
        dueDate: d.dueDate || null,
        stageLabel: d.stageLabel,
      };
    })
    .filter((a): a is SatelliteUserAlert => Boolean(a));

  const orderHistory = buildSatelliteOrderHistory({
    userId: user.id,
    orders,
    stageLabels,
    orderDetails,
  });

  return {
    user,
    workshopName: workshop?.name || workshopRef.name || null,
    assignedOrders: orderDetails.length,
    pendingOrders: summary.ordenesActivas,
    debtPending: summary.porPagar,
    paidTotal: summary.pagado,
    confirmComplete,
    confirmMissing,
    confirmInProgress,
    orders: orderDetails,
    alerts,
    orderHistory,
  };
}

export { formatMoneyCop, workStatusLabel };
