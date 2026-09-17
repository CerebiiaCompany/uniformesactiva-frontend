/**
 * Agregación de costos reales para el módulo Reportes → Costos reales.
 * Reutiliza desglose por orden + reportes existentes (sin APIs nuevas).
 */
import type { Order } from "@/hooks/useOrders";
import { resolveKanbanStageKey } from "@/lib/kanban-stage-theme";
import {
  emptyRealCost,
  getOrderRealCostFromOrder,
  normalizeRealCostBreakdown,
  type OrderRealCostBreakdown,
} from "@/lib/order-real-cost";
import type {
  DeliveriesReportRow,
  InventoryReportRow,
  ProductivityReportRow,
  ProfitabilityReportRow,
  SatellitesReportRow,
} from "@/types/reports";

export type RealCostConceptKey =
  | "materials"
  | "labor"
  | "mold"
  | "satellites"
  | "shipping"
  | "repairs"
  | "samples";

export type RealCostConceptRow = {
  key: RealCostConceptKey;
  label: string;
  origin: string;
  amount: number;
  sharePct: number;
  perGarment: number;
};

export type OrderRealCostRow = {
  id: string;
  codigo: string;
  cliente: string;
  estado: string;
  cantidad: number;
  estimado: number;
  real: number;
  materials: number;
  labor: number;
  mold: number;
  satellites: number;
  shipping: number;
  repairs: number;
  samples: number;
  realPerUnit: number;
  desviacion: number;
  venta: number;
  margenReal: number | null;
  hasBreakdown: boolean;
};

function money(n: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

function orderQty(order: Order): number {
  return (order.items || []).reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
}

function orderSale(order: Order): number {
  return money(Number(order.valor_venta_proyectado) || 0);
}

function shortCodigo(id: string, fallback?: string): string {
  if (fallback?.trim()) return fallback.trim();
  return `ORD-${String(id).slice(0, 3).toUpperCase()}`;
}

function splitLaborMold(breakdown: OrderRealCostBreakdown): { labor: number; mold: number } {
  let labor = 0;
  let mold = 0;
  for (const line of breakdown.laborLines || []) {
    const amt = money(Number(line.amount) || 0);
    if (String(line.category || "").toLowerCase() === "mold") mold += amt;
    else labor += amt;
  }
  if (labor === 0 && mold === 0) {
    labor = money(breakdown.labor);
  }
  return { labor: money(labor), mold: money(mold) };
}

function estimateRepairsFromBreakdown(breakdown: OrderRealCostBreakdown): number {
  const lines = [
    ...(breakdown.satelliteLines || []),
    ...(breakdown.laborLines || []),
  ];
  return money(
    lines
      .filter((l) => {
        const blob = `${l.label || ""} ${l.stageLabel || ""} ${l.stage || ""} ${l.detail || ""}`.toLowerCase();
        return /arreglo|reparac|ajuste/.test(blob);
      })
      .reduce((s, l) => s + (Number(l.amount) || 0), 0)
  );
}

function estimateSamplesFromBreakdown(breakdown: OrderRealCostBreakdown, order: Order): number {
  const blob = `${order.producto_nombre || ""} ${order.comentarios || ""}`.toLowerCase();
  if (!/muestra|prototipo/.test(blob)) return 0;
  // Si la orden es muestra, no duplicar todo el real: marcar 0 salvo líneas explícitas
  const lines = [...(breakdown.materialsLines || []), ...(breakdown.laborLines || [])];
  const explicit = lines.filter((l) =>
    /muestra|prototipo/.test(`${l.label || ""} ${l.detail || ""}`.toLowerCase())
  );
  return money(explicit.reduce((s, l) => s + (Number(l.amount) || 0), 0));
}

/**
 * Para reportes: lee desglose persistido + kanban sin anular por estado
 * (pending/confirmed también pueden tener costos registrados).
 */
function resolveBreakdownForReport(order: Order): OrderRealCostBreakdown {
  const persisted = normalizeRealCostBreakdown(order.id, order.costo_real_desglose);
  const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];

  if (!persisted && !cards.length) {
    return emptyRealCost(order.id);
  }

  // Bypass del gate de estado de getOrderRealCostFromOrder (solo in_production/delivered)
  return (
    getOrderRealCostFromOrder({
      id: order.id,
      estado: "in_production",
      costo_real_desglose: order.costo_real_desglose,
      kanban_tarjetas: order.kanban_tarjetas,
    }) ||
    persisted ||
    emptyRealCost(order.id)
  );
}

