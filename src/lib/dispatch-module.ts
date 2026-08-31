/**
 * Utilidades del módulo Despacho.
 * Pedidos listos = etapa Kanban «Para Despacho» (key dispatch / aliases).
 */

import type { Order } from "@/hooks/useOrders";
import type { Satellite, SatelliteSettlement } from "@/hooks/useSatellites";
import type { ProductionOrder } from "@/data/mockData";
import {
  normalizeRealCostBreakdown,
  type RealCostLine,
} from "@/lib/order-real-cost";

const DISPATCH_KEY_ALIASES = new Set([
  "dispatch",
  "despacho",
  "para-despacho",
  "para_despacho",
  "paradespacho",
  "empaque",
]);

export function isDispatchStageKey(key: string | null | undefined): boolean {
  const raw = String(key || "")
    .trim()
    .toLowerCase();
  if (!raw) return false;
  if (DISPATCH_KEY_ALIASES.has(raw)) return true;
  return raw.includes("despacho") || raw.includes("empaque");
}

export function isOrderReadyForDispatch(order: Order): boolean {
  if (order.estado === "delivered") return false;
  return isDispatchStageKey(order.etapa_produccion);
}

export type DispatchReadyOrder = {
  order: Order;
  shortId: string;
  quantity: number;
  stageKey: string;
  dueDate: string | null;
  paymentLabel: string;
};

export function toDispatchReadyRow(order: Order): DispatchReadyOrder {
  const quantity = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.cantidad) || 0),
    0
  );
  const estadoPago = String(order.estado_pago || "").toLowerCase();
  const paymentLabel =
    estadoPago === "pagado" || order.pagado
      ? "Pagado"
      : estadoPago === "parcial"
        ? "Parcial"
        : "No pagado";

  return {
    order,
    shortId: `ORD-${order.id.slice(0, 3).toUpperCase()}`,
    quantity,
    stageKey: order.etapa_produccion || "dispatch",
    dueDate: order.fecha_estimada_entrega || null,
    paymentLabel,
  };
}

export type DispatchShipmentDirection =
  | "hacia_satelite"
  | "desde_satelite"
  | "ida_vuelta_satelite"
  | "a_cliente"
  | "otro";

export type DispatchShipmentRow = {
  id: string;
  orderId: string;
  shortId: string;
  customerName: string;
  direction: DispatchShipmentDirection;
  directionLabel: string;
  counterpart: string;
  address: string;
  amount: number;
  stageLabel: string;
  updatedAt: string | null;
  source: "costo_real" | "kanban" | "settlement";
};

function directionLabel(dir: DispatchShipmentDirection): string {
  if (dir === "hacia_satelite") return "Hacia satélite";
  if (dir === "desde_satelite") return "Desde satélite";
  if (dir === "ida_vuelta_satelite") return "Ida y vuelta satélite";
  if (dir === "a_cliente") return "A cliente";
  return "Envío / domicilio";
}

function inferDirection(text: string): DispatchShipmentDirection {
  const t = text.toLowerCase();
  if (t.includes("ida y vuelta") || t.includes("ida/vuelta")) {
    return "ida_vuelta_satelite";
  }
  if (t.includes("hacia") || t.includes("a satélite") || t.includes("a satelite") || t.includes("envio a")) {
    return "hacia_satelite";
  }
  if (t.includes("desde") || t.includes("retorno") || t.includes("devol")) {
    return "desde_satelite";
  }
  if (t.includes("cliente") || t.includes("entrega final") || t.includes("domicilio cliente")) {
    return "a_cliente";
  }
  return "otro";
}

function cardsFromOrder(order: Order): ProductionOrder[] {
  return Array.isArray(order.kanban_tarjetas)
    ? (order.kanban_tarjetas as ProductionOrder[])
    : [];
}

/** Solo líneas de envío/domicilio (nunca mano de obra ni costo de taller satélite). */
function isDomicilioShippingLine(line: RealCostLine): boolean {
  if (line.category && line.category !== "shipping") return false;
  const text = `${line.label || ""} ${line.stageLabel || ""}`.toLowerCase();
  // Excluir costos de producción satélite que a veces se etiquetan genérico
  if (
    text.includes("mano de obra") ||
    text.includes("taller") ||
    (text.includes("satélite") && !text.includes("domicilio") && !text.includes("envío") && !text.includes("envio") && !text.includes("ida"))
  ) {
    return false;
  }
  return true;
}

