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
  /** Nombres alternos para cruzar con TNS (contacto, usuarios vinculados, razón social). */
  aliases?: string[];
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
  /** Valor pagado (TNS + liquidaciones pagadas) */
  pagado: number;
  /** Valor total por pagar de órdenes locales asignadas al satélite */
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
  updatedAt?: string | null;
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
  { value: "recibido_completo", label: "Listo (Recibido completo)" },
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

/** NIT/cédula comparable: solo dígitos. */
export function normalizeNit(value?: string | null): string {
  return String(value || "").replace(/[^\d]/g, "");
}

/**
 * Quita sufijos tipo "/ SATELITE", "/ CORTADORA" para comparar nombres TNS.
 */
function stripTnsRoleSuffix(name: string): string {
  return (name || "")
    .replace(
      /\s*\/\s*(satelite|satélite|taller|cortadora|corte|confeccion|confección|bordado|estampado|proveedor|servicios?|produccion|producción)\s*$/i,
      ""
    )
    .replace(/\s*\([^)]*\)\s*$/i, "")
    .trim();
}

const TNS_NIT_MARKER = /(?:^|\s|·)\s*NIT\s*:\s*([0-9.\-\s]+)/i;
const TNS_NAME_MARKER = /(?:^|\s|·)\s*TNS\s*:\s*(.+)$/i;

/** Persiste NIT y razón social TNS en cargo (usuarios sin campo nit). */
export function encodeTnsUserMeta(cargo: string, nit?: string, tnsName?: string): string {
  const base = (cargo || "").replace(TNS_NIT_MARKER, "").replace(TNS_NAME_MARKER, "").trim()
    || "Operario de Producción";
  const parts = [base];
  const cleanNit = String(nit || "").trim();
  const cleanTns = String(tnsName || "").trim();
  if (cleanNit) parts.push(`NIT:${cleanNit}`);
  if (cleanTns) parts.push(`TNS:${cleanTns}`);
  return parts.join(" · ");
}

export function parseTnsUserMeta(cargo?: string | null): {
  displayCargo: string;
  nit: string;
  tnsName: string;
} {
  const raw = String(cargo || "");
  const nitMatch = raw.match(TNS_NIT_MARKER);
  const tnsMatch = raw.match(TNS_NAME_MARKER);
  const displayCargo = raw
    .replace(TNS_NIT_MARKER, "")
    .replace(TNS_NAME_MARKER, "")
    .replace(/\s*·\s*$/g, "")
    .replace(/^\s*·\s*/g, "")
    .replace(/\s*·\s*·\s*/g, " · ")
    .trim();
  return {
    displayCargo: displayCargo || "Operario de Producción",
    nit: (nitMatch?.[1] || "").trim(),
    tnsName: (tnsMatch?.[1] || "").trim(),
  };
}

function namesLooselyMatch(a: string, b: string): boolean {
  const left = normalizeText(stripTnsRoleSuffix(a));
  const right = normalizeText(stripTnsRoleSuffix(b));
  if (!left || !right) return false;
  if (left === right || right.includes(left) || left.includes(right)) return true;

  const stopWords = new Set([
    "satelite",
    "taller",
    "cortador",
    "cortadora",
    "confeccion",
    "bordado",
    "produccion",
    "operario",
    "y",
    "de",
    "la",
    "el",
    "los",
    "las",
    "del",
  ]);
  const tokens = left.split(" ").filter((t) => t.length > 2 && !stopWords.has(t));
  if (tokens.length === 0) return false;
  const matched = tokens.filter((token) => right.includes(token));
  return matched.length >= Math.min(2, tokens.length);
}

function nitsMatch(a?: string | null, b?: string | null): boolean {
  const left = normalizeNit(a);
  const right = normalizeNit(b);
  if (!left || !right) return false;
  if (left === right) return true;
  // Permite cédula con/sin dígito de verificación
  return left.startsWith(right) || right.startsWith(left);
}

