import type { ProductionOrder } from "@/data/mockData";
import type { Order } from "@/hooks/useOrders";
import type { SatelliteSettlement, SatelliteWorkStatus } from "@/hooks/useSatellites";
import { parseStageKeys } from "@/lib/production-capa-permissions";
import { computeRealCostFromCards } from "@/lib/order-real-cost";
import type { PedidoCompra, DetallePedidoCompra } from "@/types/tns";
import {
  getPedidoNumDoc,
  getPedidoTotal,
  getPedidoDetalles,
  getDetalleCodigo,
  getDetalleDescripcion,
  getDetalleUnidad,
  getDetalleCantidad,
  getDetalleValorUnitario,
  getDetalleTotal,
  getPedidoFecha,
  getPedidoFechaEntrega,
} from "@/services/tnsService";

export type SatelliteWorkshop = {
  id: string;
  name: string;
  nit?: string;
  nit_tercero?: string;
  cod_tercero?: string;
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
  nit?: string;
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
  /** Total de órdenes realizadas (cerradas + activas) */
  ordenes: number;
  /** Órdenes pendientes (activas / no entregadas) */
  pendientes: number;
  /** Valor total por pagar de órdenes activas / pendientes */
  porPagar: number;
  /** True si tiene pedidos sincronizados desde TNS */
  isTnsSynced?: boolean;
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
  /** true si la orden ya salió de pendiente */
  enviado: boolean;
  workStatus: SatelliteWorkStatus;
  observations: string;
  agreedCost: number | null;
  confirmedAt: string | null;
  /** Capas del Kanban donde este satélite/taller intervino */
  stagesWorked: SatelliteOrderStageWork[];
  /** Origen: local o tns */
  source?: "local" | "tns";
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
    SATELLITE_WORK_STATUS_OPTIONS.find((o) => o.value === status)?.label || status || "Enviado"
  );
}

