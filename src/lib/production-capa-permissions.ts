/**
 * Permisos por capa Kanban (roles Producción y Satélite).
 * Cada capa opera su columna; puede mover tarjetas solo a la etapa siguiente.
 * Acciones: solicitar inventario, editar tarjeta, ver historial.
 */

const STORAGE_KEY_BY_ROLE = "ua:capa-actions-by-role-v1";
/** Legacy: solo Producción */
const LEGACY_PRODUCTION_KEY = "ua:production-capa-actions-v2";
const LEGACY_MODULES_KEY = "ua:production-capa-modules-v1";

export const KANBAN_OPERATOR_ROLES = ["Producción", "Satélite"] as const;
export type KanbanOperatorRole = (typeof KANBAN_OPERATOR_ROLES)[number];

export function isKanbanOperatorRole(role: string): boolean {
  return KANBAN_OPERATOR_ROLES.includes(role as KanbanOperatorRole);
}

export const KANBAN_ETAPAS_UPDATED_EVENT = "ua:kanban-etapas-updated";

export function notifyKanbanEtapasUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(KANBAN_ETAPAS_UPDATED_EVENT));
}

export const CAPA_KANBAN_ACTIONS = [
  {
    code: "ver_tablero",
    label: "Ver tablero",
    description: "Visualizar el tablero y las tarjetas de esta capa en Kanban.",
  },
  {
    code: "solicitar_inventario",
    label: "Solicitar inventario",
    description: "Pedir materiales del inventario desde la tarjeta.",
  },
  {
    code: "editar_tarjeta",
    label: "Editar tarjeta",
    description: "Abrir y guardar cambios en la tarjeta de su capa.",
  },
  {
    code: "ver_historial",
    label: "Ver historial",
    description: "Consultar el historial de producción del pedido.",
  },
] as const;

export type CapaActionCode = (typeof CAPA_KANBAN_ACTIONS)[number]["code"];
export type CapaActionsMap = Record<string, CapaActionCode[]>;
/** @deprecated Usar CapaActionsMap */
export type CapaModulesMap = CapaActionsMap;

export const DEFAULT_CAPA_ACTIONS: CapaActionCode[] = CAPA_KANBAN_ACTIONS.map(
  (a) => a.code
);

type RoleActionsStore = Record<string, CapaActionsMap>;

function readRoleStore(): RoleActionsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BY_ROLE);
    if (raw) {
      const parsed = JSON.parse(raw) as RoleActionsStore;
      if (parsed && typeof parsed === "object") return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_PRODUCTION_KEY);
    if (legacy) {
      const map = JSON.parse(legacy) as CapaActionsMap;
      const store: RoleActionsStore = { Producción: map || {} };
      writeRoleStore(store);
      return store;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeRoleStore(store: RoleActionsStore) {
  try {
    localStorage.setItem(STORAGE_KEY_BY_ROLE, JSON.stringify(store));
    localStorage.removeItem(LEGACY_PRODUCTION_KEY);
    localStorage.removeItem(LEGACY_MODULES_KEY);
  } catch {
    // ignore
  }
}

export function getCapaActionsForRole(roleNameOrId: string): CapaActionsMap {
  if (!roleNameOrId) return {};
  const store = readRoleStore();
  const direct = store[roleNameOrId] || store[roleNameOrId.trim()];
  if (direct && Object.keys(direct).length > 0) return direct;

  const lower = roleNameOrId.trim().toLowerCase();
  for (const [key, val] of Object.entries(store)) {
    if (key.trim().toLowerCase() === lower && val) return val;
  }
  return {};
}

/** @deprecated Prefer getCapaActionsForRole("Producción") */
export function getProductionCapaActions(): CapaActionsMap {
  return getCapaActionsForRole("Producción");
}

export function getProductionCapaModules(_roleId?: string): CapaActionsMap {
  return getProductionCapaActions();
}

export function saveCapaActionsForRole(
  roleName: string,
  map: CapaActionsMap,
  roleId?: string
) {
  if (!roleName && !roleId) return;
  const store = readRoleStore();
  if (roleName) store[roleName.trim()] = map;
  if (roleId) store[roleId.trim()] = map;
  writeRoleStore(store);
}

export function saveProductionCapaActions(map: CapaActionsMap) {
  saveCapaActionsForRole("Producción", map);
}

export function saveProductionCapaModules(_roleId: string, map: CapaActionsMap) {
  saveProductionCapaActions(map);
}

export function toggleCapaAction(
  map: CapaActionsMap,
  stageKey: string,
  action: CapaActionCode,
  allStageKeys?: string[]
): CapaActionsMap {
  const baseMap: CapaActionsMap = { ...map };
  if (Object.keys(baseMap).length === 0 && allStageKeys && allStageKeys.length > 0) {
    for (const k of allStageKeys) {
      baseMap[k] = [...DEFAULT_CAPA_ACTIONS];
    }
  }
  const current = new Set(baseMap[stageKey] ?? [...DEFAULT_CAPA_ACTIONS]);
  if (current.has(action)) current.delete(action);
  else current.add(action);
  return {
    ...baseMap,
    [stageKey]: Array.from(current) as CapaActionCode[],
  };
}

export function toggleCapaModule(
  map: CapaActionsMap,
  stageKey: string,
  moduleCode: string,
  allStageKeys?: string[]
): CapaActionsMap {
  return toggleCapaAction(map, stageKey, moduleCode as CapaActionCode, allStageKeys);
}

export function getCapaActionsForStage(
  map: CapaActionsMap,
  stageKey: string
): CapaActionCode[] {
  if (!stageKey) return [];
  if (map && stageKey in map) {
    return map[stageKey] || [];
  }
  if (!map || Object.keys(map).length === 0) {
    return [...DEFAULT_CAPA_ACTIONS];
  }
  return [];
}

export function capaHasAction(
  map: CapaActionsMap,
  stageKey: string,
  action: CapaActionCode
): boolean {
  return getCapaActionsForStage(map, stageKey).includes(action);
}

export function getNextStageKey(
  stages: { key: string }[],
  currentKey: string
): string | null {
  const idx = stages.findIndex((s) => s.key === currentKey);
  if (idx < 0 || idx >= stages.length - 1) return null;
  return stages[idx + 1].key;
}

export function canMoveCardToStage(
  stages: { key: string }[],
  fromKey: string,
  toKey: string
): boolean {
  if (fromKey === toKey) return true;
  const next = getNextStageKey(stages, fromKey);
  return next !== null && next === toKey;
}

export type ProductionSession = {
  roles: string[];
  isAdmin: boolean;
  isProduction: boolean;
  isSatellite: boolean;
  /** Opera Kanban con restricción de capa (Producción o Satélite). */
  isKanbanOperator: boolean;
  stageKey: string | null;
  stageKeys: string[];
  userId: string | null;
  unrestricted: boolean;
};

export function parseStageKeys(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((k) => String(k).trim()).filter(Boolean))];
  }
  if (typeof raw !== "string" || !raw.trim()) return [];
  return [
    ...new Set(
      raw
        .replace(/[;|]/g, ",")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    ),
  ];
}

