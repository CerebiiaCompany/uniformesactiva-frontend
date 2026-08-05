import type { ProductionOrder } from "@/data/mockData";
import type { Order } from "@/hooks/useOrders";
import type { SatelliteSettlement, SatelliteWorkStatus } from "@/hooks/useSatellites";
import { parseStageKeys } from "@/lib/production-capa-permissions";
import { computeRealCostFromCards } from "@/lib/order-real-cost";

export type SatelliteWorkshop = {
  id: string;
  name: string;
  contact_name: string;
  phone: string;
  address: string;
  specialties: string[];
  notes?: string;
  status: string;
  payment_status: string;
  settlements?: Record<string, SatelliteSettlement>;
};

export type SatelliteUserRef = {
  id: string;
  name: string;
  satelliteId: string | null;
  stageKeys: string[];
  roles: string[];
};

export type SatelliteDashboardCard = {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  address: string;
  notes: string;
  status: string;
  paymentStatus: string;
  settlements: Record<string, SatelliteSettlement>;
  /** Capas Kanban que operan los usuarios satélite vinculados */
  capas: { key: string; label: string }[];
  /** Usuarios satélite vinculados a este taller */
  userIds: string[];
  userNames: string[];
  /** Órdenes con al menos una tarjeta asignada a sus usuarios satélite */
  ordenes: number;
  /** Órdenes aún no entregadas */
  pendientes: number;
  /** Deuda / por pagar = mano de obra pendiente de liquidar */
  porPagar: number;
};

export type SatelliteOrderStageWork = {
  stageKey: string;
  stageLabel: string;
  userName: string | null;
  laborAmount: number;
  materialsAmount: number;
  materials: { name: string; quantity: number }[];
  actions: string[];
  isCurrent: boolean;
  novedadesCount: number;
};

export type SatelliteOrderDetail = {
  orderId: string;
  orderCode: string;
  customerName: string;
  description: string;
  quantity: number;
  dueDate: string;
  stageKey: string;
  stageLabel: string;
  orderStatus: string;
  /** Costo de mano de obra atribuido a usuarios satélite de este taller */
  cost: number;
  paymentStatus: "pending" | "paid";
  paidAt: string | null;
  cardIds: string[];
  /** true si la orden ya salió de pendiente (enviada a planta / en producción) */
  enviado: boolean;
  workStatus: SatelliteWorkStatus;
  observations: string;
  agreedCost: number | null;
  confirmedAt: string | null;
  /** Capas del Kanban donde este satélite/taller intervino */
  stagesWorked: SatelliteOrderStageWork[];
};

export const SATELLITE_WORK_STATUS_OPTIONS: {
  value: SatelliteWorkStatus;
  label: string;
}[] = [
  { value: "enviado", label: "Enviado (en trabajo)" },
  { value: "recibido_completo", label: "Recibido — completo" },
  { value: "recibido_faltantes", label: "Recibido — con faltantes" },
];

export function workStatusLabel(status: SatelliteWorkStatus): string {
  return (
    SATELLITE_WORK_STATUS_OPTIONS.find((o) => o.value === status)?.label || status
  );
}

export type SatelliteDetailSummary = {
  totalFacturado: number;
  pagado: number;
  porPagar: number;
  ordenesActivas: number;
};

function normalizeRole(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  const m = s.match(/name=['"]([^'"]+)['"]/);
  return (m?.[1] || s).trim();
}

export function isSatelliteRole(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  return list.some((r) => normalizeRole(r) === "Satélite");
}

export function mapApiUserToSatelliteRef(u: Record<string, unknown>): SatelliteUserRef | null {
  const roles = Array.isArray(u.roles) ? (u.roles as unknown[]) : [];
  if (!isSatelliteRole(roles)) return null;
  const first = String(u.first_name || "");
  const last = String(u.last_name || "");
  const name = `${first} ${last}`.trim() || String(u.username || "Usuario");
  return {
    id: String(u.id),
    name,
    satelliteId: u.satellite_id ? String(u.satellite_id) : null,
    stageKeys: parseStageKeys(
      Array.isArray(u.production_stage_keys)
        ? u.production_stage_keys
        : u.production_stage_key
    ),
    roles: roles.map(normalizeRole).filter(Boolean),
  };
}