function normalizeText(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cruza un taller satélite con un pedido de compra de TNS por NIT/Documento o Nombre.
 */
export function matchesSatelliteTns(
  ws: { name?: string; nit?: string; nit_tercero?: string; cod_tercero?: string; contact_name?: string } | null | undefined,
  pedido: PedidoCompra | null | undefined
): boolean {
  if (!ws || !pedido) return false;
  const wsNit = (ws.nit || ws.nit_tercero || ws.cod_tercero || "").trim();
  const pedNit = (
    pedido.nitTercero ||
    pedido.codTercero ||
    pedido.tercero_nit ||
    pedido.NIT ||
    pedido.tercero_id ||
    ""
  ).trim();

  // 1. Coincidencia directa por NIT o Documento (la más exacta)
  if (wsNit && pedNit && wsNit === pedNit) {
    return true;
  }

  // 2. Coincidencia por Nombre / Razón Social
  const wsNameNorm = normalizeText(ws.name || "");
  const pedNameNorm = normalizeText(
    pedido.nomTercero ||
    pedido.tercero_nombre ||
    pedido.RAZONSOCIAL ||
    pedido.proveedor ||
    ""
  );

  if (!wsNameNorm || !pedNameNorm) return false;

  if (
    wsNameNorm === pedNameNorm ||
    pedNameNorm.includes(wsNameNorm) ||
    wsNameNorm.includes(pedNameNorm)
  ) {
    return true;
  }

  // Comprobar coincidencia por palabras clave del nombre
  const stopWords = new Set(["satelite", "taller", "cortador", "confeccion", "bordado", "y", "de", "la", "el", "los", "las"]);
  const wsTokens = wsNameNorm
    .split(" ")
    .filter((t) => t.length > 2 && !stopWords.has(t));

  if (wsTokens.length > 0) {
    const matchedTokens = wsTokens.filter((token) => pedNameNorm.includes(token));
    if (matchedTokens.length >= Math.min(2, wsTokens.length)) {
      return true;
    }
  }

  return false;
}

export function mapApiUserToSatelliteRef(
  raw: Record<string, unknown>
): SatelliteUserRef | null {
  if (!raw) return null;
  const id = String(raw.id ?? raw.user_id ?? "");
  if (!id) return null;

  const roles = Array.isArray(raw.roles)
    ? raw.roles.map(String)
    : typeof raw.role === "string"
      ? [raw.role]
      : [];

  const satelliteId = raw.satellite_id
    ? String(raw.satellite_id)
    : raw.satelliteId
      ? String(raw.satelliteId)
      : null;

  const name =
    (raw.full_name as string) ||
    (raw.name as string) ||
    [raw.first_name, raw.last_name].filter(Boolean).join(" ") ||
    (raw.username as string) ||
    "Usuario satélite";

  const stageKeys = parseStageKeys(
    (raw.production_stage_keys as string[] | string) ?? (raw.production_stage_key as string)
  );

  return {
    id,
    name,
    satelliteId,
    stageKeys,
    roles,
  };
}

export function cardAssignedToUsers(
  card: ProductionOrder,
  userIds: Set<string>,
  workshopId: string | null = null
): boolean {
  if (!card) return false;
  if (card.satelliteWorkshopId && workshopId && String(card.satelliteWorkshopId) === String(workshopId)) {
    return true;
  }
  if (card.satelliteAssigneeId && userIds.has(String(card.satelliteAssigneeId))) {
    return true;
  }
  return false;
}

export function laborAmountForUsers(
  card: ProductionOrder,
  userIds: Set<string>,
  workshopId: string | null = null
): number {
  if (!card || !cardAssignedToUsers(card, userIds, workshopId)) return 0;
  const cost = Number(card.laborCost || 0);
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
}

function laborFromOrderBreakdown(
  order: Order,
  userIds: Set<string>
): number {
  if (!order) return 0;
  const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
  const rc = computeRealCostFromCards(order.id || "", cards);
  let sum = 0;
  for (const row of rc?.laborBreakdown || []) {
    if (row.userId && userIds.has(String(row.userId))) {
      sum += Number(row.amount || 0);
    }
  }
  return sum;
}

function orderDescription(order: Order, cards: ProductionOrder[]): string {
  if (!order) return "Sin descripción";
  if (order.descripcion_resumida) return order.descripcion_resumida;
  const fromItems = (order.items || []).map((i) => i.descripcion).filter(Boolean);
  if (fromItems.length > 0) return fromItems.join(", ");
  const fromCards = (cards || []).map((c) => c.title).filter(Boolean);
  if (fromCards.length > 0) return fromCards.join(", ");
  return "Sin descripción";
}

function collectCardsFromOrders(orders: Order[]): { card: ProductionOrder; order: Order }[] {
  const list: { card: ProductionOrder; order: Order }[] = [];
  if (!Array.isArray(orders)) return list;
  for (const order of orders) {
    if (!order) continue;
    const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
    for (const card of cards) {
      if (!card) continue;
      list.push({ card, order });
    }
  }
  return list;
}

export function buildSatelliteStagesWorked(params: {
  cards: ProductionOrder[];
  userIds: Set<string>;
  userNames: Map<string, string>;
  stageLabels: Record<string, string>;
  workshopId: string | null;
}): SatelliteOrderStageWork[] {
  const { cards = [], userIds = new Set(), userNames = new Map(), stageLabels = {}, workshopId = null } = params || {};
  const byStage = new Map<string, SatelliteOrderStageWork>();

  for (const card of cards) {
    if (!card || !cardAssignedToUsers(card, userIds, workshopId)) continue;
    const stageKey = card.stage || "sin_etapa";
    const existing = byStage.get(stageKey);
    const labor = laborAmountForUsers(card, userIds, workshopId);
    const userName =
      (card.satelliteAssigneeId && userNames.get(String(card.satelliteAssigneeId))) ||
      card.assignee ||
      null;

    if (existing) {
      existing.laborAmount += labor;
      if (!existing.userName && userName) existing.userName = userName;
      if (card.isCurrent) existing.isCurrent = true;
    } else {
      byStage.set(stageKey, {
        stageKey,
        stageLabel: stageLabels[stageKey] || stageKey,
        userName,
        laborAmount: labor,
        materialsAmount: 0,
        materials: [],
        actions: [],
        isCurrent: Boolean(card.isCurrent),
        novedadesCount: 0,
      });
    }
  }

  return [...byStage.values()]
    .map((s) => ({
      ...s,
      laborAmount: Math.round((s.laborAmount || 0) * 100) / 100,
      materialsAmount: Math.round((s.materialsAmount || 0) * 100) / 100,
    }))
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return String(a.stageLabel || "").localeCompare(String(b.stageLabel || ""));
    });
}

