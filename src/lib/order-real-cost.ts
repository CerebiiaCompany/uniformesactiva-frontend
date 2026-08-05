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
  /** Capas del Kanban donde intervino este usuario */
  stages: { key: string; label: string }[];
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

function isAttributed(attr: Attribution): boolean {
  return Boolean(attr.userId && attr.actorKind !== "unassigned");
}

/**
 * Elimina costos fantasma «Sin asignar» (p. ej. materiales que se re-escribieron
 * al cambiar de capa antes de reasignar responsable).
 */
export function sanitizeCostLedger(ledger: KanbanCostEntry[]): KanbanCostEntry[] {
  if (!ledger?.length) return [];

  const assignedMaterialKeys = new Set(
    ledger
      .filter((e) => e.category === "materials" && e.userId)
      .map((e) => `${String(e.label).trim()}|${money(e.amount)}`)
  );

  return ledger.filter((e) => {
    const hasUser = Boolean(e.userId);
    if (hasUser) return true;

    // Costos de taller/proveedor pueden no tener userId de operador
    if (e.category === "satellite" || e.actorKind === "provider") return true;

    // Materiales sin usuario: si ya existen atribuidos (misma etiqueta/monto), son duplicados
    if (e.category === "materials") {
      const key = `${String(e.label).trim()}|${money(e.amount)}`;
      if (assignedMaterialKeys.has(key)) return false;
      // Sin responsable real no deben aparecer en el desglose
      return false;
    }

    // MO / moldería / envío sin usuario = fantasma al mover capa
    if (
      e.category === "labor" ||
      e.category === "mold" ||
      e.category === "shipping"
    ) {
      return false;
    }

    return false;
  });
}