function cardAssignedToUsers(
  card: ProductionOrder,
  userIds: Set<string>,
  workshopId?: string | null
): boolean {
  if (card.satelliteAssigneeId && userIds.has(String(card.satelliteAssigneeId))) {
    return true;
  }
  const stageAssignees = card.stageAssignees || {};
  for (const [key, entry] of Object.entries(stageAssignees)) {
    if (!entry?.userId) continue;
    if (!userIds.has(String(entry.userId))) continue;
    if (key.endsWith("__satellite") || entry.kind === "satellite") return true;
  }
  // Historial en ledger: trabajó MO / costo satélite aunque ya no sea responsable actual
  for (const entry of card.costLedger || []) {
    if (!entry.userId || !userIds.has(String(entry.userId))) continue;
    if (
      entry.category === "labor" ||
      entry.category === "satellite" ||
      entry.category === "mold" ||
      entry.actorKind === "satellite"
    ) {
      return true;
    }
  }
  // Tarjeta ligada al taller (proveedor externo) con costo
  if (
    workshopId &&
    card.satelliteId &&
    String(card.satelliteId) === String(workshopId) &&
    card.satelliteCost != null &&
    Number(card.satelliteCost) > 0
  ) {
    return true;
  }
  return false;
}

/**
 * Monto adeudado al taller/usuarios satélite por una tarjeta.
 * Alineado con el desglose de costo real: MO digitada (labor) + costo satélite/taller.
 * No incluye materiales de inventario (esos no se le «deben» al satélite).
 */
export function laborAmountForUsers(
  card: ProductionOrder,
  userIds: Set<string>,
  workshopId?: string | null
): number {
  let total = 0;
  const countedKeys = new Set<string>();

  const mark = (key: string) => {
    if (countedKeys.has(key)) return false;
    countedKeys.add(key);
    return true;
  };

  for (const entry of card.costLedger || []) {
    const uid = entry.userId ? String(entry.userId) : "";
    const amount = Number(entry.amount) || 0;
    if (amount === 0) continue;

    const isLaborLike =
      entry.category === "labor" ||
      entry.category === "mold" ||
      entry.category === "satellite";

    if (!isLaborLike && entry.actorKind !== "satellite") continue;

    // MO / satélite atribuido a usuarios del taller
    if (uid && userIds.has(uid)) {
      const key =
        entry.fingerprint ||
        `${entry.category}:${uid}:${entry.stage || ""}:${entry.label}`;
      if (mark(key)) total += amount;
      continue;
    }

    // Costo de taller (provider) ligado al workshop sin userId de operador
    if (
      workshopId &&
      entry.category === "satellite" &&
      (!uid || entry.actorKind === "provider")
    ) {
      // Si hay satelliteId en la tarjeta y coincide, o el label menciona el taller
      const linkedToWorkshop =
        card.satelliteId && String(card.satelliteId) === String(workshopId);
      if (linkedToWorkshop) {
        const key =
          entry.fingerprint ||
          `satellite:ws:${workshopId}:${entry.stage || ""}:${entry.label}`;
        if (mark(key)) total += amount;
      }
    }
  }

  // MO viva digitada con responsable satélite actual
  if (
    card.laborCostEnabled &&
    card.satelliteAssigneeId &&
    userIds.has(String(card.satelliteAssigneeId))
  ) {
    const stage = card.stage || "";
    const uid = String(card.satelliteAssigneeId);
    const liveFp = `labor:${stage}:${uid}`;
    const hasLedgerLabor = (card.costLedger || []).some(
      (e) =>
        e.category === "labor" &&
        String(e.userId || "") === uid &&
        (e.stage || "") === stage
    );
    if (!hasLedgerLabor && !countedKeys.has(liveFp) && mark(`live-labor:${uid}:${stage}`)) {
      total += (Number(card.quantity) || 0) * (Number(card.laborCostPerUnit) || 0);
    }
  }

  // Costo satélite vivo (proveedor) ligado al taller
  if (
    workshopId &&
    card.satelliteId &&
    String(card.satelliteId) === String(workshopId) &&
    card.satelliteCost != null &&
    Number.isFinite(Number(card.satelliteCost))
  ) {
    const liveAmount = Number(card.satelliteCost) || 0;
    if (liveAmount > 0) {
      const liveKey = `live-satellite:${workshopId}:${card.stage}`;
      const hasLedgerSat = [...countedKeys].some(
        (k) =>
          k.includes(`satellite:${card.stage}:`) ||
          k.includes(`satellite:ws:${workshopId}`)
      );
      if (!hasLedgerSat && mark(liveKey)) total += liveAmount;
    }
  }

  return Math.round(total * 100) / 100;
}