/**
 * Pedidos asignados a usuarios satélite de un taller, con costo MO y estado de pago.
 * Soporta tanto órdenes internas como pedidos de compra desde TNS.
 */
export function buildSatelliteOrderDetails(params: {
  userIds: string[];
  orders: Order[];
  stageLabels: Record<string, string>;
  settlements?: Record<string, SatelliteSettlement>;
  workshopId?: string | null;
  userNamesById?: Record<string, string>;
  workshop?: SatelliteWorkshop | null;
  tnsPedidos?: PedidoCompra[];
}): SatelliteOrderDetail[] {
  const {
    userIds: userIdsArray = [],
    orders = [],
    stageLabels = {},
    settlements = {},
    workshopId = null,
    userNamesById = {},
    workshop = null,
    tnsPedidos = [],
  } = params || {};

  const userIds = new Set(userIdsArray);
  const userNames = new Map(
    Object.entries(userNamesById || {}).map(([k, v]) => [String(k), v])
  );

  const byOrder = new Map<
    string,
    {
      order: Order;
      cards: ProductionOrder[];
      cost: number;
    }
  >();

  // 1. Órdenes locales asignadas
  for (const { card, order } of collectCardsFromOrders(orders)) {
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

  for (const order of orders) {
    if (!order || byOrder.has(order.id)) continue;
    const fromBreakdown = laborFromOrderBreakdown(order, userIds);
    if (fromBreakdown <= 0) continue;
    const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
    byOrder.set(order.id, { order, cards, cost: fromBreakdown });
  }

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
        : "enviado";

    const agreedFromSettlement =
      settlement?.agreed_cost != null && Number.isFinite(Number(settlement.agreed_cost))
        ? Number(settlement.agreed_cost)
        : null;

    let cost = row.cost;
    if (cost <= 0) {
      const fromBreakdown = laborFromOrderBreakdown(row.order, userIds);
      if (fromBreakdown > 0) cost = fromBreakdown;
    }

    const stagesWorked = buildSatelliteStagesWorked({
      cards: row.cards,
      userIds,
      userNames,
      stageLabels,
      workshopId,
    });

    details.push({
      orderId,
      orderCode: `ORD-${String(orderId).slice(0, 3)}`,
      customerName: row.order.cliente_nombre || "Cliente",
      description: orderDescription(row.order, row.cards),
      quantity: qty,
      dueDate: (row.order.fecha_estimada_entrega || primary?.dueDate || "").slice(0, 10),
      stageKey,
      stageLabel: stageLabels[stageKey] || stageKey || "Sin etapa",
      orderStatus: row.order.estado || "pending",
      cost,
      paymentStatus,
      paidAt: settlement?.paid_at || null,
      cardIds: row.cards.map((c) => c.id),
      enviado: true,
      workStatus,
      observations: settlement?.observations || "",
      agreedCost: agreedFromSettlement,
      confirmedAt: settlement?.confirmed_at || null,
      stagesWorked,
      source: "local",
    });
  }

  // 2. Pedidos de compra desde TNS si coincide con este taller
  if (workshop && Array.isArray(tnsPedidos)) {
    const ws = workshop;
    const matchingTns = tnsPedidos.filter((p) => matchesSatelliteTns(ws, p));

    for (const p of matchingTns) {
      if (!p) continue;
      const numDoc = getPedidoNumDoc(p);
      const totalAmount = getPedidoTotal(p);
      const estadoNorm = (p.estado || "").toUpperCase().trim();
      const isCerrado = estadoNorm.includes("CERRAD") || estadoNorm === "C";
      const isAnulado = estadoNorm.includes("ANULAD");
      if (isAnulado) continue;

      const detailsLines = getPedidoDetalles(p);
      const qty = detailsLines.reduce((s, d) => s + (getDetalleCantidad(d) || 0), 0) || 0;

      const stagesWorked: SatelliteOrderStageWork[] = detailsLines.map((d, i) => {
        const matName = getDetalleDescripcion(d);
        const matCode = getDetalleCodigo(d);
        const cant = getDetalleCantidad(d);
        const valTot = getDetalleTotal(d);
        const valUnit = getDetalleValorUnitario(d);
        return {
          stageKey: `tns-${i}`,
          stageLabel: matCode && matCode !== "—" ? `${matCode} · ${matName}` : matName,
          userName: ws.contact_name || ws.name || "Satélite",
          laborAmount: valTot,
          materialsAmount: 0,
          materials: [],
          actions: [
            `Cantidad: ${cant} ${getDetalleUnidad(d)}`,
            `Valor Unitario: $${valUnit.toLocaleString("es-CO")}`,
            d.observacionDetalle ? `Obs: ${d.observacionDetalle}` : "",
          ].filter(Boolean),
          isCurrent: !isCerrado,
          novedadesCount: 0,
        };
      });

      const orderDesc =
        p.observacion && p.observacion.trim()
          ? p.observacion.trim()
          : detailsLines.length > 0
            ? detailsLines.map((d) => `${getDetalleCantidad(d)} ${getDetalleDescripcion(d)}`).join(", ")
            : "Pedido de compra TNS";

      const orderId = `tns-${p.kardexId || numDoc || Math.random()}`;
      const settlement = settlements[orderId];
      const paymentStatus: "pending" | "paid" =
        settlement?.status === "paid" || isCerrado ? "paid" : "pending";

      details.push({
        orderId,
        orderCode: `PED-${numDoc}`,
        customerName: p.nomTercero || ws.name || "Satélite",
        description: orderDesc,
        quantity: qty,
        dueDate: getPedidoFechaEntrega(p) || getPedidoFecha(p) || "",
        stageKey: ws.specialties?.[0] || "corte",
        stageLabel: ws.specialties?.[0] || "Mano de Obra TNS",
        orderStatus: isCerrado ? "delivered" : "in_production",
        cost: totalAmount,
        paymentStatus,
        paidAt: settlement?.paid_at || (isCerrado ? getPedidoFechaEntrega(p) || getPedidoFecha(p) : null),
        cardIds: [],
        enviado: true,
        workStatus: isCerrado ? "recibido_completo" : "enviado",
        observations: p.observacion || "",
        agreedCost: totalAmount,
        confirmedAt: getPedidoFecha(p) || null,
        stagesWorked,
        source: "tns",
      });
    }
  }

  return details.sort((a, b) => {
    if (a.paymentStatus !== b.paymentStatus) {
      return a.paymentStatus === "pending" ? -1 : 1;
    }
    return String(a.orderCode || "").localeCompare(String(b.orderCode || ""));
  });
}