export function joinStageKeys(keys: string[]): string {
  return parseStageKeys(keys).join(",");
}

function normalizeRoleName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  const m = s.match(/name=['"]([^'"]+)['"]/);
  if (m?.[1]) return m[1];
  return s;
}

export function readProductionSession(): ProductionSession {
  const empty: ProductionSession = {
    roles: [],
    isAdmin: false,
    isProduction: false,
    isSatellite: false,
    isKanbanOperator: false,
    stageKey: null,
    stageKeys: [],
    userId: null,
    unrestricted: true,
  };
  if (typeof window === "undefined") return empty;

  try {
    const raw = localStorage.getItem("user");
    if (!raw) return empty;
    const user = JSON.parse(raw) as {
      id?: string;
      roles?: unknown[];
      production_stage_key?: string;
      production_stage_keys?: string[];
    };
    const roles = (user.roles || [])
      .map(normalizeRoleName)
      .filter(Boolean);
    const isAdmin =
      roles.some((r) => {
        const lower = r.toLowerCase().trim();
        return (
          lower === "administrador" ||
          lower === "admin" ||
          lower === "superadmin" ||
          lower === "administrador general"
        );
      }) || Boolean((user as Record<string, unknown>).is_superuser);
    const isProduction = roles.includes("Producción");
    const isSatellite = roles.includes("Satélite");
    const isKanbanOperator = isProduction || isSatellite;
    const stageKeys = parseStageKeys(
      user.production_stage_keys?.length
        ? user.production_stage_keys
        : user.production_stage_key
    );
    const stageKey = stageKeys[0] || null;

    return {
      roles,
      isAdmin,
      isProduction,
      isSatellite,
      isKanbanOperator,
      stageKey,
      stageKeys,
      userId: (user.id || "").trim() || null,
      unrestricted: isAdmin,
    };
  } catch {
    return empty;
  }
}

export function canProductionUserActOnStage(
  session: ProductionSession,
  cardStageKey: string
): boolean {
  if (session.unrestricted) return true;
  if (session.stageKeys.length > 0) return session.stageKeys.includes(cardStageKey);
  return true;
}

export type KanbanAssignableCard = {
  stage: string;
  assigneeId?: string | null;
  satelliteAssigneeId?: string | null;
};

/** Opera la tarjeta si está asignada a él como Producción o como Satélite. */
export function canProductionUserOperateCard(
  session: ProductionSession,
  card: KanbanAssignableCard
): boolean {
  if (session.unrestricted) return true;
  if (!canProductionUserActOnStage(session, card.stage)) return false;
  if (!session.userId) return false;
  if (session.isProduction && card.assigneeId === session.userId) return true;
  if (session.isSatellite && card.satelliteAssigneeId === session.userId) return true;
  return false;
}

/** Mapa de acciones según el rol Kanban del usuario en sesión. */
export function getSessionCapaActionsMap(session: ProductionSession): CapaActionsMap {
  if (session.isAdmin) return {};
  const merged: CapaActionsMap = {};
  for (const role of session.roles) {
    const map = getCapaActionsForRole(role);
    for (const [stageKey, actions] of Object.entries(map)) {
      merged[stageKey] = Array.from(
        new Set([...(merged[stageKey] || []), ...actions])
      ) as CapaActionCode[];
    }
  }
  if (Object.keys(merged).length > 0) return merged;
  if (session.isSatellite) return getCapaActionsForRole("Satélite");
  if (session.isProduction) return getCapaActionsForRole("Producción");
  return {};
}
