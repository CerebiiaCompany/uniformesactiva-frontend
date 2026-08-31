import type { ProductionOrder } from "@/data/mockData";
import { formatCurrency, formatUnitCost } from "@/lib/format-number";
import { getTNSOrderRealMaterialCost } from "@/services/tnsService";
import type { TNSOrderRealMaterialCostLine, TNSOrderRealMaterialCostResponse } from "@/types/tns";
import { fetchVariantCostSummary } from "@/hooks/useGetCostSummary";
import { parseApiNumber } from "@/lib/format-number";

export const ORDER_REAL_COST_EVENT = "ua:order-real-cost-updated";

/** Materiales entregados y acumulación operativa aplican desde «en producción». */
export function orderIncludesDeliveredMaterials(estado?: string | null): boolean {
  return estado === "in_production" || estado === "delivered";
}

export type RealCostLine = {
  label: string;
  /** Detalle opcional (cantidad × precio) */
  detail?: string;
  amount: number;
  stage?: string;
  stageLabel?: string;
  userId?: string | null;
  userName?: string;
  actorKind?: "production" | "satellite" | "provider" | "unassigned";
  category?: "materials" | "labor" | "mold" | "satellite" | "shipping";
  /** Origen del material en costo real (costeo vs solicitud Kanban) */
  materialSource?: "delivered" | "kanban_additional";
  /** Código TNS exacto (prod_Dist_Cod) para deduplicar y consumo de inventario */
  materialCode?: string;
};

