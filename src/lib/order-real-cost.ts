import type { ProductionOrder } from "@/data/mockData";

export const ORDER_REAL_COST_EVENT = "ua:order-real-cost-updated";

export type RealCostLine = {
  label: string;
  amount: number;
  stage?: string;
  stageLabel?: string;
  userId?: string | null;
  userName?: string;
  actorKind?: "production" | "satellite" | "provider" | "unassigned";
  category?: "materials" | "labor" | "mold" | "satellite" | "shipping";
};

export type RealCostByUser = {
  userId: string;
  userName: string;
  actorKind?: RealCostLine["actorKind"];
  amount: number;
  lines: RealCostLine[];
};

export type OrderRealCostBreakdown = {
  orderId: string;
  updatedAt: string;
  materials: number;
  materialsLines: RealCostLine[];
  labor: number;
  laborLines: RealCostLine[];
  satellites: number;
  satelliteLines: RealCostLine[];
  shipping: number;
  shippingLines: RealCostLine[];
  total: number;
  /** Desglose acumulado por usuario/taller que intervino en el Kanban */
  byUser: RealCostByUser[];
};

export type KanbanCostEntry = NonNullable<ProductionOrder["costLedger"]>[number];

function money(n: number) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function entryId(fingerprint: string) {
  return `ce-${fingerprint.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80)}`;
}

type Attribution = {
  userId?: string | null;
  userName?: string;
  actorKind?: KanbanCostEntry["actorKind"];
};

function productionAttribution(card: ProductionOrder): Attribution {
  if (card.assigneeId) {
    return {
      userId: card.assigneeId,
      userName: card.assignee || "Producción",
      actorKind: "production",
    };
  }
  return {
    userId: null,
    userName: "Sin asignar (producción)",
    actorKind: "unassigned",
  };
}

function satelliteUserAttribution(card: ProductionOrder): Attribution {
  if (card.satelliteAssigneeId) {
    return {
      userId: card.satelliteAssigneeId,
      userName: card.satelliteAssignee || "Usuario satélite",
      actorKind: "satellite",
    };
  }
  return productionAttribution(card);
}

function workingAttribution(card: ProductionOrder): Attribution {
  if (card.assigneeId) return productionAttribution(card);
  if (card.satelliteAssigneeId) return satelliteUserAttribution(card);
  return {
    userId: null,
    userName: "Sin asignar",
    actorKind: "unassigned",
  };
}

function actorKey(attr: Attribution): string {
  return (attr.userId || "na").trim() || "na";
}

/** Construye entradas de costo de la capa actual a partir de los campos vivos de la tarjeta. */
export function buildStageCostEntries(
  card: ProductionOrder,
  stage: string,
  stageLabel?: string
): KanbanCostEntry[] {
  const now = new Date().toISOString();
  const actor = workingAttribution(card);
  const satUser = satelliteUserAttribution(card);
  const uid = actorKey(actor);
  const entries: KanbanCostEntry[] = [];
  const labelStage = stageLabel || stage;

  for (const mat of card.requestedMaterials || []) {
    const qty = Number(mat.quantity) || 0;
    const unit = Number(mat.unitCost) || 0;
    const amount = money(qty * unit);
    if (amount <= 0 && qty <= 0) continue;
    // Por usuario + capa: no se pisan entre responsables distintos
    const fingerprint = `materials:${stage}:${uid}:${mat.materialId}`;
    entries.push({
      id: entryId(fingerprint),
      category: "materials",
      label: `${mat.materialName} × ${qty}`,
      amount,
      stage,
      stageLabel: labelStage,
      userId: actor.userId,
      userName: actor.userName,
      actorKind: actor.actorKind,
      fingerprint,
      updatedAt: now,
    });
  }

  if (card.laborCostEnabled) {
    const qty = Number(card.quantity) || 0;
    const perUnit = Number(card.laborCostPerUnit) || 0;
    const amount = money(qty * perUnit);
    if (amount > 0 || perUnit > 0) {
      const fingerprint = `labor:${stage}:${uid}`;
      entries.push({
        id: entryId(fingerprint),
        category: "labor",
        label: card.items?.trim()
          ? `MO · ${card.items.trim()} (${qty} × ${perUnit})`
          : `Mano de obra (${qty} × ${perUnit})`,
        amount,
        stage,
        stageLabel: labelStage,
        userId: actor.userId,
        userName: actor.userName,
        actorKind: actor.actorKind,
        fingerprint,
        updatedAt: now,
      });
    }
  }

  if (card.moldEnabled && card.moldCost != null && Number.isFinite(Number(card.moldCost))) {
    const amount = money(Number(card.moldCost));
    const fingerprint = `mold:${stage}:${uid}`;
    entries.push({
      id: entryId(fingerprint),
      category: "mold",
      label: card.moldResponsible
        ? `Moldería · ${card.moldResponsible}`
        : "Moldería",
      amount,
      stage,
      stageLabel: labelStage,
      userId: actor.userId,
      userName: card.moldResponsible?.trim() || actor.userName,
      actorKind: actor.actorKind,
      fingerprint,
      updatedAt: now,
    });
  }

  if (card.satelliteCost != null && Number.isFinite(Number(card.satelliteCost))) {
    const amount = money(Number(card.satelliteCost));
    const satUid = actorKey(satUser);
    const fingerprint = `satellite:${stage}:${satUid}`;
    const providerName = card.satelliteName || "Satélite (taller)";
    entries.push({
      id: entryId(fingerprint),
      category: "satellite",
      label: providerName,
      amount,
      stage,
      stageLabel: labelStage,
      userId: satUser.userId || null,
      userName: satUser.userId
        ? `${satUser.userName} · ${providerName}`
        : providerName,
      actorKind: satUser.userId ? "satellite" : "provider",
      fingerprint,
      updatedAt: now,
    });
  }

  const ship = Number(card.shippingCost);
  if (Number.isFinite(ship) && ship > 0) {
    const fingerprint = `shipping:${stage}:${uid}`;
    entries.push({
      id: entryId(fingerprint),
      category: "shipping",
      label: card.items?.trim() || "Envío",
      amount: money(ship),
      stage,
      stageLabel: labelStage,
      userId: actor.userId,
      userName: actor.userName,
      actorKind: actor.actorKind,
      fingerprint,
      updatedAt: now,
    });
  }

  return entries;
}

