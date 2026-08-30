import type { Order } from "@/hooks/useOrders";
import type { ProductionOrder } from "@/data/mockData";
import { formatMoneyCop } from "@/lib/satellite-dashboard";
import { parseStageKeys, cardAssignedToOperatorOnAllowedStage, type ProductionSession } from "@/lib/production-capa-permissions";

export type StoredProductionUser = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  area: string;
  cargo: string;
  stageKeys: string[];
  roles: string[];
  isProduction: boolean;
};

export type ProductionUserAlert = {
  id: string;
  shortId: string;
  customerName: string;
  description: string;
  daysLate: number;
  dueDate: string | null;
  stageLabel: string;
};

export type ProductionStageActivity = {
  stageKey: string;
  stageLabel: string;
  actions: string[];
  laborAmount: number;
  materials: { name: string; quantity: number }[];
  novedadesCount: number;
  isCurrent: boolean;
  updatedAt: string | null;
  paymentStatus: "pending" | "paid";
};

/** Estado de pago de MO por capa dentro de un pedido */
export type ProductionStagePayment = {
  stageKey: string;
  stageLabel: string;
  cost: number;
  paymentStatus: "pending" | "paid";
  inWork: boolean;
};

export type ProductionOrderDetail = {
  orderId: string;
  orderCode: string;
  customerName: string;
  description: string;
  quantity: number;
  dueDate: string;
  stageKey: string;
  stageLabel: string;
  orderStatus: string;
  cost: number;
  /** true si el usuario es responsable actual de alguna tarjeta */
  inWork: boolean;
  paymentStatus: "pending" | "paid";
  /** Desglose de MO y pago por cada capa del pedido */
  stagePayments: ProductionStagePayment[];
  cardIds: string[];
};

export type ProductionOrderHistory = {
  orderId: string;
  orderCode: string;
  customerName: string;
  description: string;
  quantity: number;
  orderStatus: string;
  inWork: boolean;
  paymentStatus: "pending" | "paid";
  totalLabor: number;
  stages: ProductionStageActivity[];
};

export type ProductionUserPanelData = {
  user: StoredProductionUser;
  assignedOrders: number;
  pendingOrders: number;
  debtPending: number;
  ordersInWork: number;
  orders: ProductionOrderDetail[];
  alerts: ProductionUserAlert[];
  orderHistory: ProductionOrderHistory[];
};

function normalizeRole(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  const m = s.match(/name=['"]([^'"]+)['"]/);
  return (m?.[1] || s).trim();
}

export function readStoredProductionUser(): StoredProductionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw) as Record<string, unknown>;
    const roles = (Array.isArray(u.roles) ? u.roles : [])
      .map(normalizeRole)
      .filter(Boolean);
    const isProduction = roles.includes("Producción");
    const isSatellite = roles.includes("Satélite");
    // Satélite tiene su propio panel; no mezclar.
    if (!isProduction || isSatellite) return null;

    const firstName = String(u.first_name || "").trim();
    const lastName = String(u.last_name || "").trim();
    const fullName =
      `${firstName} ${lastName}`.trim() || String(u.username || "Usuario producción");

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
      stageKeys: parseStageKeys(
        Array.isArray(u.production_stage_keys)
          ? u.production_stage_keys
          : u.production_stage_key
      ),
      roles,
      isProduction: true,
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

function collectCardsFromOrders(orders: Order[]): {
  card: ProductionOrder;
  order: Order;
}[] {
  const rows: { card: ProductionOrder; order: Order }[] = [];
  for (const order of orders) {
    const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
    for (const card of cards) {
      rows.push({ card, order });
    }
  }
  return rows;
}

function orderDescription(order: Order, cards: ProductionOrder[]): string {
  const fromCards = cards
    .map((c) => (c.items || "").trim())
    .filter(Boolean);
  if (fromCards.length) return [...new Set(fromCards)].join(" · ");
  const items = order.items || [];
  if (!items.length) return order.producto_nombre || "Pedido";
  const labels = items.map((it) => {
    const name = it.subproducto_nombre || it.producto_nombre || "Ítem";
    return `${name} × ${it.cantidad}`;
  });
  return labels.slice(0, 3).join(" · ");
}

function productionSessionForUser(user: StoredProductionUser): ProductionSession {
  return {
    roles: user.roles,
    isAdmin: false,
    isProduction: user.isProduction,
    isSatellite: false,
    isKanbanOperator: user.isProduction,
    stageKey: user.stageKeys[0] || null,
    stageKeys: user.stageKeys,
    userId: user.id,
    unrestricted: false,
  };
}