function breakdownHasRecords(breakdown: OrderRealCostBreakdown, rawDesglose: unknown): boolean {
  const total =
    money(breakdown.materials) +
    money(breakdown.labor) +
    money(breakdown.satellites) +
    money(breakdown.shipping);
  if (total > 0) return true;
  const lines =
    (breakdown.materialsLines?.length || 0) +
    (breakdown.laborLines?.length || 0) +
    (breakdown.satelliteLines?.length || 0) +
    (breakdown.shippingLines?.length || 0);
  if (lines > 0) return true;
  if (!rawDesglose || typeof rawDesglose !== "object") return false;
  return Object.keys(rawDesglose as object).length > 0;
}

/** Incluye satélites de taller (a diferencia del diálogo que a veces omite). */
export function computeFullRealCost(breakdown: OrderRealCostBreakdown): number {
  return money(
    breakdown.materials + breakdown.labor + breakdown.satellites + breakdown.shipping
  );
}

export function buildOrderRealCostRows(orders: Order[]): OrderRealCostRow[] {
  return orders.map((order) => {
    const breakdown = resolveBreakdownForReport(order);
    const { labor, mold } = splitLaborMold(breakdown);
    const materials = money(breakdown.materials);
    const satellites = money(breakdown.satellites);
    const shipping = money(breakdown.shipping);
    const repairs = estimateRepairsFromBreakdown(breakdown);
    const samples = estimateSamplesFromBreakdown(breakdown, order);
    const real = money(materials + labor + mold + satellites + shipping);
    const estimado = money(Number(order.costo_total) || 0);
    const venta = orderSale(order);
    const cantidad = orderQty(order);
    const hasBreakdown = breakdownHasRecords(breakdown, order.costo_real_desglose);

    return {
      id: order.id,
      codigo: shortCodigo(order.id),
      cliente: order.cliente_nombre || "—",
      estado: order.estado || "pending",
      cantidad,
      estimado,
      real,
      materials,
      labor,
      mold,
      satellites,
      shipping,
      repairs,
      samples,
      realPerUnit: cantidad > 0 ? money(real / cantidad) : 0,
      desviacion: money(real - estimado),
      venta,
      margenReal: venta > 0 ? money(((venta - real) / venta) * 100) : null,
      hasBreakdown,
    };
  });
}

export function buildGeneralConceptRows(
  orderRows: OrderRealCostRow[],
  extras?: {
    repairs?: number;
    samples?: number;
  }
): RealCostConceptRow[] {
  const totals = orderRows.reduce(
    (acc, r) => {
      acc.materials += r.materials;
      acc.labor += r.labor;
      acc.mold += r.mold;
      acc.satellites += r.satellites;
      acc.shipping += r.shipping;
      acc.qty += r.cantidad;
      return acc;
    },
    { materials: 0, labor: 0, mold: 0, satellites: 0, shipping: 0, qty: 0 }
  );

  const repairs = money(extras?.repairs ?? 0);
  const samples = money(extras?.samples ?? 0);
  const grand = money(
    totals.materials +
      totals.labor +
      totals.mold +
      totals.satellites +
      totals.shipping +
      repairs +
      samples
  );
  const qty = totals.qty || 1;

  const defs: Array<{
    key: RealCostConceptKey;
    label: string;
    origin: string;
    amount: number;
  }> = [
    {
      key: "materials",
      label: "Materiales (Inventario)",
      origin: "Solicitudes entregadas en el Kanban / costeo de variante",
      amount: money(totals.materials),
    },
    {
      key: "labor",
      label: "Mano de obra",
      origin: "Costo por unidad de cada tarjeta Kanban",
      amount: money(totals.labor),
    },
    {
      key: "mold",
      label: "Moldería",
      origin: "Moldería registrada en Diseño",
      amount: money(totals.mold),
    },
    {
      key: "satellites",
      label: "Satélites (mano de obra externa)",
      origin: "Trabajos asignados a satélites",
      amount: money(totals.satellites),
    },
    {
      key: "shipping",
      label: "Envíos y domicilios",
      origin: "Despachos y domicilios con costo real",
      amount: money(totals.shipping),
    },
    {
      key: "repairs",
      label: "Arreglos",
      origin: "Órdenes / trabajos marcados como arreglo",
      amount: repairs,
    },
    {
      key: "samples",
      label: "Muestras / prototipos",
      origin: "Órdenes con muestra o prototipo",
      amount: samples,
    },
  ];

  return defs.map((d) => ({
    ...d,
    sharePct: grand > 0 ? money((d.amount / grand) * 100) : 0,
    perGarment: money(d.amount / qty),
  }));
}