/**
 * Fallback: suma MO del desglose de costo real (misma fuente visual del modal).
 */
function laborFromOrderBreakdown(
  order: Order,
  userIds: Set<string>
): number {
  const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
  const breakdown =
    cards.length > 0
      ? computeRealCostFromCards(order.id, cards)
      : null;

  const byUser = breakdown?.byUser?.length
    ? breakdown.byUser
    : Array.isArray((order.costo_real_desglose as { byUser?: unknown } | undefined)?.byUser)
      ? ((order.costo_real_desglose as {
          byUser: {
            userId?: string;
            lines?: { category?: string; amount?: number; actorKind?: string }[];
          }[];
        }).byUser)
      : [];

  let total = 0;
  for (const row of byUser) {
    if (!row?.userId || !userIds.has(String(row.userId))) continue;
    const lines = Array.isArray(row.lines) ? row.lines : [];
    if (!lines.length) continue;
    for (const line of lines) {
      if (
        line.category === "labor" ||
        line.category === "mold" ||
        line.category === "satellite" ||
        line.actorKind === "satellite"
      ) {
        total += Number(line.amount) || 0;
      }
    }
  }
  return Math.round(total * 100) / 100;
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

function addAction(list: string[], action: string) {
  if (!list.includes(action)) list.push(action);
}

/**
 * Capas donde los usuarios satélite del taller trabajaron en las tarjetas del pedido.
 */
export function buildSatelliteStagesWorked(params: {
  cards: ProductionOrder[];
  userIds: Set<string>;
  userNames?: Map<string, string>;
  stageLabels: Record<string, string>;
  workshopId?: string | null;
}): SatelliteOrderStageWork[] {
  const { cards, userIds, userNames, stageLabels, workshopId } = params;
  const byStage = new Map<string, SatelliteOrderStageWork>();

  const ensure = (stageKey: string): SatelliteOrderStageWork => {
    const existing = byStage.get(stageKey);
    if (existing) return existing;
    const created: SatelliteOrderStageWork = {
      stageKey,
      stageLabel: stageLabels[stageKey] || stageKey || "Sin etapa",
      userName: null,
      laborAmount: 0,
      materialsAmount: 0,
      materials: [],
      actions: [],
      isCurrent: false,
      novedadesCount: 0,
    };
    byStage.set(stageKey, created);
    return created;
  };

  for (const card of cards) {
    for (const [key, entry] of Object.entries(card.stageAssignees || {})) {
      if (!entry?.userId || !userIds.has(String(entry.userId))) continue;
      const isSatelliteSlot =
        key.endsWith("__satellite") || entry.kind === "satellite";
      if (!isSatelliteSlot) continue;
      const stageKey = key.replace(/__satellite$/, "");
      const activity = ensure(stageKey);
      addAction(activity.actions, "Asignado a la capa");
      if (!activity.userName) {
        activity.userName =
          userNames?.get(String(entry.userId)) || entry.name || null;
      }
    }

    if (
      card.satelliteAssigneeId &&
      userIds.has(String(card.satelliteAssigneeId)) &&
      card.stage
    ) {
      const activity = ensure(card.stage);
      activity.isCurrent = true;
      addAction(activity.actions, "Responsable actual");
      if (!activity.userName) {
        activity.userName =
          userNames?.get(String(card.satelliteAssigneeId)) ||
          card.satelliteAssignee ||
          null;
      }
    }

    for (const entry of card.costLedger || []) {
      const uid = entry.userId ? String(entry.userId) : "";
      const isUser = uid && userIds.has(uid);
      const isWorkshopSat =
        workshopId &&
        entry.category === "satellite" &&
        card.satelliteId &&
        String(card.satelliteId) === String(workshopId);
      if (!isUser && !isWorkshopSat) continue;

      const stageKey = entry.stage || card.stage || "";
      if (!stageKey) continue;
      const activity = ensure(stageKey);
      const amount = Number(entry.amount) || 0;

      if (isUser && !activity.userName) {
        activity.userName =
          userNames?.get(uid) || entry.userName || null;
      }

      if (entry.category === "labor" || entry.category === "mold") {
        activity.laborAmount += amount;
        addAction(
          activity.actions,
          entry.category === "mold" ? "Registró moldería" : "Registró mano de obra"
        );
      } else if (entry.category === "satellite") {
        activity.laborAmount += amount;
        addAction(activity.actions, "Costo de taller satélite");
      } else if (entry.category === "materials") {
        activity.materialsAmount += amount;
        addAction(activity.actions, "Solicitó / usó materiales");
        const matName = (entry.label || "").replace(/\s*×\s*\d+(\.\d+)?$/, "").trim();
        const qtyMatch = (entry.label || "").match(/×\s*(\d+(?:\.\d+)?)/);
        const qty = qtyMatch ? Number(qtyMatch[1]) : 0;
        if (matName) {
          const hit = activity.materials.find((m) => m.name === matName);
          if (hit) hit.quantity += qty;
          else activity.materials.push({ name: matName, quantity: qty });
        }
      }
    }

    if (
      card.satelliteAssigneeId &&
      userIds.has(String(card.satelliteAssigneeId)) &&
      card.laborCostEnabled &&
      card.stage
    ) {
      const activity = ensure(card.stage);
      const live =
        (Number(card.quantity) || 0) * (Number(card.laborCostPerUnit) || 0);
      const hasLedgerLabor = (card.costLedger || []).some(
        (e) =>
          e.userId === card.satelliteAssigneeId &&
          e.stage === card.stage &&
          e.category === "labor"
      );
      if (!hasLedgerLabor && live > 0) {
        activity.laborAmount += live;
        addAction(activity.actions, "Registró mano de obra");
      }
    }

    if (
      card.satelliteAssigneeId &&
      userIds.has(String(card.satelliteAssigneeId)) &&
      card.stage
    ) {
      const mats = card.requestedMaterials || [];
      if (mats.length) {
        const activity = ensure(card.stage);
        for (const m of mats) {
          const qty = Number(m.quantity) || 0;
          const unit = Number(m.unitCost) || 0;
          activity.materialsAmount += qty * unit;
          const hit = activity.materials.find((x) => x.name === m.materialName);
          if (hit) hit.quantity += qty;
          else activity.materials.push({ name: m.materialName, quantity: qty });
        }
        addAction(activity.actions, "Solicitó / usó materiales");
      }
    }

    for (const uid of userIds) {
      const notes = (card.novedades || []).filter((n) => n.autorId === uid);
      if (!notes.length) continue;
      const targetStage =
        card.satelliteAssigneeId === uid && card.stage
          ? card.stage
          : Object.keys(card.stageAssignees || {}).find((k) => {
              const e = card.stageAssignees?.[k];
              return e?.userId === uid && (k.endsWith("__satellite") || e.kind === "satellite");
            })?.replace(/__satellite$/, "") ||
            card.stage ||
            "";
      if (!targetStage) continue;
      const activity = ensure(targetStage);
      activity.novedadesCount += notes.length;
      addAction(activity.actions, "Dejó novedad / evidencia");
    }
  }

  return [...byStage.values()]
    .map((s) => ({
      ...s,
      laborAmount: Math.round(s.laborAmount * 100) / 100,
      materialsAmount: Math.round(s.materialsAmount * 100) / 100,
    }))
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return a.stageLabel.localeCompare(b.stageLabel);
    });
}