/** Domicilios / envíos registrados en costo real y tarjetas Kanban. */
export function collectShipmentsFromOrder(order: Order): DispatchShipmentRow[] {
  const rows: DispatchShipmentRow[] = [];
  const shortId = `ORD-${order.id.slice(0, 3).toUpperCase()}`;
  const seenKeys = new Set<string>();

  const pushRow = (row: DispatchShipmentRow) => {
    const key = `${row.orderId}|${row.counterpart}|${row.amount}|${row.direction}|${row.source}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    rows.push(row);
  };

  for (const card of cardsFromOrder(order)) {
    const meta = card.shippingMeta;
    // Columna Costo = solo domicilio (shippingCost / shippingMeta), nunca satelliteCost
    const amount = Number(
      meta?.kind === "satellite_roundtrip"
        ? meta.amount
        : meta?.amount ?? card.shippingCost
    );
    if (!(amount > 0)) continue;

    const satName =
      meta?.satelliteName ||
      card.satelliteAssignee ||
      card.satelliteName ||
      "Satélite";
    const isRoundTrip =
      meta?.kind === "satellite_roundtrip" ||
      (Boolean(card.satelliteAssigneeId) && Boolean(card.shippingCost));
    const dir: DispatchShipmentDirection = isRoundTrip
      ? "ida_vuelta_satelite"
      : card.satelliteAssigneeId
        ? "hacia_satelite"
        : "otro";

    pushRow({
      id: `card-ship-${order.id}-${card.id}`,
      orderId: order.id,
      shortId,
      customerName: order.cliente_nombre,
      direction: dir,
      directionLabel: directionLabel(dir),
      counterpart: satName,
      address: "",
      amount,
      stageLabel: isRoundTrip
        ? "Domicilio ida y vuelta"
        : card.stage || "—",
      updatedAt: meta?.registeredAt || null,
      source: "kanban",
    });
  }

  const breakdown = normalizeRealCostBreakdown(order.id, order.costo_real_desglose);
  const shippingLines: RealCostLine[] = (breakdown.shippingLines || []).filter(
    isDomicilioShippingLine
  );

  for (const line of shippingLines) {
    const label = String(line.label || "Envío / domicilio");
    const amount = Number(line.amount) || 0;
    if (!(amount > 0)) continue;

    // Evitar duplicar el domicilio ya tomado desde shippingMeta/shippingCost de la tarjeta
    if (/ida y vuelta|domicilio/i.test(label) && rows.some((r) => r.source === "kanban")) {
      continue;
    }
    const dir = inferDirection(`${label} ${line.userName || ""} ${line.stageLabel || ""}`);
    pushRow({
      id: `ship-${order.id}-${line.id || label}`,
      orderId: order.id,
      shortId,
      customerName: order.cliente_nombre,
      direction: dir,
      directionLabel: directionLabel(dir),
      counterpart: line.userName || order.cliente_nombre || "—",
      address: "",
      amount,
      stageLabel: line.stageLabel || line.stage || label || "—",
      updatedAt: line.updatedAt || null,
      source: "costo_real",
    });
  }

  return rows;
}

/** Movimientos satélite (enviado / recibido) como domicilios logísticos. */
export function collectShipmentsFromSatellites(
  satellites: Satellite[],
  ordersById: Map<string, Order>
): DispatchShipmentRow[] {
  const rows: DispatchShipmentRow[] = [];

  for (const sat of satellites) {
    const settlements = sat.settlements || {};
    for (const [rawOrderId, settlement] of Object.entries(settlements)) {
      const s = settlement as SatelliteSettlement;
      const work = String(s.work_status || "").trim();
      if (!work) continue;

      const orderId = rawOrderId.replace(/^PO-/, "");
      const order = ordersById.get(orderId) || ordersById.get(rawOrderId);
      const shortId = order
        ? `ORD-${order.id.slice(0, 3).toUpperCase()}`
        : `ORD-${orderId.slice(0, 3).toUpperCase()}`;

      const dir: DispatchShipmentDirection =
        work === "enviado"
          ? "hacia_satelite"
          : work === "recibido_completo" || work === "recibido_faltantes"
            ? "desde_satelite"
            : "otro";

      // amount/agreed_cost del settlement es costo de taller, NO domicilio → no va en Costo
      rows.push({
        id: `sat-${sat.id}-${rawOrderId}-${work}`,
        orderId: order?.id || orderId,
        shortId,
        customerName: order?.cliente_nombre || "—",
        direction: dir,
        directionLabel: directionLabel(dir),
        counterpart: sat.name,
        address: sat.address || "",
        amount: 0,
        stageLabel:
          work === "enviado"
            ? "Enviado a satélite"
            : work === "recibido_completo"
              ? "Recibido completo"
              : work === "recibido_faltantes"
                ? "Recibido con faltantes"
                : work,
        updatedAt: s.confirmed_at || s.paid_at || null,
        source: "settlement",
      });
    }
  }

  return rows;
}