export function summarizeOrderRealCosts(orderRows: OrderRealCostRow[]) {
  const realTotal = money(orderRows.reduce((s, r) => s + r.real, 0));
  const estimadoTotal = money(orderRows.reduce((s, r) => s + r.estimado, 0));
  const ventaTotal = money(orderRows.reduce((s, r) => s + r.venta, 0));
  const desviacion = money(realTotal - estimadoTotal);
  const margenReal =
    ventaTotal > 0 ? money(((ventaTotal - realTotal) / ventaTotal) * 100) : null;

  return {
    realTotal,
    estimadoTotal,
    desviacion,
    margenReal,
    ventaTotal,
    ordenes: orderRows.length,
    conRegistro: orderRows.filter((r) => r.hasBreakdown).length,
  };
}

export function groupInventoryByCategory(rows: InventoryReportRow[]) {
  const map = new Map<string, { categoria: string; valor: number; items: number; stock: number }>();
  for (const row of rows) {
    const key = row.categoria || "Sin categoría";
    const cur = map.get(key) || { categoria: key, valor: 0, items: 0, stock: 0 };
    cur.valor += money(row.valor);
    cur.items += 1;
    cur.stock += Number(row.stock) || 0;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({ ...r, valor: money(r.valor) }))
    .sort((a, b) => b.valor - a.valor);
}

export function groupSatellitesByName(rows: SatellitesReportRow[]) {
  const map = new Map<
    string,
    { satelite: string; costo: number; porLiquidar: number; trabajos: number; cantidad: number }
  >();
  for (const row of rows) {
    const key = row.satelite || "Sin satélite";
    const cur = map.get(key) || {
      satelite: key,
      costo: 0,
      porLiquidar: 0,
      trabajos: 0,
      cantidad: 0,
    };
    cur.costo += money(row.costo);
    cur.porLiquidar += money(row.por_liquidar);
    cur.trabajos += 1;
    cur.cantidad += Number(row.cantidad) || 0;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      costo: money(r.costo),
      porLiquidar: money(r.porLiquidar),
    }))
    .sort((a, b) => b.costo - a.costo);
}

export function groupDeliveriesByType(rows: DeliveriesReportRow[]) {
  const map = new Map<string, { tipo: string; label: string; costo: number; movimientos: number }>();
  for (const row of rows) {
    const key = row.tipo || "otro";
    const cur = map.get(key) || {
      tipo: key,
      label: row.tipo_label || key,
      costo: 0,
      movimientos: 0,
    };
    cur.costo += money(row.costo);
    cur.movimientos += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({ ...r, costo: money(r.costo) }))
    .sort((a, b) => b.costo - a.costo);
}

export function groupProductivityByStage(rows: ProductivityReportRow[]) {
  const map = new Map<
    string,
    { etapa: string; label: string; prendas: number; tarjetas: number; diasPromedio: number }
  >();
  for (const row of rows) {
    const key = row.etapa || "sin_etapa";
    const cur = map.get(key) || {
      etapa: key,
      label: row.etapa_label || key,
      prendas: 0,
      tarjetas: 0,
      diasPromedio: 0,
    };
    cur.prendas += Number(row.cantidad) || 0;
    cur.tarjetas += 1;
    cur.diasPromedio += Number(row.dias_en_etapa) || 0;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      diasPromedio: r.tarjetas > 0 ? money(r.diasPromedio / r.tarjetas) : 0,
    }))
    .sort((a, b) => b.prendas - a.prendas);
}

const PROCESS_STAGE_LABELS: Record<string, string> = {
  design: "Diseño",
  cutting: "Corte",
  sewing: "Confección",
  embroidery: "Bordado",
  printing: "Estampado",
  quality: "Calidad",
  dispatch: "Despacho",
  packing: "Empaque",
  mold: "Moldería",
  satelite: "Satélite",
  satellite: "Satélite",
};