/** Compara dos personas/talleres por NIT o por nombre (flexible TNS). */
export function isSamePersonIdentity(
  a: { names?: Array<string | null | undefined>; nit?: string | null },
  b: { names?: Array<string | null | undefined>; nit?: string | null }
): boolean {
  if (nitsMatch(a?.nit, b?.nit)) return true;
  const left = (a?.names || []).map((n) => String(n || "").trim()).filter(Boolean);
  const right = (b?.names || []).map((n) => String(n || "").trim()).filter(Boolean);
  for (const x of left) {
    for (const y of right) {
      if (namesLooselyMatch(x, y)) return true;
    }
  }
  return false;
}

/**
 * Cruza un taller/usuario con un pedido de compra de TNS por NIT/Documento o Nombre.
 */
export function matchesSatelliteTns(
  ws:
    | {
        name?: string;
        nit?: string;
        nit_tercero?: string;
        cod_tercero?: string;
        contact_name?: string;
        phone?: string;
        aliases?: string[];
      }
    | null
    | undefined,
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
  if (nitsMatch(wsNit, pedNit)) {
    return true;
  }

  // 2. Teléfono (útil cuando el usuario se creó desde el pedido TNS)
  const wsPhone = normalizeNit(ws.phone);
  const pedPhone = normalizeNit(
    (pedido as { telefono?: string; Tel?: string; telTercero?: string }).telefono ||
      (pedido as { Tel?: string }).Tel ||
      (pedido as { telTercero?: string }).telTercero ||
      ""
  );
  if (wsPhone.length >= 7 && pedPhone.length >= 7) {
    if (
      wsPhone === pedPhone ||
      wsPhone.endsWith(pedPhone) ||
      pedPhone.endsWith(wsPhone)
    ) {
      return true;
    }
  }

  const pedName =
    pedido.nomTercero ||
    pedido.tercero_nombre ||
    pedido.RAZONSOCIAL ||
    pedido.proveedor ||
    "";

  const candidates = [
    ws.name,
    ws.contact_name,
    ...(Array.isArray(ws.aliases) ? ws.aliases : []),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (namesLooselyMatch(candidate, pedName)) return true;
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
  workshopId: string | null = null,
  userNames?: string[]
): boolean {
  if (!card) return false;
  if (card.satelliteWorkshopId && workshopId && String(card.satelliteWorkshopId) === String(workshopId)) {
    return true;
  }
  if (card.satelliteAssigneeId && userIds.has(String(card.satelliteAssigneeId))) {
    return true;
  }
  if (card.assigneeId && userIds.has(String(card.assigneeId))) {
    return true;
  }
  if (Array.isArray(userNames) && userNames.length > 0) {
    const cardSatName = (card.satelliteName || card.satelliteAssignee || "").toLowerCase().trim();
    if (cardSatName && userNames.some((uName) => uName.toLowerCase().trim().includes(cardSatName) || cardSatName.includes(uName.toLowerCase().trim()))) {
      return true;
    }
  }
  // 1. Revisar si alguna capa en stageAssignees fue asignada a este usuario o taller
  if (card.stageAssignees) {
    for (const [, assign] of Object.entries(card.stageAssignees)) {
      if (assign && assign.userId && userIds.has(String(assign.userId))) {
        return true;
      }
      if (assign && assign.name && userNames && userNames.some((uName) => uName.toLowerCase().trim().includes(assign.name.toLowerCase().trim()) || assign.name.toLowerCase().trim().includes(uName.toLowerCase().trim()))) {
        return true;
      }
    }
  }

  // 2. Revisar si en costLedger hay costos registrados a nombre de este usuario/taller
  if (Array.isArray(card.costLedger)) {
    for (const e of card.costLedger) {
      if (e && e.userId && userIds.has(String(e.userId))) {
        return true;
      }
      if (e && e.userName && userNames && userNames.some((uName) => uName.toLowerCase().trim().includes(e.userName.toLowerCase().trim()) || e.userName.toLowerCase().trim().includes(uName.toLowerCase().trim()))) {
        return true;
      }
    }
  }

  return false;
}

export function laborAmountForUsers(
  card: ProductionOrder,
  userIds: Set<string>,
  workshopId: string | null = null,
  userNames?: string[]
): number {
  if (!card || !cardAssignedToUsers(card, userIds, workshopId, userNames)) return 0;
  
  let cost = 0;

  // 1. Sumar entradas de costLedger atribuidas a este usuario o taller satélite
  if (Array.isArray(card.costLedger) && card.costLedger.length > 0) {
    for (const e of card.costLedger) {
      if (e && (e.category === "labor" || e.category === "satellite")) {
        const matchesUser =
          (e.userId && userIds.has(String(e.userId))) ||
          (e.userName && userNames && userNames.some((uName) => uName.toLowerCase().trim().includes(e.userName!.toLowerCase().trim()) || e.userName!.toLowerCase().trim().includes(uName.toLowerCase().trim())));

        if (matchesUser) {
          cost += Number(e.amount || 0);
        }
      }
    }
  }

  // 2. Si no hay costLedger acumulado, revisar stageLaborConfig de las capas asignadas a este usuario
  if (cost <= 0 && card.stageLaborConfig && card.stageAssignees) {
    for (const [sKey, assign] of Object.entries(card.stageAssignees)) {
      if (!assign) continue;
      const isMyAssign =
        (assign.userId && userIds.has(String(assign.userId))) ||
        (assign.name && userNames && userNames.some((uName) => uName.toLowerCase().trim().includes(assign.name.toLowerCase().trim()) || assign.name.toLowerCase().trim().includes(uName.toLowerCase().trim())));

      if (isMyAssign) {
        const cleanStageKey = sKey.replace(/__satellite$/, "");
        const cfg = card.stageLaborConfig[cleanStageKey] || card.stageLaborConfig[sKey];
        if (cfg && cfg.enabled && cfg.perUnit != null && Number(cfg.perUnit) > 0) {
          const qty = Number(card.quantity || 0);
          cost += Number(cfg.perUnit) * (qty > 0 ? qty : 1);
        }
      }
    }
  }

  // 3. Si la tarjeta actualmente está asignada a este usuario en card.stage
  if (cost <= 0) {
    const isCurrentAssignee =
      (card.satelliteAssigneeId && userIds.has(String(card.satelliteAssigneeId))) ||
      (card.assigneeId && userIds.has(String(card.assigneeId)));

    if (isCurrentAssignee) {
      const cfg = card.stageLaborConfig?.[card.stage];
      if (cfg && cfg.enabled && cfg.perUnit != null && Number(cfg.perUnit) > 0) {
        const qty = Number(card.quantity || 0);
        cost = Number(cfg.perUnit) * (qty > 0 ? qty : 1);
      } else if (card.laborCostPerUnit && Number(card.laborCostPerUnit) > 0) {
        const qty = Number(card.quantity || 0);
        cost = Number(card.laborCostPerUnit) * (qty > 0 ? qty : 1);
      } else if (card.laborCost && Number(card.laborCost) > 0) {
        cost = Number(card.laborCost);
      } else if (card.satelliteCost && Number(card.satelliteCost) > 0) {
        cost = Number(card.satelliteCost);
      }
    }
  }

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
  settlement?: SatelliteSettlement | null;
  order?: Order | null;
}): SatelliteOrderStageWork[] {
  const {
    cards = [],
    userIds = new Set(),
    userNames = new Map(),
    stageLabels = {},
    settlement = null,
    order = null,
  } = params || {};
  const byStage = new Map<string, SatelliteOrderStageWork>();

  const primaryCard =
    cards.find((c) => c && (c.stageLaborConfig || c.stageAssignees || c.variants?.length)) ||
    cards[0];

  // Cantidad del PEDIDO (una sola vez). No sumar quantity de todas las tarjetas Kanban.
  const orderItemsQty =
    order?.items?.reduce((s, it) => s + (Number(it.cantidad) || 0), 0) || 0;
  const maxCardQty = cards.reduce(
    (max, c) => Math.max(max, Number(c?.quantity) || 0),
    0
  );
  const totalQty = orderItemsQty > 0 ? orderItemsQty : maxCardQty;

  // Extraer desglose de tallas (sin duplicar por tarjeta)
  const tallasMap = new Map<string, number>();
  const tallasSource =
    primaryCard?.variants && primaryCard.variants.length > 0
      ? primaryCard
      : cards.find((c) => c?.variants && c.variants.length > 0) || primaryCard;

  if (tallasSource?.variants && tallasSource.variants.length > 0) {
    for (const v of tallasSource.variants) {
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
      const tName = (it.talla_nombre || (it as { talla?: string }).talla || "").trim();
      if (tName && tName !== "—") {
        tallasMap.set(tName, (tallasMap.get(tName) || 0) + (Number(it.cantidad) || 0));
      }
    }
  }

  const tallasSummary = Array.from(tallasMap.entries())
    .map(([talla, cant]) => `${talla}: ${cant} uds`)
    .join(" · ");

  // Prendas únicas (evitar repetir por talla/línea)
  const prendaNames = new Set<string>();
  for (const it of order?.items || []) {
    const n = String(it.subproducto_nombre || it.producto_nombre || "").trim();
    if (n) prendaNames.add(n);
  }
  if (prendaNames.size === 0) {
    for (const c of cards) {
      const raw = String(c?.items || c?.title || "").trim();
      if (!raw) continue;
      for (const part of raw.split(",")) {
        const n = part.trim();
        if (n) prendaNames.add(n);
      }
    }
  }
  const prendaName = [...prendaNames].join(", ") || null;

  const isStageReq = (sKey: string) => {
    const k = sKey.toLowerCase();
    if (primaryCard?.hasBordado === false && (k.includes("bordad") || k === "embroidery")) return false;
    if ((primaryCard as { hasEstampado?: boolean })?.hasEstampado === false && (k.includes("estampad") || k === "printing")) return false;
    return true;
  };

  const resolveUnit = (
    stageKey: string,
    perUnitOverride: number | null,
    laborAmount: number
  ): number | null => {
    if (perUnitOverride != null && perUnitOverride > 0) return perUnitOverride;
    for (const card of cards) {
      const cfg =
        card?.stageLaborConfig?.[stageKey] ||
        card?.stageLaborConfig?.[`${stageKey}__satellite`];
      if (cfg?.enabled && cfg.perUnit != null && Number(cfg.perUnit) > 0) {
        return Number(cfg.perUnit);
      }
    }
    if (laborAmount > 0 && totalQty > 0) {
      return Math.round((laborAmount / totalQty) * 100) / 100;
    }
    return null;
  };

  const buildActions = (unitVal: number | null): string[] => {
    const actions: string[] = [];
    if (prendaName) actions.push(`Prenda: ${prendaName}`);
    if (totalQty > 0) actions.push(`Cantidad total: ${totalQty} prendas`);
    if (unitVal != null && unitVal > 0) {
      actions.push(`Valor unitario por prenda: $${unitVal.toLocaleString("es-CO")}`);
    }
    if (tallasSummary) actions.push(`Tallas y cantidades: ${tallasSummary}`);
    return actions;
  };

  /**
   * Registra o actualiza una capa. Nunca acumula el mismo MO configurado
   * varias veces (una por tarjeta Kanban). Prefiere el valor unitario × qty.
   */
  const upsertStage = (opts: {
    stageKey: string;
    laborAmount?: number;
    userName?: string | null;
    isCurrent?: boolean;
    perUnit?: number | null;
    updatedAt?: string | null;
    /** Si true, no suma al labor existente: toma el mayor (evita 3× por N tarjetas). */
    replaceLabor?: boolean;
  }) => {
    const stageKey = opts.stageKey;
    if (!stageKey || !isStageReq(stageKey)) return;
    const cleanKey = stageKey.replace(/__satellite$/, "");
    const existing = byStage.get(cleanKey);
    const unitVal = resolveUnit(cleanKey, opts.perUnit ?? null, opts.laborAmount || 0);

    // Fuente de verdad: unitario × cantidad del pedido
    let labor = Number(opts.laborAmount) || 0;
    if (unitVal != null && unitVal > 0 && totalQty > 0) {
      labor = Math.round(unitVal * totalQty * 100) / 100;
    }

    const actions = buildActions(unitVal);

    if (existing) {
      if (opts.replaceLabor || existing.laborAmount <= 0) {
        existing.laborAmount = labor;
      } else if (labor > 0) {
        // Misma capa vista en otra tarjeta: quedarse con un solo monto (no sumar).
        existing.laborAmount = Math.max(existing.laborAmount, labor);
        // Si ambos son múltiplos del unitario×qty, forzar el unitario×qty
        if (unitVal != null && unitVal > 0 && totalQty > 0) {
          existing.laborAmount = Math.round(unitVal * totalQty * 100) / 100;
        }
      }
      if (!existing.userName && opts.userName) existing.userName = opts.userName;
      if (opts.isCurrent) existing.isCurrent = true;
      if (opts.updatedAt && (!existing.updatedAt || opts.updatedAt > existing.updatedAt)) {
        existing.updatedAt = opts.updatedAt;
      }
      existing.actions = actions;
    } else {
      byStage.set(cleanKey, {
        stageKey: cleanKey,
        stageLabel: stageLabels[cleanKey] || cleanKey,
        userName: opts.userName || null,
        laborAmount: labor,
        materialsAmount: 0,
        materials: [],
        actions,
        isCurrent: Boolean(opts.isCurrent),
        novedadesCount: 0,
        updatedAt: opts.updatedAt || null,
      });
    }
  };

  // 1. Etapas en settlement.stages_done (monto acordado / liquidado)
  if (settlement && (settlement as { stages_done?: Record<string, number> }).stages_done) {
    for (const [stg, amt] of Object.entries(
      (settlement as { stages_done: Record<string, number> }).stages_done
    )) {
      upsertStage({
        stageKey: stg,
        laborAmount: Number(amt) || 0,
        updatedAt: settlement.confirmed_at || null,
        replaceLabor: true,
      });
    }
  }

  // 2. Asignaciones por capa (una pasada deduplicada por stageKey)
  const assigneeByStage = new Map<
    string,
    { name: string | null; perUnit: number | null; updatedAt: string | null }
  >();
  for (const card of cards) {
    if (!card?.stageAssignees) continue;
    for (const [sKey, assign] of Object.entries(card.stageAssignees)) {
      if (!assign) continue;
      const matches =
        (assign.userId && userIds.has(String(assign.userId))) ||
        (assign.name &&
          Array.from(userNames.values()).some(
            (n) =>
              n.toLowerCase().includes(assign.name.toLowerCase()) ||
              assign.name.toLowerCase().includes(n.toLowerCase())
          ));
      if (!matches) continue;
      const cleanKey = sKey.replace(/__satellite$/, "");
      if (!isStageReq(cleanKey)) continue;
      const cfg = card.stageLaborConfig?.[cleanKey] || card.stageLaborConfig?.[sKey];
      const perUnit =
        cfg?.enabled && cfg.perUnit != null && Number(cfg.perUnit) > 0
          ? Number(cfg.perUnit)
          : null;
      const histEntry = (card.stageHistory || []).find((h) => h.stage === cleanKey);
      const stageDate = histEntry?.enteredAt || null;
      const prev = assigneeByStage.get(cleanKey);
      if (!prev) {
        assigneeByStage.set(cleanKey, {
          name: assign.name || null,
          perUnit,
          updatedAt: stageDate,
        });
      } else {
        if (!prev.perUnit && perUnit) prev.perUnit = perUnit;
        if (!prev.name && assign.name) prev.name = assign.name;
        if (stageDate && (!prev.updatedAt || stageDate > prev.updatedAt)) {
          prev.updatedAt = stageDate;
        }
      }
    }
  }

  for (const [stageKey, info] of assigneeByStage) {
    const labor =
      info.perUnit != null && info.perUnit > 0 && totalQty > 0
        ? Math.round(info.perUnit * totalQty * 100) / 100
        : 0;
    upsertStage({
      stageKey,
      laborAmount: labor,
      userName: info.name,
      perUnit: info.perUnit,
      updatedAt: info.updatedAt,
      replaceLabor: true,
    });
  }

  // 3. costLedger: una entrada por capa+usuario (no repetir entre tarjetas)
  const ledgerSeen = new Set<string>();
  for (const card of cards) {
    if (!card || !Array.isArray(card.costLedger)) continue;
    for (const e of card.costLedger) {
      if (!e || (e.category !== "labor" && e.category !== "satellite")) continue;
      const matches =
        (e.userId && userIds.has(String(e.userId))) ||
        (e.userName &&
          Array.from(userNames.values()).some(
            (n) =>
              n.toLowerCase().includes(e.userName!.toLowerCase()) ||
              e.userName!.toLowerCase().includes(n.toLowerCase())
          ));
      if (!matches || !e.stage) continue;
      const cleanKey = String(e.stage).replace(/__satellite$/, "");
      const dedupeKey = `${cleanKey}|${e.userId || e.userName || ""}|${Number(e.amount) || 0}|${e.updatedAt || ""}`;
      if (ledgerSeen.has(dedupeKey)) continue;
      ledgerSeen.add(dedupeKey);

      // Si ya hay MO por unitario×qty, no sumar ledger encima (evita doble conteo).
      const existing = byStage.get(cleanKey);
      if (existing && existing.laborAmount > 0) {
        const unitVal = resolveUnit(cleanKey, null, existing.laborAmount);
        if (unitVal != null && unitVal > 0 && totalQty > 0) {
          existing.laborAmount = Math.round(unitVal * totalQty * 100) / 100;
          if (!existing.userName && e.userName) existing.userName = e.userName;
          continue;
        }
      }

      upsertStage({
        stageKey: cleanKey,
        laborAmount: Number(e.amount) || 0,
        userName: e.userName || null,
        updatedAt: e.updatedAt || null,
        replaceLabor: !existing || existing.laborAmount <= 0,
      });
    }
  }

  // 4. Capa actual asignada (solo marca isCurrent; no vuelve a sumar MO)
  for (const card of cards) {
    if (!card) continue;
    const isCurrentAssignee =
      (card.satelliteAssigneeId && userIds.has(String(card.satelliteAssigneeId))) ||
      (card.assigneeId && userIds.has(String(card.assigneeId)));
    if (!isCurrentAssignee || !card.stage) continue;
    const uName =
      (card.satelliteAssigneeId && userNames.get(String(card.satelliteAssigneeId))) ||
      card.satelliteAssignee ||
      card.assignee ||
      null;
    const cleanKey = String(card.stage).replace(/__satellite$/, "");
    if (byStage.has(cleanKey)) {
      const existing = byStage.get(cleanKey)!;
      existing.isCurrent = true;
      if (!existing.userName && uName) existing.userName = uName;
    } else {
      const cfg = card.stageLaborConfig?.[cleanKey] || card.stageLaborConfig?.[card.stage];
      const perUnit =
        cfg?.enabled && cfg.perUnit != null && Number(cfg.perUnit) > 0
          ? Number(cfg.perUnit)
          : card.laborCostPerUnit != null && Number(card.laborCostPerUnit) > 0
            ? Number(card.laborCostPerUnit)
            : null;
      const labor =
        perUnit != null && totalQty > 0
          ? Math.round(perUnit * totalQty * 100) / 100
          : 0;
      upsertStage({
        stageKey: cleanKey,
        laborAmount: labor,
        userName: uName,
        isCurrent: true,
        perUnit,
        replaceLabor: true,
      });
    }
  }

  // Normalizar: siempre unitario × qty cuando hay config
  for (const stage of byStage.values()) {
    const unitVal = resolveUnit(stage.stageKey, null, stage.laborAmount);
    if (unitVal != null && unitVal > 0 && totalQty > 0) {
      stage.laborAmount = Math.round(unitVal * totalQty * 100) / 100;
      stage.actions = buildActions(unitVal);
    } else {
      stage.laborAmount = Math.round((stage.laborAmount || 0) * 100) / 100;
    }
    stage.materialsAmount = Math.round((stage.materialsAmount || 0) * 100) / 100;
  }

  return [...byStage.values()].sort((a, b) => {
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

  const userNamesList = Array.from(userNames.values());
  if (workshop?.name) userNamesList.push(workshop.name);
  if (workshop?.contact_name) userNamesList.push(workshop.contact_name);

  // 1. Órdenes locales asignadas
  for (const { card, order } of collectCardsFromOrders(orders)) {
    if (!cardAssignedToUsers(card, userIds, workshopId, userNamesList)) continue;
    const existing = byOrder.get(order.id);
    if (existing) {
      existing.cards.push(card);
    } else {
      byOrder.set(order.id, { order, cards: [card], cost: 0 });
    }
  }

  // 2. Órdenes con liquidación previa en settlements del taller
  for (const order of orders) {
    if (!order || byOrder.has(order.id)) continue;
    const rawId = String(order.id).replace(/^PO-/, "");
    const hasSettlement =
      settlements[rawId] ||
      settlements[order.id] ||
      settlements[`PO-${rawId}`];

    if (hasSettlement) {
      const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
      const cost =
        Number(hasSettlement.agreed_cost || hasSettlement.amount || 0) ||
        laborFromOrderBreakdown(order, userIds);
      byOrder.set(order.id, { order, cards, cost });
      continue;
    }

    const fromBreakdown = laborFromOrderBreakdown(order, userIds);
    if (fromBreakdown > 0) {
      const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
      byOrder.set(order.id, { order, cards, cost: fromBreakdown });
    }
  }

  const details: SatelliteOrderDetail[] = [];

  for (const [orderId, row] of byOrder) {
    const primary =
      row.cards.find((c) => c.satelliteAssigneeId && userIds.has(String(c.satelliteAssigneeId))) ||
      row.cards[0];
    const stageKey = primary?.stage || row.order.etapa_produccion || "";
    const rawId = String(orderId).replace(/^PO-/, "");
    const settlement =
      settlements[rawId] ||
      settlements[orderId] ||
      settlements[`PO-${rawId}`] ||
      (primary?.id ? settlements[primary.id] : undefined);

    const paymentStatus: "pending" | "paid" =
      settlement?.status === "paid" ? "paid" : "pending";

    const orderItemsQty =
      row.order.items?.reduce((s, it) => s + (Number(it.cantidad) || 0), 0) || 0;
    const maxCardQty = row.cards.reduce(
      (max, c) => Math.max(max, Number(c.quantity) || 0),
      0
    );
    const qty = orderItemsQty > 0 ? orderItemsQty : maxCardQty;

    const workStatus: SatelliteWorkStatus =
      paymentStatus === "paid" ||
      settlement?.work_status === "recibido_completo"
        ? "recibido_completo"
        : settlement?.work_status === "recibido_faltantes"
          ? "recibido_faltantes"
          : "enviado";

    const agreedFromSettlement =
      settlement?.agreed_cost != null && Number.isFinite(Number(settlement.agreed_cost))
        ? Number(settlement.agreed_cost)
        : settlement?.amount != null && Number.isFinite(Number(settlement.amount))
          ? Number(settlement.amount)
          : null;

    const stagesWorked = buildSatelliteStagesWorked({
      cards: row.cards,
      userIds,
      userNames,
      stageLabels,
      workshopId,
      settlement,
      order: row.order,
    });

    const stagesLaborTotal = stagesWorked.reduce(
      (s, st) => s + (Number(st.laborAmount) || 0),
      0
    );

    let cost = row.cost;
    if (agreedFromSettlement != null && agreedFromSettlement > 0) {
      cost = agreedFromSettlement;
    } else if (stagesLaborTotal > 0) {
      cost = stagesLaborTotal;
    } else if (cost <= 0) {
      const fromBreakdown = laborFromOrderBreakdown(row.order, userIds);
      if (fromBreakdown > 0) cost = fromBreakdown;
    }

    const workedLabels = stagesWorked.map((s) => s.stageLabel).filter(Boolean);
    const displayStageLabel =
      workedLabels.length > 0
        ? workedLabels.join(" · ")
        : stageLabels[stageKey] || stageKey || "Sin etapa";

    details.push({
      orderId,
      orderCode: `ORD-${String(orderId).slice(0, 3)}`,
      customerName: row.order.cliente_nombre || "Cliente",
      description: orderDescription(row.order, row.cards),
      quantity: qty,
      dueDate: (row.order.fecha_estimada_entrega || primary?.dueDate || "").slice(0, 10),
      stageKey: stagesWorked[0]?.stageKey || stageKey,
      stageLabel: displayStageLabel,
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

      // Agrupar items por código para evitar duplicados y mostrar abreviaciones concisas (ej. CONFBMC)
      const groupedItems = new Map<string, { code: string; name: string; qty: number; total: number; unit: string; valUnit: number }>();
      for (const d of detailsLines) {
        const matCode = (getDetalleCodigo(d) || "").trim();
        const matName = (getDetalleDescripcion(d) || "").trim();
        const codeKey = matCode && matCode !== "—" ? matCode : matName;
        const cant = getDetalleCantidad(d) || 0;
        const tot = getDetalleTotal(d) || 0;
        const unit = getDetalleUnidad(d) || "uds";
        const valUnit = getDetalleValorUnitario(d) || 0;

        const prev = groupedItems.get(codeKey);
        if (prev) {
          prev.qty += cant;
          prev.total += tot;
        } else {
          groupedItems.set(codeKey, {
            code: codeKey,
            name: matName,
            qty: cant,
            total: tot,
            unit,
            valUnit,
          });
        }
      }

      const stagesWorked: SatelliteOrderStageWork[] = Array.from(groupedItems.values()).map((it, i) => ({
        stageKey: `tns-${i}`,
        stageLabel: it.code,
        userName: ws.contact_name || ws.name || "Satélite",
        laborAmount: it.total,
        materialsAmount: 0,
        materials: [],
        actions: [
          `Código: ${it.code}`,
          it.name && it.name !== it.code ? `Descripción: ${it.name}` : "",
          `Cantidad: ${it.qty} ${it.unit}`,
          it.valUnit > 0 ? `Valor Unitario: $${it.valUnit.toLocaleString("es-CO")}` : "",
        ].filter(Boolean),
        isCurrent: !isCerrado,
        novedadesCount: 0,
      }));

      const orderDesc =
        p.observacion && p.observacion.trim()
          ? p.observacion.trim()
          : detailsLines.length > 0
            ? detailsLines.map((d) => `${getDetalleCantidad(d)} ${getDetalleDescripcion(d)}`).join(", ")
            : "Pedido de compra TNS";

      const orderId = `tns-${p.kardexId || numDoc || Math.random()}`;
      const settlement = settlements[orderId];
      // Lo que ya está en TNS (pedidos de compra / pagos) se considera pagado.
      // Solo un settlement local explícito "pending" podría forzar lo contrario.
      let paymentStatus: "pending" | "paid" = "paid";
      if (settlement?.status === "pending") paymentStatus = "pending";
      if (settlement?.status === "paid") paymentStatus = "paid";

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
        paidAt:
          settlement?.paid_at ||
          getPedidoFechaEntrega(p) ||
          getPedidoFecha(p) ||
          null,
        cardIds: [],
        enviado: true,
        workStatus: "recibido_completo",
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
    } else if (d.workStatus === "recibido_completo" || d.source === "tns") {
      // Solo se suma a la deuda pendiente si se le dio terminar a la capa donde se estipuló la labor
      porPagar += amount;
    }

    // Órdenes pendientes: Solo si no están pagadas, no están entregadas y no han sido recibidas completas
    const isPaid = d.paymentStatus === "paid";
    const isDelivered = d.orderStatus === "delivered";
    const isRecibidoCompleto = d.workStatus === "recibido_completo";
    if (!isPaid && !isDelivered && !isRecibidoCompleto) {
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
        pagado: 0,
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
      workshop: {
        ...ws,
        // Amplía match TNS con contacto y nombres de usuarios vinculados
        contact_name: ws.contact_name || userNames[0] || "",
        aliases: [
          ws.contact_name,
          ...userNames,
        ].filter(Boolean) as string[],
      },
      tnsPedidos,
    });

    const summary = summarizeSatelliteOrders(orderDetails);

    const matchIdentity = {
      name: ws.name,
      nit: ws.nit || ws.nit_tercero || ws.cod_tercero || "",
      contact_name: ws.contact_name || userNames[0] || "",
      aliases: [ws.contact_name, ...userNames].filter(Boolean) as string[],
    };
    const hasTnsMatches = (tnsPedidos || []).some((p) => matchesSatelliteTns(matchIdentity, p));

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
      pagado: summary.pagado,
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