function cardVisibleToProductionUser(
  card: ProductionOrder,
  user: StoredProductionUser
): boolean {
  if (!cardAssignedToProductionUser(card, user.id)) return false;
  if (user.stageKeys.length === 0) return false;
  return cardAssignedToOperatorOnAllowedStage(productionSessionForUser(user), card);
}

function cardAssignedToProductionUser(card: ProductionOrder, userId: string): boolean {
  if (!userId) return false;
  if (card.assigneeId && String(card.assigneeId) === userId) return true;
  const stageAssignees = card.stageAssignees || {};
  for (const [key, entry] of Object.entries(stageAssignees)) {
    if (!entry?.userId || String(entry.userId) !== userId) continue;
    if (key.endsWith("__satellite") || entry.kind === "satellite") continue;
    if (!entry.kind || entry.kind === "production") return true;
  }
  if ((card.costLedger || []).some((e) => e.userId === userId)) return true;
  return false;
}

function isCurrentProductionAssignee(card: ProductionOrder, userId: string): boolean {
  return Boolean(card.assigneeId && String(card.assigneeId) === userId);
}

export function laborAmountForProductionUser(
  card: ProductionOrder,
  userId: string
): number {
  if (!userId) return 0;
  let total = 0;
  const ledgerStages = new Set<string>();

  for (const entry of card.costLedger || []) {
    if (entry.category !== "labor") continue;
    if (!entry.userId || String(entry.userId) !== userId) continue;
    total += Number(entry.amount) || 0;
    if (entry.stage) ledgerStages.add(`${entry.userId}:${entry.stage}`);
  }

  if (card.laborCostEnabled && card.assigneeId && String(card.assigneeId) === userId) {
    const key = `${card.assigneeId}:${card.stage}`;
    if (!ledgerStages.has(key)) {
      total += (Number(card.quantity) || 0) * (Number(card.laborCostPerUnit) || 0);
    }
  }

  return total;
}

function userParticipatedInStage(
  card: ProductionOrder,
  userId: string,
  stageKey: string
): boolean {
  if (!stageKey) return false;
  const assignees = card.stageAssignees || {};
  const entry = assignees[stageKey];
  if (
    entry?.userId === userId &&
    entry.kind !== "satellite" &&
    !String(stageKey).endsWith("__satellite")
  ) {
    return true;
  }
  if (card.assigneeId === userId && card.stage === stageKey) return true;
  return (card.costLedger || []).some(
    (e) => e.userId === userId && e.stage === stageKey
  );
}