export type SatelliteDetailSummary = {
  totalFacturado: number;
  pagado: number;
  porPagar: number;
  ordenesActivas: number;
};

export function summarizeSatelliteOrders(
  details: SatelliteOrderDetail[]
): SatelliteDetailSummary {
  let totalFacturado = 0;
  let pagado = 0;
  let porPagar = 0;
  let ordenesActivas = 0;

  if (!Array.isArray(details)) {
    return { totalFacturado: 0, pagado: 0, porPagar: 0, ordenesActivas: 0 };
  }

  for (const d of details) {
    if (!d) continue;
    const amount =
      d.agreedCost != null && Number.isFinite(d.agreedCost) ? d.agreedCost : Number(d.cost || 0);
    totalFacturado += amount;
    if (d.paymentStatus === "paid") {
      pagado += amount;
    } else {
      porPagar += amount;
    }
    if (d.paymentStatus === "pending" || d.orderStatus !== "delivered") {
      ordenesActivas += 1;
    }
  }

  return { totalFacturado, pagado, porPagar, ordenesActivas };
}

/**
 * Construye las tarjetas del dashboard de Satélites cruzando datos locales y pedidos de compra de TNS.
 */
export function buildSatelliteDashboard(params: {
  workshops?: SatelliteWorkshop[];
  satelliteUsers?: SatelliteUserRef[];
  orders?: Order[];
  stageLabels?: Record<string, string>;
  tnsPedidos?: PedidoCompra[];
}): SatelliteDashboardCard[] {
  const {
    workshops = [],
    satelliteUsers = [],
    orders = [],
    stageLabels = {},
    tnsPedidos = [],
  } = params || {};

  if (!Array.isArray(workshops)) return [];

  const usersByWorkshop = new Map<string, SatelliteUserRef[]>();
  for (const user of satelliteUsers || []) {
    if (!user || !user.satelliteId) continue;
    const list = usersByWorkshop.get(user.satelliteId) || [];
    list.push(user);
    usersByWorkshop.set(user.satelliteId, list);
  }

  return workshops.map((ws) => {
    if (!ws) {
      return {
        id: "",
        name: "",
        contactName: "",
        phone: "",
        address: "",
        notes: "",
        status: "active",
        paymentStatus: "al_dia",
        settlements: {},
        capas: [],
        userIds: [],
        userNames: [],
        ordenes: 0,
        pendientes: 0,
        porPagar: 0,
      };
    }

    const linked = usersByWorkshop.get(ws.id) || [];
    const userIds = linked.map((u) => u.id).filter(Boolean);
    const userNames = linked.map((u) => u.name).filter(Boolean);

    const capaKeys = [
      ...new Set(linked.flatMap((u) => u.stageKeys || []).filter(Boolean)),
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
      workshop: ws,
      tnsPedidos,
    });

    const summary = summarizeSatelliteOrders(orderDetails);

    const hasTnsMatches = (tnsPedidos || []).some((p) => matchesSatelliteTns(ws, p));

    const contactName =
      userNames[0] ||
      ws.contact_name ||
      ws.name ||
      "Sin contacto";

    return {
      id: ws.id,
      name: ws.name || "Sin nombre",
      nit: ws.nit || ws.nit_tercero || ws.cod_tercero || "",
      contactName,
      phone: ws.phone || "",
      address: ws.address || "",
      notes: ws.notes || "",
      status: ws.status || "active",
      paymentStatus: ws.payment_status || "al_dia",
      settlements,
      capas,
      userIds,
      userNames,
      ordenes: orderDetails.length,
      pendientes: summary.ordenesActivas,
      porPagar: summary.porPagar,
      isTnsSynced: hasTnsMatches,
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
    ...(details || []).map((d) =>
      [
        `"${d.orderCode || ""}"`,
        `"${(d.customerName || "").replace(/"/g, '""')}"`,
        `"${(d.description || "").replace(/"/g, '""')}"`,
        d.quantity || 0,
        `"${d.stageLabel || ""}"`,
        d.cost || 0,
        d.paymentStatus === "paid" ? "Pagado" : "Por pagar",
        `"${d.dueDate || ""}"`,
      ].join(",")
    ),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `liquidacion-${(satelliteName || "satelite").toLowerCase().replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