/**
 * Actualiza el ledger solo para el usuario actual en esta capa.
 * Conserva materiales/MO de otros usuarios (misma u otras capas).
 */
export function upsertStageCostLedger(
  card: ProductionOrder,
  stage: string,
  stageLabel?: string
): KanbanCostEntry[] {
  const next = buildStageCostEntries(card, stage, stageLabel);
  const nextFp = new Set(next.map((e) => e.fingerprint));
  const currentActor = actorKey(workingAttribution(card));
  const kept = (card.costLedger || []).filter((e) => {
    if (nextFp.has(e.fingerprint)) return false;
    const eUser = (e.userId || "na").trim() || "na";
    if (e.stage === stage && eUser === currentActor) return false;
    return true;
  });
  return [...kept, ...next];
}

export type FrozenWorkingCosts = Pick<
  ProductionOrder,
  | "costLedger"
  | "requestedMaterials"
  | "laborCostEnabled"
  | "laborCostPerUnit"
  | "moldEnabled"
  | "moldCost"
  | "moldResponsible"
  | "moldSizes"
  | "moldNotes"
  | "moldStatus"
  | "satelliteId"
  | "satelliteName"
  | "satelliteCost"
  | "shippingCost"
>;

/**
 * Congela costos vivos del responsable actual en el ledger y deja
 * materiales / MO en blanco para el siguiente usuario (sin borrar el historial).
 * Conserva materialsDeducted para no re-descontar inventario.
 */
export function freezeWorkingCostsForNextAssignee(
  card: ProductionOrder,
  stage: string,
  stageLabel?: string
): FrozenWorkingCosts {
  const costLedger = upsertStageCostLedger(card, stage, stageLabel);
  return {
    costLedger,
    requestedMaterials: [],
    laborCostEnabled: false,
    laborCostPerUnit: null,
    moldEnabled: false,
    moldCost: null,
    moldResponsible: "",
    moldSizes: "",
    moldNotes: "",
    moldStatus: undefined,
    satelliteId: card.satelliteId,
    satelliteName: card.satelliteName,
    satelliteCost: null,
    shippingCost: null,
  };
}

/** Al avanzar de capa: congela costos del usuario saliente y limpia campos vivos. */
export function freezeStageCostsOnMove(
  card: ProductionOrder,
  previousStage: string,
  stageLabel?: string
): FrozenWorkingCosts {
  return freezeWorkingCostsForNextAssignee(card, previousStage, stageLabel);
}