function collectUserStagesForCard(
  card: ProductionOrder,
  userId: string,
  stageLabels: Record<string, string>,
  order?: Order | null
): Map<string, ProductionStageActivity> {
  const byStage = new Map<string, ProductionStageActivity>();

  const totalQty =
    Number(card.quantity) ||
    order?.items?.reduce((s, it) => s + (Number(it.cantidad) || 0), 0) ||
    0;

  // Extraer desglose de tallas
  const tallasMap = new Map<string, number>();
  if (card.variants && card.variants.length > 0) {
    for (const v of card.variants) {
      if (v.tallas && v.tallas.length > 0) {
        for (const t of v.tallas) {
          if (t.nombre && t.nombre !== "—") {
            tallasMap.set(t.nombre, (tallasMap.get(t.nombre) || 0) + (Number(t.cantidad) || 0));
          }
        }
      } else if (v.size && v.size !== "—") {
        tallasMap.set(v.size, (tallasMap.get(v.size) || 0) + (Number(v.quantity) || 0));
      }
    }
  } else if (order?.items && order.items.length > 0) {
    for (const it of order.items) {
      const tName = (it.talla_nombre || (it as any).talla || "").trim();
      if (tName && tName !== "—") {
        tallasMap.set(tName, (tallasMap.get(tName) || 0) + (Number(it.cantidad) || 0));
      }
    }
  }

  const tallasSummary = Array.from(tallasMap.entries())
    .map(([talla, cant]) => `${talla}: ${cant} uds`)
    .join(" · ");

  const prendaName =
    card.items ||
    order?.items?.map((i) => i.subproducto_nombre || i.producto_nombre).filter(Boolean).join(", ") ||
    order?.descripcion_resumida ||
    null;

  const isStageReq = (sKey: string) => {
    const k = sKey.toLowerCase();
    if (card.hasBordado === false && (k.includes("bordad") || k === "embroidery")) return false;
    if ((card as any)?.hasEstampado === false && (k.includes("estampad") || k === "printing")) return false;
    return true;
  };

  const ensure = (stageKey: string): ProductionStageActivity => {
    const cleanKey = stageKey.replace(/__satellite$/, "").replace(/__production$/, "");
    const existing = byStage.get(cleanKey);
    if (existing) return existing;

    const stageCfg = card.stageLaborConfig?.[cleanKey] || card.stageLaborConfig?.[stageKey];
    let unitVal: number | null = null;
    if (stageCfg?.enabled && stageCfg.perUnit != null && Number(stageCfg.perUnit) > 0) {
      unitVal = Number(stageCfg.perUnit);
    } else if (card.stage === cleanKey && card.laborCostEnabled && card.laborCostPerUnit != null) {
      unitVal = Number(card.laborCostPerUnit);
    }

    const actions: string[] = [];
    if (prendaName) {
      actions.push(`Prenda: ${prendaName}`);
    }
    if (totalQty > 0) {
      actions.push(`Cantidad total: ${totalQty} prendas`);
    }
    if (unitVal != null && unitVal > 0) {
      actions.push(`Valor unitario por prenda: $${unitVal.toLocaleString("es-CO")}`);
    }
    if (tallasSummary) {
      actions.push(`Tallas y cantidades: ${tallasSummary}`);
    }

    const created: ProductionStageActivity = {
      stageKey: cleanKey,
      stageLabel: stageLabels[cleanKey] || cleanKey || "Sin etapa",
      actions,
      laborAmount: 0,
      materials: [],
      novedadesCount: 0,
      isCurrent: false,
      updatedAt: null,
      // Sin liquidación de producción aún: MO queda por pagar.
      paymentStatus: "pending",
    };
    byStage.set(cleanKey, created);
    return created;
  };

  for (const [key, entry] of Object.entries(card.stageAssignees || {})) {
    if (!entry?.userId || entry.userId !== userId) continue;
    if (key.endsWith("__satellite") || entry.kind === "satellite") continue;
    const stageKey = key.replace(/__satellite$/, "");
    if (!isStageReq(stageKey)) continue;
    const activity = ensure(stageKey);
    const stageCfg = card.stageLaborConfig?.[stageKey] || card.stageLaborConfig?.[key];
    if (stageCfg?.enabled && stageCfg.perUnit != null) {
      const live = totalQty * Number(stageCfg.perUnit);
      if (live > 0 && activity.laborAmount === 0) {
        activity.laborAmount = live;
      }
    }
  }

  if (card.assigneeId === userId && card.stage && isStageReq(card.stage)) {
    const activity = ensure(card.stage);
    activity.isCurrent = true;
  }

  for (const entry of card.costLedger || []) {
    if (!entry.userId || entry.userId !== userId) continue;
    const stageKey = entry.stage || card.stage || "";
    if (!stageKey || !isStageReq(stageKey)) continue;
    const activity = ensure(stageKey);
    if (entry.category === "labor") {
      activity.laborAmount += Number(entry.amount) || 0;
    }
    if (entry.updatedAt) {
      if (!activity.updatedAt || entry.updatedAt > activity.updatedAt) {
        activity.updatedAt = entry.updatedAt;
      }
    }
  }

  if (card.assigneeId === userId && card.laborCostEnabled && card.stage && isStageReq(card.stage)) {
    const activity = ensure(card.stage);
    const live =
      (Number(card.quantity) || 0) * (Number(card.laborCostPerUnit) || 0);
    const hasLedgerLabor = (card.costLedger || []).some(
      (e) =>
        e.userId === userId && e.stage === card.stage && e.category === "labor"
    );
    if (!hasLedgerLabor && live > 0) {
      activity.laborAmount += live;
    }
  }

  if (card.assigneeId === userId && card.stage && isStageReq(card.stage)) {
    const mats = card.requestedMaterials || [];
    if (mats.length) {
      const activity = ensure(card.stage);
      for (const m of mats) {
        activity.materials.push({
          name: m.materialName,
          quantity: Number(m.quantity) || 0,
        });
      }
    }
  }

  const userNotes = (card.novedades || []).filter((n) => n.autorId === userId);
  if (userNotes.length) {
    const targetStage =
      card.assigneeId === userId && card.stage
        ? card.stage
        : [...byStage.keys()][0] || card.stage || "design";
    if (userParticipatedInStage(card, userId, targetStage) || byStage.size === 0) {
      const activity = ensure(targetStage);
      activity.novedadesCount += userNotes.length;
      for (const n of userNotes) {
        if (n.createdAt && (!activity.updatedAt || n.createdAt > activity.updatedAt)) {
          activity.updatedAt = n.createdAt;
        }
      }
    }
  }

  return byStage;
}