/**
 * Pedidos asignados a usuarios satélite de un taller, con costo MO y estado de pago.
 */
export function buildSatelliteOrderDetails(params: {
  userIds: string[];
  orders: Order[];
  stageLabels: Record<string, string>;
  settlements?: Record<string, SatelliteSettlement>;
  workshopId?: string | null;
  userNamesById?: Record<string, string>;
}): SatelliteOrderDetail[] {
  const userIds = new Set(params.userIds);
  const workshopId = params.workshopId || null;
  const userNames = new Map(
    Object.entries(params.userNamesById || {}).map(([k, v]) => [String(k), v])
  );
  if (userIds.size === 0 && !workshopId) return [];

  const byOrder = new Map<
    string,
    {
      order: Order;
      cards: ProductionOrder[];
      cost: number;
    }
  >();

  for (const { card, order } of collectCardsFromOrders(params.orders)) {
    if (!cardAssignedToUsers(card, userIds, workshopId)) continue;
    const existing = byOrder.get(order.id);
    const labor = laborAmountForUsers(card, userIds, workshopId);
    if (existing) {
      existing.cards.push(card);
      existing.cost += labor;
    } else {
      byOrder.set(order.id, { order, cards: [card], cost: labor });
    }
  }

  // Si no hubo tarjetas detectadas pero el desglose tiene MO de estos usuarios, incluir
  for (const order of params.orders) {
    if (byOrder.has(order.id)) continue;
    const fromBreakdown = laborFromOrderBreakdown(order, userIds);
    if (fromBreakdown <= 0) continue;
    const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
    byOrder.set(order.id, { order, cards, cost: fromBreakdown });
  }

  const settlements = params.settlements || {};
  const details: SatelliteOrderDetail[] = [];

  for (const [orderId, row] of byOrder) {
    const primary =
      row.cards.find((c) => c.satelliteAssigneeId && userIds.has(String(c.satelliteAssigneeId))) ||
      row.cards[0];
    const stageKey = primary?.stage || row.order.etapa_produccion || "";
    const settlement = settlements[orderId];
    const paymentStatus: "pending" | "paid" =
      settlement?.status === "paid" ? "paid" : "pending";
    const qty =
      row.cards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0) ||
      row.order.items?.reduce((s, it) => s + (Number(it.cantidad) || 0), 0) ||
      0;

    const workStatus: SatelliteWorkStatus =
      settlement?.work_status === "recibido_completo" ||
      settlement?.work_status === "recibido_faltantes" ||
      settlement?.work_status === "enviado"
        ? settlement.work_status
        : row.order.estado === "in_production" || row.order.estado === "delivered"
          ? "enviado"
          : "enviado";

    const agreedFromSettlement =
      settlement?.agreed_cost != null && Number.isFinite(Number(settlement.agreed_cost))
        ? Number(settlement.agreed_cost)
        : null;

    // Preferir MO de tarjetas; si quedó en 0, alinear con desglose persistido
    let cost = row.cost;
    if (cost <= 0) {
      const fromBreakdown = laborFromOrderBreakdown(row.order, userIds);
      if (fromBreakdown > 0) cost = fromBreakdown;
    }

    const stagesWorked = buildSatelliteStagesWorked({
      cards: row.cards,
      userIds,
      userNames,
      stageLabels: params.stageLabels,
      workshopId,
    });

    details.push({
      orderId,
      orderCode: `ORD-${orderId.slice(0, 3)}`,
      customerName: row.order.cliente_nombre || "Cliente",
      description: orderDescription(row.order, row.cards),
      quantity: qty,
      dueDate: (row.order.fecha_estimada_entrega || primary?.dueDate || "").slice(0, 10),
      stageKey,
      stageLabel: params.stageLabels[stageKey] || stageKey || "Sin etapa",
      orderStatus: row.order.estado || "pending",
      cost,
      paymentStatus,
      paidAt: settlement?.paid_at || null,
      cardIds: row.cards.map((c) => c.id),
      enviado:
        workStatus === "enviado" ||
        workStatus === "recibido_completo" ||
        workStatus === "recibido_faltantes",
      workStatus,
      observations: settlement?.observations || "",
      agreedCost: agreedFromSettlement,
      confirmedAt: settlement?.confirmed_at || null,
      stagesWorked,
    });
  }

  return details.sort((a, b) => {
    if (a.paymentStatus !== b.paymentStatus) {
      return a.paymentStatus === "pending" ? -1 : 1;
    }
    return a.orderCode.localeCompare(b.orderCode);
  });
}