function sanitizeLines(lines: RealCostLine[]): RealCostLine[] {
  if (!lines.length) return [];
  const assignedMaterialKeys = new Set(
    lines
      .filter((l) => l.category === "materials" && l.userId)
      .map((l) => {
        const base = (l.label || "").replace(/^\[[^\]]+\]\s*/, "").trim();
        return `${base}|${money(l.amount)}`;
      })
  );

  return lines.filter((l) => {
    if (l.userId) return true;
    if (l.category === "satellite" || l.actorKind === "provider") return true;
    if (l.category === "materials") {
      const base = (l.label || "").replace(/^\[[^\]]+\]\s*/, "").trim();
      const key = `${base}|${money(l.amount)}`;
      if (assignedMaterialKeys.has(key)) return false;
      return false;
    }
    if (
      l.category === "labor" ||
      l.category === "mold" ||
      l.category === "shipping" ||
      l.actorKind === "unassigned" ||
      !l.userName ||
      l.userName === "Sin asignar" ||
      l.userName === "Sin asignar (producción)"
    ) {
      return false;
    }
    return true;
  });
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
  const entries: KanbanCostEntry[] = [];
  const labelStage = stageLabel || stage;

  // Sin responsable asignado no se generan costos vivos (evita «Sin asignar» al mover capa).
  const canAttributeOperator = isAttributed(actor);
  const uid = canAttributeOperator ? actorKey(actor) : "na";

  if (canAttributeOperator) {
    for (const mat of card.requestedMaterials || []) {
      const qty = Number(mat.quantity) || 0;
      const unit = Number(mat.unitCost) || 0;
      const amount = money(qty * unit);
      if (amount <= 0 && qty <= 0) continue;
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

  return entries;
}

/**
 * Actualiza el ledger solo para el usuario actual en esta capa.
 * Conserva materiales/MO de otros usuarios (misma u otras capas).
 * Nunca crea ni conserva costos fantasma «Sin asignar».
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
    // Limpia fantasmas sin usuario de la capa actual
    if (e.stage === stage && eUser === "na") return false;
    if (e.stage === stage && eUser === currentActor) return false;
    return true;
  });
  return sanitizeCostLedger([...kept, ...next]);
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
    if (
      !line.userId &&
      (line.actorKind === "unassigned" ||
        !line.userName ||
        line.userName === "Sin asignar" ||
        line.userName === "Sin asignar (producción)")
    ) {
      continue;
    }
    const key = line.userId || `name:${line.userName || "Sin asignar"}`;
    const existing = map.get(key);
    const stageKey = line.stage || "";
    const stageLabel = line.stageLabel || stageKey;
    if (existing) {
      existing.amount = money(existing.amount + line.amount);
      existing.lines.push(line);
      if (
        stageKey &&
        !existing.stages.some((s) => s.key === stageKey)
      ) {
        existing.stages.push({ key: stageKey, label: stageLabel || stageKey });
      }
    } else {
      map.set(key, {
        userId: line.userId || key,
        userName: line.userName || "Sin asignar",
        actorKind: line.actorKind,
        amount: money(line.amount),
        stages: stageKey
          ? [{ key: stageKey, label: stageLabel || stageKey }]
          : [],
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

  // Sin responsable no se reportan costos vivos (evita «Sin asignar»).
  if (isAttributed(actor)) {
    for (const mat of card.requestedMaterials || []) {
      const qty = Number(mat.quantity) || 0;
      const unit = Number(mat.unitCost) || 0;
      const amount = money(qty * unit);
      materialsLines.push({
        label: `${mat.materialName} × ${qty}`,
        amount,
        stage: card.stage,
        stageLabel: card.stage,
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
          stageLabel: card.stage,
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
        stageLabel: card.stage,
        userId: actor.userId,
        userName: card.moldResponsible?.trim() || actor.userName,
        actorKind: actor.actorKind,
        category: "mold",
      });
    }

    const ship = Number(card.shippingCost);
    if (Number.isFinite(ship) && ship > 0) {
      shippingLines.push({
        label: card.items?.trim() || "Envío",
        amount: money(ship),
        stage: card.stage,
        stageLabel: card.stage,
        userId: actor.userId,
        userName: actor.userName,
        actorKind: actor.actorKind,
        category: "shipping",
      });
    }
  }

  if (card.satelliteCost != null && Number.isFinite(Number(card.satelliteCost))) {
    const providerName = card.satelliteName || "Satélite";
    satelliteLines.push({
      label: providerName,
      amount: money(Number(card.satelliteCost)),
      stage: card.stage,
      stageLabel: card.stage,
      userId: satUser.userId || null,
      userName: satUser.userId
        ? `${satUser.userName} · ${providerName}`
        : providerName,
      actorKind: satUser.userId ? "satellite" : "provider",
      category: "satellite",
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
      {
        ...c,
        costLedger: sanitizeCostLedger(c.costLedger || []),
      },
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
    const cleanedCard: ProductionOrder = {
      ...card,
      costLedger: sanitizeCostLedger(card.costLedger || []),
    };
    const effectiveLedger =
      (cleanedCard.costLedger && cleanedCard.costLedger.length > 0) ||
      (cleanedCard.requestedMaterials && cleanedCard.requestedMaterials.length > 0) ||
      cleanedCard.laborCostEnabled ||
      cleanedCard.moldEnabled ||
      (cleanedCard.satelliteCost != null && Number(cleanedCard.satelliteCost) > 0) ||
      (cleanedCard.shippingCost != null && Number(cleanedCard.shippingCost) > 0)
        ? upsertStageCostLedger(cleanedCard, cleanedCard.stage)
        : cleanedCard.costLedger || [];

    if (effectiveLedger.length > 0) {
      for (const entry of effectiveLedger) {
        const line = lineFromEntry(entry);
        if (entry.category === "materials") materialsLines.push(line);
        else if (entry.category === "satellite") satelliteLines.push(line);
        else if (entry.category === "shipping") shippingLines.push(line);
        else laborLines.push(line);
      }
    } else {
      const live = legacyLinesFromCard(cleanedCard);
      materialsLines.push(...live.materialsLines);
      laborLines.push(...live.laborLines);
      satelliteLines.push(...live.satelliteLines);
      shippingLines.push(...live.shippingLines);
    }
  }

  const cleanMaterials = sanitizeLines(materialsLines);
  const cleanLabor = sanitizeLines(laborLines);
  const cleanSatellite = sanitizeLines(satelliteLines);
  const cleanShipping = sanitizeLines(shippingLines);

  const materials = money(cleanMaterials.reduce((s, l) => s + l.amount, 0));
  const labor = money(cleanLabor.reduce((s, l) => s + l.amount, 0));
  const satellites = money(cleanSatellite.reduce((s, l) => s + l.amount, 0));
  const shipping = money(cleanShipping.reduce((s, l) => s + l.amount, 0));
  const allLines = [
    ...cleanMaterials,
    ...cleanLabor,
    ...cleanSatellite,
    ...cleanShipping,
  ];

  return {
    orderId,
    updatedAt: new Date().toISOString(),
    materials,
    materialsLines: cleanMaterials,
    labor,
    laborLines: cleanLabor,
    satellites,
    satelliteLines: cleanSatellite,
    shipping,
    shippingLines: cleanShipping,
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
  const materialsLines = sanitizeLines(
    Array.isArray(d.materialsLines) ? d.materialsLines : []
  );
  const laborLines = sanitizeLines(Array.isArray(d.laborLines) ? d.laborLines : []);
  const satelliteLines = sanitizeLines(
    Array.isArray(d.satelliteLines) ? d.satelliteLines : []
  );
  const shippingLines = sanitizeLines(
    Array.isArray(d.shippingLines) ? d.shippingLines : []
  );
  const materials = money(
    materialsLines.length
      ? materialsLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
      : Number(d.materials) || 0
  );
  const labor = money(
    laborLines.length
      ? laborLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
      : Number(d.labor) || 0
  );
  const satellites = money(
    satelliteLines.length
      ? satelliteLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
      : Number(d.satellites) || 0
  );
  const shipping = money(
    shippingLines.length
      ? shippingLines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
      : Number(d.shipping) || 0
  );
  const allLines = [...materialsLines, ...laborLines, ...satelliteLines, ...shippingLines];
  const byUserRaw = Array.isArray(d.byUser) ? d.byUser : [];
  const byUser =
    allLines.length > 0
      ? groupByUser(allLines)
      : byUserRaw
          .filter(
            (u) =>
              u.userId &&
              u.userName !== "Sin asignar" &&
              u.userName !== "Sin asignar (producción)"
          )
          .map((u) => ({
            ...u,
            stages: Array.isArray(u.stages) ? u.stages : [],
          }));

  return {
    orderId,
    updatedAt: d.updatedAt || new Date().toISOString(),
    materials,
    materialsLines,
    labor,
    laborLines,
    satellites,
    satelliteLines,
    shipping,
    shippingLines,
    total: money(materials + labor + satellites + shipping),
    byUser,
  };
}

export function getOrderRealCostFromOrder(order: {
  id: string;
  costo_real_desglose?: unknown;
  kanban_tarjetas?: ProductionOrder[] | null;
}): OrderRealCostBreakdown | null {
  const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
  // Preferir recálculo desde tarjetas para limpiar fantasmas «Sin asignar» persistidos
  if (cards.length) {
    return computeRealCostFromCards(order.id, cards);
  }
  const fromApi = normalizeRealCostBreakdown(order.id, order.costo_real_desglose);
  if (fromApi && (fromApi.total > 0 || fromApi.byUser.length > 0 || fromApi.materialsLines.length > 0)) {
    return fromApi;
  }
  return fromApi;
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