export function buildProductionOrderDetails(params: {
  user: StoredProductionUser;
  orders: Order[];
  stageLabels: Record<string, string>;
}): ProductionOrderDetail[] {
  const { user, orders, stageLabels } = params;
  const userId = user.id;
  if (!userId) return [];

  const byOrder = new Map<
    string,
    {
      order: Order;
      cards: ProductionOrder[];
      cost: number;
      inWork: boolean;
    }
  >();

  for (const { card, order } of collectCardsFromOrders(orders)) {
    if (!cardVisibleToProductionUser(card, user)) continue;
    const existing = byOrder.get(order.id);
    const labor = laborAmountForProductionUser(card, userId);
    const inWork =
      isCurrentProductionAssignee(card, userId) && order.estado !== "delivered";
    if (existing) {
      existing.cards.push(card);
      existing.cost += labor;
      existing.inWork = existing.inWork || inWork;
    } else {
      byOrder.set(order.id, { order, cards: [card], cost: labor, inWork });
    }
  }

  const details: ProductionOrderDetail[] = [];

  for (const [orderId, row] of byOrder) {
    const primary =
      row.cards.find((c) => c.assigneeId && String(c.assigneeId) === userId) ||
      row.cards[0];
    const stageKey = primary?.stage || row.order.etapa_produccion || "";
    const qty =
      row.cards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0) ||
      row.order.items?.reduce((s, it) => s + (Number(it.cantidad) || 0), 0) ||
      0;

    const stageMap = new Map<string, ProductionStagePayment>();
    for (const card of row.cards) {
      const stages = collectUserStagesForCard(card, userId, stageLabels);
      for (const [key, activity] of stages) {
        const existing = stageMap.get(key);
        const inWork =
          activity.isCurrent && row.order.estado !== "delivered";
        if (existing) {
          existing.cost += activity.laborAmount;
          existing.inWork = existing.inWork || inWork;
        } else {
          stageMap.set(key, {
            stageKey: key,
            stageLabel: activity.stageLabel,
            cost: activity.laborAmount,
            paymentStatus: activity.paymentStatus,
            inWork,
          });
        }
      }
      // Si no hubo actividad de capas pero hay MO en la tarjeta actual
      if (stages.size === 0 && card.stage) {
        const key = card.stage;
        const labor = laborAmountForProductionUser(card, userId);
        const existing = stageMap.get(key);
        const inWork =
          isCurrentProductionAssignee(card, userId) &&
          row.order.estado !== "delivered";
        if (existing) {
          existing.cost += labor;
          existing.inWork = existing.inWork || inWork;
        } else {
          stageMap.set(key, {
            stageKey: key,
            stageLabel: stageLabels[key] || key || "Sin etapa",
            cost: labor,
            paymentStatus: "pending",
            inWork,
          });
        }
      }
    }

    const stagePayments = [...stageMap.values()].sort((a, b) => {
      if (a.inWork !== b.inWork) return a.inWork ? -1 : 1;
      return a.stageLabel.localeCompare(b.stageLabel);
    });

    if (stagePayments.length === 0 && stageKey) {
      stagePayments.push({
        stageKey,
        stageLabel: stageLabels[stageKey] || stageKey || "Sin etapa",
        cost: row.cost,
        paymentStatus: "pending",
        inWork: row.inWork,
      });
    }

    const costFromStages = stagePayments.reduce((s, st) => s + st.cost, 0);
    const cost = costFromStages > 0 ? costFromStages : row.cost;
    const paymentStatus: "pending" | "paid" = stagePayments.every(
      (st) => st.paymentStatus === "paid"
    )
      ? "paid"
      : "pending";

    details.push({
      orderId,
      orderCode: `ORD-${orderId.slice(0, 3)}`,
      customerName: row.order.cliente_nombre || "Cliente",
      description: orderDescription(row.order, row.cards),
      quantity: qty,
      dueDate: (row.order.fecha_estimada_entrega || primary?.dueDate || "").slice(0, 10),
      stageKey,
      stageLabel: stageLabels[stageKey] || stageKey || "Sin etapa",
      orderStatus: row.order.estado || "pending",
      cost,
      inWork: row.inWork,
      paymentStatus,
      stagePayments,
      cardIds: row.cards.map((c) => c.id),
    });
  }

  return details.sort((a, b) => {
    if (a.inWork !== b.inWork) return a.inWork ? -1 : 1;
    if ((a.orderStatus === "delivered") !== (b.orderStatus === "delivered")) {
      return a.orderStatus === "delivered" ? 1 : -1;
    }
    return a.orderCode.localeCompare(b.orderCode);
  });
}