export function summarizeSatelliteOrders(
  details: SatelliteOrderDetail[]
): SatelliteDetailSummary {
  let totalFacturado = 0;
  let pagado = 0;
  let porPagar = 0;
  let ordenesActivas = 0;

  for (const d of details) {
    const amount =
      d.agreedCost != null && Number.isFinite(d.agreedCost) ? d.agreedCost : d.cost;
    totalFacturado += amount;
    if (d.paymentStatus === "paid") {
      pagado += amount;
    } else {
      porPagar += amount;
    }
    if (d.orderStatus !== "delivered") ordenesActivas += 1;
  }

  return { totalFacturado, pagado, porPagar, ordenesActivas };
}

/**
 * Construye las tarjetas del dashboard de Satélites.
 */
export function buildSatelliteDashboard(params: {
  workshops: SatelliteWorkshop[];
  satelliteUsers: SatelliteUserRef[];
  orders: Order[];
  stageLabels: Record<string, string>;
}): SatelliteDashboardCard[] {
  const { workshops, satelliteUsers, orders, stageLabels } = params;

  const usersByWorkshop = new Map<string, SatelliteUserRef[]>();
  for (const user of satelliteUsers) {
    if (!user.satelliteId) continue;
    const list = usersByWorkshop.get(user.satelliteId) || [];
    list.push(user);
    usersByWorkshop.set(user.satelliteId, list);
  }

  return workshops.map((ws) => {
    const linked = usersByWorkshop.get(ws.id) || [];
    const userIds = linked.map((u) => u.id);
    const userNames = linked.map((u) => u.name);

    const capaKeys = [
      ...new Set(linked.flatMap((u) => u.stageKeys).filter(Boolean)),
    ];
    const capas =
      capaKeys.length > 0
        ? capaKeys.map((key) => ({
            key,
            label: stageLabels[key] || key,
          }))
        : (ws.specialties || []).map((sp) => ({ key: sp, label: sp }));

    const settlements = ws.settlements || {};
    const orderDetails = buildSatelliteOrderDetails({
      userIds,
      orders,
      stageLabels,
      settlements,
      workshopId: ws.id,
      userNamesById: Object.fromEntries(linked.map((u) => [u.id, u.name])),
    });
    const summary = summarizeSatelliteOrders(orderDetails);

    const contactName =
      userNames[0] ||
      ws.contact_name ||
      "Sin usuario satélite";

    return {
      id: ws.id,
      name: ws.name,
      contactName,
      phone: ws.phone || "",
      address: ws.address || "",
      notes: ws.notes || "",
      status: ws.status,
      paymentStatus: ws.payment_status,
      settlements,
      capas,
      userIds,
      userNames,
      ordenes: orderDetails.length,
      pendientes: orderDetails.filter((d) => d.orderStatus !== "delivered").length,
      porPagar: summary.porPagar,
    };
  });
}

export function formatMoneyCop(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function exportSettlementCsv(
  satelliteName: string,
  details: SatelliteOrderDetail[]
) {
  const rows = [
    ["Orden", "Cliente", "Descripción", "Cantidad", "Etapa", "Costo", "Estado pago", "Entrega"].join(
      ","
    ),
    ...details.map((d) =>
      [
        d.orderCode,
        `"${d.customerName.replace(/"/g, '""')}"`,
        `"${d.description.replace(/"/g, '""')}"`,
        d.quantity,
        d.stageLabel,
        d.cost,
        d.paymentStatus === "paid" ? "Pagado" : "Por pagar",
        d.dueDate || "",
      ].join(",")
    ),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `liquidacion-${satelliteName.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