function processStageLabel(raw: string): string {
  const key = String(raw || "").trim().toLowerCase();
  if (!key) return "Sin etapa";
  return PROCESS_STAGE_LABELS[key] || raw;
}

function daysBetween(fromIso: string | null | undefined, to = new Date()): number {
  if (!fromIso) return 0;
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return 0;
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export type ProcessStageAgg = {
  etapa: string;
  label: string;
  ordenes: number;
  tarjetas: number;
  prendas: number;
  diasPromedio: number;
  materials: number;
  labor: number;
  mold: number;
  satellites: number;
  total: number;
  sharePct: number;
  /** @deprecated usar labor */
  costoMo: number;
};

export type ProcessDetailRow = {
  id: string;
  orden: string;
  ordenId: string;
  cliente: string;
  estado: string;
  etapa: string;
  etapaLabel: string;
  historial: string;
  tarjetas: number;
  prendas: number;
  dias: number;
  costoMo: number;
  activo: boolean;
};

type StageBucket = {
  etapa: string;
  label: string;
  ordenIds: Set<string>;
  tarjetas: number;
  prendas: number;
  diasSum: number;
  diasN: number;
  materials: number;
  labor: number;
  mold: number;
  satellites: number;
};

function ensureStageBucket(map: Map<string, StageBucket>, stageRaw: string): StageBucket {
  const etapa = String(stageRaw || "sin_etapa").trim().toLowerCase() || "sin_etapa";
  let cur = map.get(etapa);
  if (!cur) {
    cur = {
      etapa,
      label: processStageLabel(etapa),
      ordenIds: new Set<string>(),
      tarjetas: 0,
      prendas: 0,
      diasSum: 0,
      diasN: 0,
      materials: 0,
      labor: 0,
      mold: 0,
      satellites: 0,
    };
    map.set(etapa, cur);
  }
  return cur;
}

function normalizeStageKey(raw?: string | null, fallback = "sin_etapa"): string {
  const resolved = resolveKanbanStageKey(raw);
  if (resolved) return resolved;
  const key = String(raw || "").trim().toLowerCase();
  return key || fallback;
}

/**
 * Costo acumulado por etapa del proceso productivo.
 * Carga (tarjetas/prendas) desde Kanban; $ desde líneas del desglose real por stage/category.
 */
export function buildProcessAnalyticsFromOrders(orders: Order[]): {
  summary: {
    ordenes: number;
    tarjetas: number;
    prendas: number;
    diasPromedio: number;
    etapas: number;
    activas: number;
    costoEnProceso: number;
    etapasConCosto: number;
    costoPorPrenda: number;
  };
  byStage: ProcessStageAgg[];
  details: ProcessDetailRow[];
} {
  const now = new Date();
  const stageMap = new Map<string, StageBucket>();
  const details: ProcessDetailRow[] = [];

  for (const order of orders) {
    const qty = orderQty(order);
    const breakdown = resolveBreakdownForReport(order);
    const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
    const historial = Array.isArray(order.etapa_historial) ? order.etapa_historial : [];
    const orderFallbackStage = normalizeStageKey(
      order.etapa_produccion,
      cards[0] ? normalizeStageKey((cards[0] as { stage?: string }).stage, "design") : "design"
    );
    const activo =
      order.estado === "in_production" ||
      order.estado === "confirmed" ||
      order.estado === "ready";

    // --- Carga operativa por etapa actual de cada tarjeta ---
    const historyKeys: string[] = [];
    for (const h of historial) {
      const etapa = normalizeStageKey((h as { etapa?: string })?.etapa, "");
      if (etapa && !historyKeys.includes(etapa)) historyKeys.push(etapa);
    }

    let orderDays = 0;
    let orderCards = 0;
    let primaryStage = orderFallbackStage;

    if (cards.length > 0) {
      for (const card of cards) {
        const sh = Array.isArray((card as { stageHistory?: unknown }).stageHistory)
          ? ((card as { stageHistory: Array<{ stage?: string }> }).stageHistory || [])
          : [];
        for (const entry of sh) {
          const etapa = normalizeStageKey(entry?.stage, "");
          if (etapa && !historyKeys.includes(etapa)) historyKeys.push(etapa);
        }
      }

      for (const card of cards) {
        const stage = normalizeStageKey(
          (card as { stage?: string }).stage || order.etapa_produccion,
          "design"
        );
        const cardQty =
          Number((card as { quantity?: number }).quantity) > 0
            ? Number((card as { quantity?: number }).quantity)
            : qty;
        const daysRaw = Number((card as { daysInStage?: number }).daysInStage);
        const entered =
          Array.isArray((card as { stageHistory?: Array<{ stage?: string; enteredAt?: string }> }).stageHistory)
            ? [...((card as { stageHistory: Array<{ stage?: string; enteredAt?: string }> }).stageHistory)]
                .reverse()
                .find((e) => normalizeStageKey(e.stage) === stage)?.enteredAt
            : undefined;
        const days = Number.isFinite(daysRaw) && daysRaw >= 0 ? daysRaw : daysBetween(entered, now);

        const bucket = ensureStageBucket(stageMap, stage);
        bucket.ordenIds.add(order.id);
        bucket.tarjetas += 1;
        bucket.prendas += cardQty;
        bucket.diasSum += days;
        bucket.diasN += 1;

        orderDays += days;
        orderCards += 1;
        primaryStage = stage;
        if (!historyKeys.includes(stage)) historyKeys.push(stage);
      }
    } else {
      const currentStage = orderFallbackStage;
      if (!historyKeys.includes(currentStage)) historyKeys.push(currentStage);
      const lastEntry = [...historial]
        .reverse()
        .find((h) => normalizeStageKey((h as { etapa?: string }).etapa) === currentStage) as
        | { entered_at?: string }
        | undefined;
      const days = daysBetween(lastEntry?.entered_at || order.fecha_creacion, now);
      const bucket = ensureStageBucket(stageMap, currentStage);
      bucket.ordenIds.add(order.id);
      bucket.tarjetas += 1;
      bucket.prendas += qty;
      bucket.diasSum += days;
      bucket.diasN += 1;
      primaryStage = currentStage;
      orderCards = 1;
      orderDays = days;
    }

    // Asegurar buckets de etapas históricas (sin sumar prendas otra vez)
    for (const etapa of historyKeys) {
      const bucket = ensureStageBucket(stageMap, etapa);
      bucket.ordenIds.add(order.id);
    }

    // --- Costos por etapa desde líneas del desglose ---
    const addCost = (
      stageRaw: string | undefined,
      category: "materials" | "labor" | "mold" | "satellites",
      amount: number
    ) => {
      const amt = money(amount);
      if (!(amt > 0)) return;
      const stage = normalizeStageKey(stageRaw, primaryStage);
      const bucket = ensureStageBucket(stageMap, stage);
      bucket.ordenIds.add(order.id);
      if (category === "materials") bucket.materials += amt;
      else if (category === "labor") bucket.labor += amt;
      else if (category === "mold") bucket.mold += amt;
      else bucket.satellites += amt;
    };

    for (const line of breakdown.materialsLines || []) {
      addCost(line.stage || line.stageLabel, "materials", Number(line.amount) || 0);
    }
    for (const line of breakdown.laborLines || []) {
      const cat = String(line.category || "").toLowerCase() === "mold" ? "mold" : "labor";
      addCost(line.stage || line.stageLabel, cat, Number(line.amount) || 0);
    }
    for (const line of breakdown.satelliteLines || []) {
      addCost(line.stage || line.stageLabel, "satellites", Number(line.amount) || 0);
    }

    // Si hay totales sin líneas atribuidas, cargar a la etapa actual de la orden
    const { labor: laborSplit, mold: moldSplit } = splitLaborMold(breakdown);
    const linesMats = money(
      (breakdown.materialsLines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0)
    );
    const linesLabor = money(
      (breakdown.laborLines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0)
    );
    const linesSat = money(
      (breakdown.satelliteLines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0)
    );

    if (linesMats === 0 && money(breakdown.materials) > 0) {
      addCost(primaryStage, "materials", breakdown.materials);
    }
    if (linesLabor === 0 && (laborSplit > 0 || moldSplit > 0)) {
      addCost(primaryStage, "labor", laborSplit);
      addCost(primaryStage, "mold", moldSplit);
    }
    if (linesSat === 0 && money(breakdown.satellites) > 0) {
      addCost(primaryStage, "satellites", breakdown.satellites);
    }

    details.push({
      id: order.id,
      orden: shortCodigo(order.id),
      ordenId: order.id,
      cliente: order.cliente_nombre || "—",
      estado: order.estado || "pending",
      etapa: primaryStage,
      etapaLabel: processStageLabel(primaryStage),
      historial: historyKeys.map(processStageLabel).join(" → ") || processStageLabel(primaryStage),
      tarjetas: orderCards,
      prendas: qty,
      dias: orderCards > 0 ? money(orderDays / orderCards) : 0,
      costoMo: money(breakdown.labor),
      activo,
    });
  }

  const rawStages = [...stageMap.values()].map((r) => {
    const materials = money(r.materials);
    const labor = money(r.labor);
    const mold = money(r.mold);
    const satellites = money(r.satellites);
    const total = money(materials + labor + mold + satellites);
    return {
      etapa: r.etapa,
      label: r.label,
      ordenes: r.ordenIds.size,
      tarjetas: r.tarjetas,
      prendas: r.prendas,
      diasPromedio: r.diasN > 0 ? money(r.diasSum / r.diasN) : 0,
      materials,
      labor,
      mold,
      satellites,
      total,
      sharePct: 0,
      costoMo: labor,
    };
  });

  // Preferir etapas con carga (tarjetas/prendas); mantener las que solo tienen costo
  const byStageBase = rawStages
    .filter((r) => r.tarjetas > 0 || r.prendas > 0 || r.total > 0)
    .sort((a, b) => b.prendas - a.prendas || b.total - a.total);

  const grandTotal = money(byStageBase.reduce((s, r) => s + r.total, 0));
  const byStage: ProcessStageAgg[] = byStageBase.map((r) => ({
    ...r,
    sharePct: grandTotal > 0 ? money((r.total / grandTotal) * 100) : 0,
  }));

  const totalTarjetas = byStage.reduce((s, d) => s + d.tarjetas, 0);
  const totalPrendas = byStage.reduce((s, d) => s + d.prendas, 0);
  const diasVals = details.map((d) => d.dias).filter((d) => d > 0);
  const diasPromedio =
    diasVals.length > 0 ? money(diasVals.reduce((s, d) => s + d, 0) / diasVals.length) : 0;

  return {
    summary: {
      ordenes: details.length,
      tarjetas: totalTarjetas,
      prendas: totalPrendas,
      diasPromedio,
      etapas: byStage.length,
      activas: details.filter((d) => d.activo).length,
      costoEnProceso: grandTotal,
      etapasConCosto: byStage.filter((r) => r.total > 0).length,
      costoPorPrenda: totalPrendas > 0 ? money(grandTotal / totalPrendas) : 0,
    },
    byStage,
    details,
  };
}

export function mergeProfitabilityEstimates(
  orderRows: OrderRealCostRow[],
  profitabilityRows: ProfitabilityReportRow[]
): OrderRealCostRow[] {
  if (!profitabilityRows.length) return orderRows;
  const byId = new Map(profitabilityRows.map((r) => [r.id, r]));
  return orderRows.map((row) => {
    const p = byId.get(row.id);
    if (!p) return row;
    const estimado = money(p.costo_estimado || row.estimado);
    const venta = money(p.venta || row.venta);
    return {
      ...row,
      codigo: p.codigo || row.codigo,
      cliente: p.cliente || row.cliente,
      cantidad: p.cantidad || row.cantidad,
      estimado,
      venta,
      desviacion: money(row.real - estimado),
      margenReal: venta > 0 ? money(((venta - row.real) / venta) * 100) : row.margenReal,
    };
  });
}

/** Heurística: trabajos satélite con especialidad/etapa de arreglos. */
export function estimateRepairsFromSatellites(rows: SatellitesReportRow[]): number {
  return money(
    rows
      .filter((r) => {
        const blob = `${r.especialidad} ${r.etapa_label} ${r.etapa}`.toLowerCase();
        return /arreglo|reparac|ajuste/.test(blob);
      })
      .reduce((s, r) => s + (Number(r.costo) || 0), 0)
  );
}

export { money as roundMoney };