export function buildProductionOrderHistory(params: {
  userId: string;
  orders: Order[];
  stageLabels: Record<string, string>;
  orderDetails: ProductionOrderDetail[];
}): ProductionOrderHistory[] {
  const { userId, orders, stageLabels, orderDetails } = params;
  if (!userId) return [];

  const detailById = new Map(orderDetails.map((d) => [d.orderId, d]));
  const history: ProductionOrderHistory[] = [];

  for (const order of orders) {
    const detail = detailById.get(order.id);
    if (!detail) continue;

    const cards = (
      Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : []
    ).filter((c) => cardAssignedToProductionUser(c, userId));

    const stageMap = new Map<string, ProductionStageActivity>();
    for (const card of cards) {
      const partial = collectUserStagesForCard(card, userId, stageLabels, order);
      for (const [key, activity] of partial) {
        const existing = stageMap.get(key);
        if (!existing) {
          stageMap.set(key, { ...activity, materials: [...activity.materials] });
          continue;
        }
        existing.laborAmount += activity.laborAmount;
        existing.novedadesCount += activity.novedadesCount;
        existing.isCurrent = existing.isCurrent || activity.isCurrent;
        if (
          activity.updatedAt &&
          (!existing.updatedAt || activity.updatedAt > existing.updatedAt)
        ) {
          existing.updatedAt = activity.updatedAt;
        }
        for (const action of activity.actions) {
          if (!existing.actions.includes(action)) existing.actions.push(action);
        }
        for (const mat of activity.materials) {
          const hit = existing.materials.find((m) => m.name === mat.name);
          if (hit) hit.quantity += mat.quantity;
          else existing.materials.push({ ...mat });
        }
      }
    }

    if (stageMap.size === 0 && detail.stageKey) {
      const fallbackCard = cards[0];
      stageMap.set(detail.stageKey, {
        stageKey: detail.stageKey,
        stageLabel: detail.stageLabel,
        actions: ["Asignado a la capa"],
        laborAmount: fallbackCard
          ? laborAmountForProductionUser(fallbackCard, userId)
          : detail.cost,
        materials: [],
        novedadesCount: 0,
        isCurrent: detail.inWork,
        updatedAt: null,
        paymentStatus: "pending",
      });
    }

    // Alinear paymentStatus de capas con el detalle del pedido
    const paymentByStage = new Map(
      detail.stagePayments.map((s) => [s.stageKey, s.paymentStatus])
    );
    for (const [key, activity] of stageMap) {
      const pay = paymentByStage.get(key);
      if (pay) activity.paymentStatus = pay;
    }

    const stages = [...stageMap.values()].sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });

    const totalLabor =
      stages.reduce((s, st) => s + st.laborAmount, 0) || detail.cost;

    history.push({
      orderId: detail.orderId,
      orderCode: detail.orderCode,
      customerName: detail.customerName,
      description: detail.description,
      quantity: detail.quantity,
      orderStatus: detail.orderStatus,
      inWork: detail.inWork,
      paymentStatus: detail.paymentStatus,
      totalLabor,
      stages,
    });
  }

  return history;
}

export function buildProductionUserPanel(params: {
  user: StoredProductionUser;
  orders: Order[];
  stageLabels: Record<string, string>;
}): ProductionUserPanelData {
  const { user, orders, stageLabels } = params;

  const orderDetails = buildProductionOrderDetails({
    user,
    orders,
    stageLabels,
  });

  const debtPending = orderDetails.reduce((sum, d) => {
    return (
      sum +
      d.stagePayments
        .filter((s) => s.paymentStatus === "pending" && !s.inWork)
        .reduce((s, st) => s + (Number(st.cost) || 0), 0)
    );
  }, 0);
  const pendingOrders = orderDetails.filter((d) => d.orderStatus !== "delivered").length;
  const ordersInWork = orderDetails.filter((d) => d.inWork).length;

  const alerts: ProductionUserAlert[] = orderDetails
    .map((d) => {
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
    .filter((a): a is ProductionUserAlert => Boolean(a));

  const orderHistory = buildProductionOrderHistory({
    userId: user.id,
    orders,
    stageLabels,
    orderDetails,
  });

  return {
    user,
    assignedOrders: orderDetails.length,
    pendingOrders,
    debtPending,
    ordersInWork,
    orders: orderDetails,
    alerts,
    orderHistory,
  };
}

export { formatMoneyCop };