/** Etiqueta de material sin repetir código cuando el nombre ya lo incluye. */
export function formatMaterialDisplayLabel(codigo: string, nombre: string): string {
  const c = (codigo || "").trim();
  const n = (nombre || "").trim();
  if (!c || c === "—") return n || c;
  if (!n) return c;
  const nCompact = n.replace(/\s+/g, " ").trim();
  const cUpper = c.toUpperCase();
  if (nCompact.toUpperCase() === cUpper) return nCompact;
  if (nCompact.toUpperCase().startsWith(`${cUpper} `)) return nCompact;
  const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escaped}\\b`, "i").test(nCompact)) return nCompact;
  return `${c} ${nCompact}`.trim();
}

/** Extrae código TNS de una etiqueta o nombre de material. */
export function extractMaterialCodeFromText(text: string): string {
  const t = (text || "").trim();
  if (!t) return "";
  const first = t.split(/\s+/)[0] ?? "";
  if (/^[A-Z0-9][A-Z0-9._-]{2,}$/i.test(first) && /\d/.test(first)) {
    return first.toUpperCase();
  }
  const tokens = t.split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const tok = tokens[i] ?? "";
    if (/^\d{4,}$/.test(tok)) return tok.toUpperCase();
  }
  return "";
}

function normalizeKanbanMaterialCode(codeOrLabel: string): string {
  const raw = (codeOrLabel || "").trim();
  if (!raw || raw === "—") return "";
  const extracted = extractMaterialCodeFromText(raw);
  if (extracted) return extracted.toUpperCase();
  return raw.replace(/\s+/g, "").toUpperCase();
}

function kanbanAdditionalDedupKey(line: RealCostLine): string {
  const code = normalizeKanbanMaterialCode(
    line.materialCode || extractMaterialCodeFromText(line.label) || line.label
  );
  const stage = (line.stage || "").trim().toLowerCase();
  // Misma tela en capas distintas = líneas distintas (cada capa aporta su solicitud)
  if (code && !code.startsWith("SIN-")) {
    return `stage:${stage}|code:${code}`;
  }
  const baseLabel = (line.label || "").replace(/^\[[^\]]+\]\s*/, "").trim().toLowerCase();
  return `stage:${stage}|label:${baseLabel}`;
}

/** Una sola línea por código TNS; al editar gana la cantidad/monto más reciente (mayor). */
export function dedupeKanbanAdditionalLines(lines: RealCostLine[]): RealCostLine[] {
  const map = new Map<string, RealCostLine>();
  for (const line of lines) {
    const key = kanbanAdditionalDedupKey(line);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, line);
      continue;
    }
    // Preferir la línea con mayor monto (solicitud actualizada), no la de TNS antigua
    if (line.amount > existing.amount) {
      map.set(key, line);
    }
  }
  return [...map.values()];
}

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

function workingAttribution(card: ProductionOrder, stageKey?: string): Attribution {
  if (stageKey && card.stageAssignees) {
    const sAssign =
      card.stageAssignees[stageKey] ||
      card.stageAssignees[`${stageKey}__satellite`] ||
      card.stageAssignees[`${stageKey}__production`];
    if (sAssign?.userId && sAssign?.name) {
      return {
        userId: sAssign.userId,
        userName: sAssign.name,
        actorKind: sAssign.kind === "satellite" ? "satellite_user" : "production_user",
      };
    }
  }
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

/** True si la tarjeta tiene producción o satélite asignado en la capa (vivo o en stageAssignees). */
export function cardHasAssigneeForStage(
  card: ProductionOrder,
  stageKey?: string
): boolean {
  return isAttributed(workingAttribution(card, stageKey || card.stage));
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
    // Materiales del costeo / entregados siempre permanecen en el desglose
    if (l.category === "materials" && l.materialSource === "delivered") return true;
    if (l.category === "materials") {
      const base = (l.label || "").replace(/^\[[^\]]+\]\s*/, "").trim();
      const key = `${base}|${money(l.amount)}`;
      if (assignedMaterialKeys.has(key)) return false;
      // Adicionales Kanban sin usuario: conservar si tienen monto/etiqueta
      if (l.materialSource === "kanban_additional") return true;
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
  const actor = workingAttribution(card, stage);
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

    const stageLabor = card.stageLaborConfig?.[stage];
    const laborEnabled =
      stageLabor !== undefined
        ? Boolean(stageLabor.enabled)
        : false;
    const laborPerUnit =
      stageLabor !== undefined && stageLabor.perUnit != null
        ? Number(stageLabor.perUnit)
        : 0;

    if (laborEnabled) {
      const qty = Number(card.quantity) || 0;
      const amount = money(qty * laborPerUnit);
      if (amount > 0 || laborPerUnit > 0) {
        const fingerprint = `labor:${stage}:${uid}`;
        entries.push({
          id: entryId(fingerprint),
          category: "labor",
          label: card.items?.trim()
            ? `MO · ${card.items.trim()} (${qty} × ${laborPerUnit})`
            : `Mano de obra (${qty} × ${laborPerUnit})`,
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
  | "materialsDeducted"
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
 * Pasa requestedMaterials de la capa saliente a materialsDeducted (histórico inmutable).
 */
export function freezeWorkingCostsForNextAssignee(
  card: ProductionOrder,
  stage: string,
  stageLabel?: string
): FrozenWorkingCosts {
  const costLedger = upsertStageCostLedger(card, stage, stageLabel);
  const attr = workingAttribution(card, stage);
  const label = stageLabel || stage;
  const frozenFromLive = (card.requestedMaterials || [])
    .filter((m) => m?.materialId && (Number(m.quantity) || 0) > 0)
    .map((m) => ({
      materialId: m.materialId,
      materialName: m.materialName || m.materialId,
      materialCode: m.materialCode?.trim() || undefined,
      quantity: Number(m.quantity) || 0,
      unitCost: Number(m.unitCost) || 0,
      stage,
      stageLabel: label,
      userId: attr.userId ?? null,
      userName: attr.userName,
    }));

  const prevHistory = (card.materialsDeducted || []).filter((m) => {
    if (!m?.materialId) return false;
    // Quitar entradas de esta misma capa (se reemplazan por el snapshot vivo)
    if (m.stage && m.stage === stage) return false;
    return (Number(m.quantity) || 0) > 0;
  });

  return {
    costLedger,
    requestedMaterials: [],
    materialsDeducted: [...prevHistory, ...frozenFromLive],
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

    const stageLabor = card.stageLaborConfig?.[card.stage];
    const laborEnabled =
      stageLabor !== undefined ? Boolean(stageLabor.enabled) : false;
    const perUnit =
      stageLabor !== undefined && stageLabor.perUnit != null
        ? Number(stageLabor.perUnit)
        : 0;

    if (laborEnabled) {
      const qty = Number(card.quantity) || 0;
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
  return cards.map((c) => {
    const reconciled = reconcileOrphanLiveMaterials(c, stageLabels);
    return {
      ...reconciled,
      costLedger: upsertStageCostLedger(
        {
          ...reconciled,
          costLedger: sanitizeCostLedger(reconciled.costLedger || []),
        },
        reconciled.stage,
        stageLabels?.[reconciled.stage] || reconciled.stage
      ),
    };
  });
}

/**
 * Solo congela vivos residuales cuando la tarjeta YA avanzó de capa y quedó
 * sin asignar (pendiente de admin). Si hay responsable en la capa actual,
 * requestedMaterials son de ESTA capa y deben permanecer editables («Solicitaste»).
 */
export function reconcileOrphanLiveMaterials(
  card: ProductionOrder,
  stageLabels?: Record<string, string>
): ProductionOrder {
  const live = (card.requestedMaterials || []).filter(
    (m) => m?.materialId && (Number(m.quantity) || 0) > 0
  );
  if (!live.length) return card;

  // Con asignación en la capa actual: no tocar solicitudes vivas
  if (card.assigneeId || card.satelliteAssigneeId) return card;

  const history = card.stageHistory || [];
  const visitedStages = new Set(
    history.map((h) => h.stage).filter(Boolean) as string[]
  );
  visitedStages.add(card.stage);
  if (visitedStages.size <= 1) return card;

  const hist = card.materialsDeducted || [];
  const hasTaggedPrevious = hist.some(
    (m) => m.stage && m.stage !== card.stage && (Number(m.quantity) || 0) > 0
  );
  // Ya hay histórico de otras capas → no mover los vivos (no debería haber sin asignar)
  if (hasTaggedPrevious) return card;

  const prevFromHistory = [...history]
    .reverse()
    .find((h) => h.stage && h.stage !== card.stage);
  const prevStage =
    prevFromHistory?.stage || [...visitedStages].find((s) => s !== card.stage);
  if (!prevStage) return card;

  const prevLabel = stageLabels?.[prevStage] || prevStage;
  const attr = workingAttribution(card, prevStage);
  const frozen = live.map((m) => ({
    materialId: m.materialId,
    materialName: m.materialName || m.materialId,
    materialCode: m.materialCode?.trim() || undefined,
    quantity: Number(m.quantity) || 0,
    unitCost: Number(m.unitCost) || 0,
    stage: prevStage,
    stageLabel: prevLabel,
    userId: attr.userId ?? null,
    userName: attr.userName,
  }));

  const prevHistory = hist.filter((m) => {
    if (!m?.materialId || (Number(m.quantity) || 0) <= 0) return false;
    if (m.stage === prevStage) return false;
    return true;
  });

  return {
    ...card,
    requestedMaterials: [],
    materialsDeducted: [...prevHistory, ...frozen],
  };
}

/** Costos Kanban sin líneas de materiales (estas vienen de TNS / costeo al estar en producción). */
function stripKanbanMaterialLines(breakdown: OrderRealCostBreakdown): OrderRealCostBreakdown {
  const operationalLines = [
    ...breakdown.laborLines,
    ...breakdown.satelliteLines,
    ...breakdown.shippingLines,
  ];
  const labor = money(breakdown.labor);
  const satellites = money(breakdown.satellites);
  const shipping = money(breakdown.shipping);
  return {
    ...breakdown,
    materials: 0,
    materialsLines: [],
    labor,
    satellites,
    shipping,
    total: money(labor + satellites + shipping),
    byUser: groupByUser(operationalLines),
  };
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

  const safeCards = Array.isArray(cards) ? cards : [];
  for (const card of safeCards) {
    if (!card) continue;
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

function tnsMaterialToRealCostLine(line: TNSOrderRealMaterialCostLine): RealCostLine {
  const unitShort =
    (line.unit || "").trim().toLowerCase() === "metro" ? "m" : (line.unit || "u.").trim();
  const stageLabel = (line.stage_label || line.stage || "").trim();
  const unitCostFmt = formatUnitCost(line.unit_cost_tns);
  const isTnsPrice = line.price_source === "tns" || line.material_kind === "tela";
  const priceLabel =
    line.unit_cost_tns > 0
      ? isTnsPrice
        ? `$${unitCostFmt} TNS`
        : `$${unitCostFmt} costeo`
      : isTnsPrice
        ? "sin precio TNS"
        : "sin precio costeo";
  const qtyFmt = Number(line.quantity).toLocaleString("es-CO", {
    maximumFractionDigits: 4,
  });
  const materialCode = (line.codigo || "").trim();
  const materialLabel = formatMaterialDisplayLabel(materialCode, line.nombre || "");
  const isKanban = line.source === "kanban";
  const requester = (line.user_name || "").trim();
  const qtyPart = `(${qtyFmt} ${unitShort} × ${priceLabel})`;
  const detail = isKanban && requester
    ? `Solicitado por ${requester} · ${qtyPart}`
    : qtyPart;

  return {
    label: materialLabel,
    materialCode: materialCode && materialCode !== "—" ? materialCode : undefined,
    detail,
    amount: money(line.amount),
    stage: line.stage || undefined,
    stageLabel: stageLabel || undefined,
    userId:
      line.source === "costeo_variante"
        ? "tns-costeo-variante"
        : line.user_id || undefined,
    userName: line.user_name || undefined,
    actorKind: line.source === "kanban" ? "production" : "unassigned",
    category: "materials",
    materialSource: line.source === "kanban" ? "kanban_additional" : "delivered",
  };
}

export function splitMaterialLines(lines: RealCostLine[]) {
  const delivered: RealCostLine[] = [];
  const additional: RealCostLine[] = [];
  for (const line of lines) {
    if (line.materialSource === "kanban_additional") {
      additional.push(line);
    } else {
      delivered.push(line);
    }
  }
  return { delivered, additional };
}

export type KanbanMaterialRequest = {
  materialId: string;
  materialName: string;
  materialCode?: string;
  quantity: number;
  unitCost?: number;
  stage?: string;
  stageLabel?: string;
  userId?: string | null;
  userName?: string;
};

/**
 * Solo solicitudes VIVAS de la capa actual (para editar en el modal).
 * Nunca incluye el histórico de capas anteriores.
 */
export function getLiveMaterialRequestsForEdit(card: ProductionOrder): KanbanMaterialRequest[] {
  return (card.requestedMaterials || [])
    .filter((mat) => mat?.materialId && (Number(mat.quantity) || 0) > 0)
    .map((mat) => ({
      materialId: mat.materialId,
      materialName: mat.materialName || mat.materialId,
      materialCode: mat.materialCode?.trim() || undefined,
      quantity: Number(mat.quantity) || 0,
      unitCost: Number(mat.unitCost) || 0,
    }));
}

/** @deprecated Prefer getLiveMaterialRequestsForEdit — el histórico no se edita. */
export function mergeMaterialRequestsForEdit(card: ProductionOrder): KanbanMaterialRequest[] {
  return getLiveMaterialRequestsForEdit(card);
}

export function cardHasKanbanMaterialRequests(card: ProductionOrder): boolean {
  return getLiveMaterialRequestsForEdit(card).length > 0;
}

/**
 * Une histórico de capas cerradas + solicitudes vivas de la capa actual
 * para el desglose de costo real (todas las capas, sin mezclar edición).
 */
export function collectAllKanbanMaterialRequests(card: ProductionOrder): KanbanMaterialRequest[] {
  const out: KanbanMaterialRequest[] = [];
  const currentStage = card.stage || "";

  for (const mat of card.materialsDeducted || []) {
    if (!mat?.materialId) continue;
    const qty = Number(mat.quantity) || 0;
    if (qty <= 0) continue;
    // Histórico de otras capas (o legacy sin stage)
    if (mat.stage && mat.stage === currentStage) continue;
    out.push({
      materialId: mat.materialId,
      materialName: mat.materialName || mat.materialId,
      materialCode: mat.materialCode?.trim() || undefined,
      quantity: qty,
      unitCost: Number(mat.unitCost) || 0,
      stage: mat.stage,
      stageLabel: mat.stageLabel || mat.stage,
      userId: mat.userId,
      userName: mat.userName,
    });
  }

  for (const mat of getLiveMaterialRequestsForEdit(card)) {
    out.push({
      ...mat,
      stage: currentStage || undefined,
      stageLabel: currentStage || undefined,
    });
  }

  return out;
}

/** Materiales adicionales solicitados en tarjetas Kanban (todas las capas). */
export function collectKanbanAdditionalMaterialLines(
  cards: ProductionOrder[]
): RealCostLine[] {
  const lines: RealCostLine[] = [];

  for (const card of cards) {
    if (!card) continue;
    const liveAttr = workingAttribution(card, card.stage);

    for (const mat of collectAllKanbanMaterialRequests(card)) {
      const qty = Number(mat.quantity) || 0;
      if (qty <= 0) continue;
      const unit = Number(mat.unitCost) || 0;
      const amount = money(qty * unit);
      const qtyFmt = qty.toLocaleString("es-CO", { maximumFractionDigits: 4 });
      const stageKey = mat.stage || card.stage || "";
      const stageLabel = mat.stageLabel || stageKey;
      const requester =
        mat.userName ||
        (stageKey === card.stage ? liveAttr.userName : undefined) ||
        "Kanban · solicitud adicional";
      const userId =
        mat.userId ?? (stageKey === card.stage ? liveAttr.userId : undefined);
      const materialCode =
        mat.materialCode || extractMaterialCodeFromText(mat.materialName) || undefined;
      const label = materialCode
        ? formatMaterialDisplayLabel(materialCode, mat.materialName)
        : mat.materialName;
      lines.push({
        label,
        materialCode,
        detail:
          unit > 0
            ? `Solicitado por ${requester}${stageLabel ? ` · ${stageLabel}` : ""} · (${qtyFmt} uds × $${formatUnitCost(unit)})`
            : `Solicitado por ${requester}${stageLabel ? ` · ${stageLabel}` : ""} · (${qtyFmt} uds)`,
        amount,
        stage: stageKey || undefined,
        stageLabel: stageLabel || undefined,
        userId,
        userName: requester,
        actorKind: stageKey === card.stage ? liveAttr.actorKind : "production",
        category: "materials",
        materialSource: "kanban_additional",
      });
    }
  }

  return dedupeKanbanAdditionalLines(sanitizeLines(lines));
}

function rebuildMaterialsBreakdown(
  breakdown: OrderRealCostBreakdown,
  materialsLines: RealCostLine[]
): OrderRealCostBreakdown {
  const clean = sanitizeLines(materialsLines);
  const materials = money(clean.reduce((s, l) => s + l.amount, 0));
  const allLines = [
    ...clean,
    ...breakdown.laborLines,
    ...breakdown.satelliteLines,
    ...breakdown.shippingLines,
  ];
  return {
    ...breakdown,
    materials,
    materialsLines: clean,
    total: money(materials + breakdown.labor + breakdown.satellites + breakdown.shipping),
    byUser: groupByUser(allLines),
    updatedAt: new Date().toISOString(),
  };
}

/** Completa adicionales Kanban desde las tarjetas (reemplaza, no acumula sobre TNS). */
export function mergeKanbanAdditionalMaterialsFromCards(
  breakdown: OrderRealCostBreakdown,
  cards: ProductionOrder[]
): OrderRealCostBreakdown {
  const fromCards = collectKanbanAdditionalMaterialLines(cards);
  const delivered = breakdown.materialsLines.filter(
    (l) => l.materialSource !== "kanban_additional"
  );

  return rebuildMaterialsBreakdown(breakdown, [...delivered, ...fromCards]);
}

/**
 * Une materiales entregados (costeo) + adicionales (Kanban).
 * Nunca descarta entregados solo porque el Kanban ya tenga MO u otros costos.
 */
export function composeMaterialBreakdown(
  operational: OrderRealCostBreakdown,
  deliveredLines: RealCostLine[],
  additionalLines: RealCostLine[]
): OrderRealCostBreakdown {
  const delivered = sanitizeLines(
    deliveredLines.map((l) => ({
      ...l,
      category: "materials" as const,
      materialSource: "delivered" as const,
    }))
  );
  const additional = dedupeKanbanAdditionalLines(
    sanitizeLines(
      additionalLines.map((l) => ({
        ...l,
        category: "materials" as const,
        materialSource: "kanban_additional" as const,
      }))
    )
  );
  return rebuildMaterialsBreakdown(operational, [...delivered, ...additional]);
}

/** MO configurada en costeo de variante × cantidades de la orden. */
export async function computeOrderEstimatedLaborCost(
  items: Array<{ subproducto_id?: string; talla_id?: string | null; cantidad?: number }>
): Promise<number> {
  if (!items?.length) return 0;

  const summaryCache = new Map<string, Awaited<ReturnType<typeof fetchVariantCostSummary>>>();
  let total = 0;

  for (const item of items) {
    const variantId = item.subproducto_id?.trim();
    const qty = Number(item.cantidad) || 0;
    if (!variantId || qty <= 0) continue;

    let summary = summaryCache.get(variantId);
    if (!summary) {
      try {
        summary = await fetchVariantCostSummary(variantId);
        summaryCache.set(variantId, summary);
      } catch {
        continue;
      }
    }

    const sizeRow = item.talla_id
      ? summary.sizes.find((s) => s.talla_id === item.talla_id)
      : undefined;
    const laborPerUnit = parseApiNumber(sizeRow?.labor_total ?? summary.labor_total ?? 0);
    total += laborPerUnit * qty;
  }

  return money(total);
}

/** Costo real operativo principal: materiales (entregados + adicionales) + MO Kanban. */
export function computeRealAccumulatedCost(breakdown: OrderRealCostBreakdown): number {
  return money(breakdown.materials + breakdown.labor);
}

/**
 * Incorpora materiales TNS (costeo + Kanban) sin borrar entregados ya persistidos
 * si la API no devolvió líneas de costeo.
 */
export function mergeTnsMaterialsIntoRealCost(
  breakdown: OrderRealCostBreakdown,
  tnsMaterials: TNSOrderRealMaterialCostResponse | null | undefined
): OrderRealCostBreakdown {
  if (!tnsMaterials?.materials_lines?.length) {
    return breakdown;
  }

  const fromTns = tnsMaterials.materials_lines.map(tnsMaterialToRealCostLine);
  // Solo costeo/entregados desde TNS. Los adicionales Kanban salen de las tarjetas
  // (fuente de verdad al editar); mezclar TNS aquí duplicaba 1 m + 2 uds.
  const tnsDelivered = fromTns.filter((l) => l.materialSource !== "kanban_additional");

  const prevDelivered = breakdown.materialsLines.filter(
    (l) => l.materialSource !== "kanban_additional"
  );
  const prevAdditional = breakdown.materialsLines.filter(
    (l) => l.materialSource === "kanban_additional"
  );

  const delivered = tnsDelivered.length > 0 ? tnsDelivered : prevDelivered;

  return composeMaterialBreakdown(breakdown, delivered, prevAdditional);
}

/** Costo real operativo + materiales valorizados en TNS (solo en producción). */
export async function computeFullRealCostFromOrder(
  orderId: string,
  cards: ProductionOrder[],
  options?: {
    estado?: string | null;
    /** Desglose previo para no perder materiales entregados si falla TNS */
    previousBreakdown?: OrderRealCostBreakdown | null;
  }
): Promise<OrderRealCostBreakdown> {
  if (!orderIncludesDeliveredMaterials(options?.estado)) {
    return emptyRealCost(orderId);
  }

  const operational = stripKanbanMaterialLines(computeRealCostFromCards(orderId, cards));
  const previousDelivered = (options?.previousBreakdown?.materialsLines || []).filter(
    (l) => l.materialSource !== "kanban_additional"
  );
  const seeded = composeMaterialBreakdown(operational, previousDelivered, []);

  try {
    const tnsMaterials = await getTNSOrderRealMaterialCost(orderId);
    const merged = mergeTnsMaterialsIntoRealCost(seeded, tnsMaterials);
    return mergeKanbanAdditionalMaterialsFromCards(merged, cards);
  } catch {
    return mergeKanbanAdditionalMaterialsFromCards(seeded, cards);
  }
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
    (Array.isArray(d.materialsLines) ? d.materialsLines : []).map((line) => {
      const inferredSource =
        line.materialSource ||
        (line.userId === "tns-costeo-variante" ||
        (line.userName || "").toLowerCase().includes("costeo de variante")
          ? "delivered"
          : line.stage || line.materialSource === "kanban_additional"
            ? "kanban_additional"
            : "delivered");
      return {
        ...line,
        category: line.category || "materials",
        materialSource: inferredSource,
      };
    })
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
  estado?: string;
  costo_real_desglose?: unknown;
  kanban_tarjetas?: ProductionOrder[] | null;
}): OrderRealCostBreakdown | null {
  if (!orderIncludesDeliveredMaterials(order.estado)) {
    return emptyRealCost(order.id);
  }

  const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
  const operational = cards.length
    ? stripKanbanMaterialLines(computeRealCostFromCards(order.id, cards))
    : emptyRealCost(order.id);

  const persisted = normalizeRealCostBreakdown(order.id, order.costo_real_desglose);
  const persistedDelivered = (persisted?.materialsLines || []).filter(
    (l) => l.materialSource !== "kanban_additional"
  );
  const fromCardsAdditional = collectKanbanAdditionalMaterialLines(cards);
  // Tarjetas = fuente de verdad al editar; no mezclar con adicionales viejos del desglose
  const additional = fromCardsAdditional.length
    ? fromCardsAdditional
    : dedupeKanbanAdditionalLines(
        (persisted?.materialsLines || []).filter((l) => l.materialSource === "kanban_additional")
      );

  // Sin tarjetas: usar desglose persistido completo si existe
  if (!cards.length && persisted) {
    return composeMaterialBreakdown(
      {
        ...operational,
        labor: persisted.labor || operational.labor,
        laborLines: persisted.laborLines?.length
          ? persisted.laborLines
          : operational.laborLines,
        satellites: persisted.satellites || operational.satellites,
        satelliteLines: persisted.satelliteLines?.length
          ? persisted.satelliteLines
          : operational.satelliteLines,
        shipping: persisted.shipping || operational.shipping,
        shippingLines: persisted.shippingLines?.length
          ? persisted.shippingLines
          : operational.shippingLines,
      },
      persistedDelivered,
      additional
    );
  }

  // Con tarjetas: MO/satélites del Kanban + materiales entregados persistidos + adicionales
  return composeMaterialBreakdown(operational, persistedDelivered, additional);
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