function lineFromEntry(entry: KanbanCostEntry): RealCostLine {
  const stageBit = entry.stageLabel || entry.stage;
  return {
    label: stageBit ? `[${stageBit}] ${entry.label}` : entry.label,
    amount: money(entry.amount),
    stage: entry.stage,
    stageLabel: entry.stageLabel,
    userId: entry.userId,
    userName: entry.userName,
    actorKind: entry.actorKind,
    category: entry.category,
  };
}

function groupByUser(lines: RealCostLine[]): RealCostByUser[] {
  const map = new Map<string, RealCostByUser>();
  for (const line of lines) {
    const key = line.userId || `name:${line.userName || "Sin asignar"}`;
    const existing = map.get(key);
    if (existing) {
      existing.amount = money(existing.amount + line.amount);
      existing.lines.push(line);
    } else {
      map.set(key, {
        userId: line.userId || key,
        userName: line.userName || "Sin asignar",
        actorKind: line.actorKind,
        amount: money(line.amount),
        lines: [line],
      });
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

function legacyLinesFromCard(card: ProductionOrder): {
  materialsLines: RealCostLine[];
  laborLines: RealCostLine[];
  satelliteLines: RealCostLine[];
  shippingLines: RealCostLine[];
} {
  const actor = workingAttribution(card);
  const satUser = satelliteUserAttribution(card);
  const materialsLines: RealCostLine[] = [];
  const laborLines: RealCostLine[] = [];
  const satelliteLines: RealCostLine[] = [];
  const shippingLines: RealCostLine[] = [];

  for (const mat of card.requestedMaterials || []) {
    const qty = Number(mat.quantity) || 0;
    const unit = Number(mat.unitCost) || 0;
    const amount = money(qty * unit);
    materialsLines.push({
      label: `${mat.materialName} × ${qty}`,
      amount,
      stage: card.stage,
      userId: actor.userId,
      userName: actor.userName,
      actorKind: actor.actorKind,
      category: "materials",
    });
  }

  if (card.laborCostEnabled) {
    const qty = Number(card.quantity) || 0;
    const perUnit = Number(card.laborCostPerUnit) || 0;
    const amount = money(qty * perUnit);
    if (amount > 0 || perUnit > 0) {
      laborLines.push({
        label: card.items?.trim()
          ? `MO · ${card.items.trim()} (${qty} × ${perUnit})`
          : `Mano de obra (${qty} × ${perUnit})`,
        amount,
        stage: card.stage,
        userId: actor.userId,
        userName: actor.userName,
        actorKind: actor.actorKind,
        category: "labor",
      });
    }
  }

  if (card.moldEnabled && card.moldCost != null && Number.isFinite(Number(card.moldCost))) {
    laborLines.push({
      label: card.moldResponsible
        ? `Moldería · ${card.moldResponsible}`
        : "Moldería",
      amount: money(Number(card.moldCost)),
      stage: card.stage,
      userId: actor.userId,
      userName: card.moldResponsible?.trim() || actor.userName,
      actorKind: actor.actorKind,
      category: "mold",
    });
  }

  if (card.satelliteCost != null && Number.isFinite(Number(card.satelliteCost))) {
    const providerName = card.satelliteName || "Satélite";
    satelliteLines.push({
      label: providerName,
      amount: money(Number(card.satelliteCost)),
      stage: card.stage,
      userId: satUser.userId || null,
      userName: satUser.userId
        ? `${satUser.userName} · ${providerName}`
        : providerName,
      actorKind: satUser.userId ? "satellite" : "provider",
      category: "satellite",
    });
  }

  const ship = Number(card.shippingCost);
  if (Number.isFinite(ship) && ship > 0) {
    shippingLines.push({
      label: card.items?.trim() || "Envío",
      amount: money(ship),
      stage: card.stage,
      userId: actor.userId,
      userName: actor.userName,
      actorKind: actor.actorKind,
      category: "shipping",
    });
  }

  return { materialsLines, laborLines, satelliteLines, shippingLines };
}

/** Prepara tarjetas con ledger actualizado (sin persistencia local). */
export function prepareCardsWithLedger(
  cards: ProductionOrder[],
  stageLabels?: Record<string, string>
): ProductionOrder[] {
  return cards.map((c) => ({
    ...c,
    costLedger: upsertStageCostLedger(
      c,
      c.stage,
      stageLabels?.[c.stage] || c.stage
    ),
  }));
}

/** Agrega costos operativos de todas las tarjetas Kanban de una orden. */
export function computeRealCostFromCards(
  orderId: string,
  cards: ProductionOrder[]
): OrderRealCostBreakdown {
  const materialsLines: RealCostLine[] = [];
  const laborLines: RealCostLine[] = [];
  const satelliteLines: RealCostLine[] = [];
  const shippingLines: RealCostLine[] = [];

  for (const card of cards) {
    const effectiveLedger =
      (card.costLedger && card.costLedger.length > 0) ||
      (card.requestedMaterials && card.requestedMaterials.length > 0) ||
      card.laborCostEnabled ||
      card.moldEnabled ||
      (card.satelliteCost != null && Number(card.satelliteCost) > 0) ||
      (card.shippingCost != null && Number(card.shippingCost) > 0)
        ? upsertStageCostLedger(card, card.stage)
        : card.costLedger || [];

    if (effectiveLedger.length > 0) {
      for (const entry of effectiveLedger) {
        const line = lineFromEntry(entry);
        if (entry.category === "materials") materialsLines.push(line);
        else if (entry.category === "satellite") satelliteLines.push(line);
        else if (entry.category === "shipping") shippingLines.push(line);
        else laborLines.push(line);
      }
    } else {
      const live = legacyLinesFromCard(card);
      materialsLines.push(...live.materialsLines);
      laborLines.push(...live.laborLines);
      satelliteLines.push(...live.satelliteLines);
      shippingLines.push(...live.shippingLines);
    }
  }

  const materials = money(materialsLines.reduce((s, l) => s + l.amount, 0));
  const labor = money(laborLines.reduce((s, l) => s + l.amount, 0));
  const satellites = money(satelliteLines.reduce((s, l) => s + l.amount, 0));
  const shipping = money(shippingLines.reduce((s, l) => s + l.amount, 0));
  const allLines = [
    ...materialsLines,
    ...laborLines,
    ...satelliteLines,
    ...shippingLines,
  ];

  return {
    orderId,
    updatedAt: new Date().toISOString(),
    materials,
    materialsLines,
    labor,
    laborLines,
    satellites,
    satelliteLines,
    shipping,
    shippingLines,
    total: money(materials + labor + satellites + shipping),
    byUser: groupByUser(allLines),
  };
}

/** Normaliza desglose recibido desde la API. */
export function normalizeRealCostBreakdown(
  orderId: string,
  raw: unknown
): OrderRealCostBreakdown | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<OrderRealCostBreakdown>;
  if (typeof d.total !== "number" && !Array.isArray(d.materialsLines)) {
    if (!Object.keys(d).length) return null;
  }
  return {
    orderId,
    updatedAt: d.updatedAt || new Date().toISOString(),
    materials: money(Number(d.materials) || 0),
    materialsLines: Array.isArray(d.materialsLines) ? d.materialsLines : [],
    labor: money(Number(d.labor) || 0),
    laborLines: Array.isArray(d.laborLines) ? d.laborLines : [],
    satellites: money(Number(d.satellites) || 0),
    satelliteLines: Array.isArray(d.satelliteLines) ? d.satelliteLines : [],
    shipping: money(Number(d.shipping) || 0),
    shippingLines: Array.isArray(d.shippingLines) ? d.shippingLines : [],
    total: money(Number(d.total) || 0),
    byUser: Array.isArray(d.byUser) ? d.byUser : [],
  };
}

export function getOrderRealCostFromOrder(order: {
  id: string;
  costo_real_desglose?: unknown;
  kanban_tarjetas?: ProductionOrder[] | null;
}): OrderRealCostBreakdown | null {
  const fromApi = normalizeRealCostBreakdown(order.id, order.costo_real_desglose);
  if (fromApi && (fromApi.total > 0 || fromApi.byUser.length > 0 || fromApi.materialsLines.length > 0)) {
    return fromApi;
  }
  const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
  if (!cards.length) return fromApi;
  return computeRealCostFromCards(order.id, cards);
}

export function emptyRealCost(orderId: string): OrderRealCostBreakdown {
  return {
    orderId,
    updatedAt: new Date().toISOString(),
    materials: 0,
    materialsLines: [],
    labor: 0,
    laborLines: [],
    satellites: 0,
    satelliteLines: [],
    shipping: 0,
    shippingLines: [],
    total: 0,
    byUser: [],
  };
}

/** Dispara refresco de UI en Órdenes cuando el costo real cambió en BD. */
export function notifyOrderRealCostUpdated(orderId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ORDER_REAL_COST_EVENT, { detail: { orderId } })
  );
}
