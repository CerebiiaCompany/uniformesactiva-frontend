/**
 * Permisos por capa Kanban (roles Producción, Diseño y Satélite).
 * Cada capa opera su columna; puede mover tarjetas solo a la etapa siguiente.
 * Acciones: ver tablero, solicitar inventario, editar tarjeta, ver historial.
 *
 * Fuente de verdad: backend (roles.kanban_capa_permissions).
 * localStorage solo cachea tras un GET/POST exitoso.
 */

const STORAGE_KEY_BY_ROLE = "ua:capa-actions-by-role-v1";
/** Legacy: solo Producción */
const LEGACY_PRODUCTION_KEY = "ua:production-capa-actions-v2";
const LEGACY_MODULES_KEY = "ua:production-capa-modules-v1";

export const KANBAN_OPERATOR_ROLES = ["Producción", "Diseño", "Satélite"] as const;
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
    description:
      "Pedir materiales del inventario desde la tarjeta. En rol Satélite aplica en todas las capas asignadas al usuario (aunque no se marque aquí).",
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

/**
 * Aplica la matriz Kanban que viene de /users/me/ (o permisos de rol)
 * para que operadores Satélite/Producción no dependan del localStorage del admin.
 */
export function applyKanbanCapaPermissionsFromApi(
  me: Record<string, unknown>,
  session?: ProductionSession
): CapaActionsMap {
  const byRole = me.kanban_capa_permissions_by_role;
  if (byRole && typeof byRole === "object" && !Array.isArray(byRole)) {
    for (const [roleName, map] of Object.entries(byRole as Record<string, unknown>)) {
      if (map && typeof map === "object" && !Array.isArray(map)) {
        saveCapaActionsForRole(roleName, map as CapaActionsMap);
      }
    }
  }

  const mergedRaw = me.capa_actions ?? me.kanban_capa_permissions;
  const merged: CapaActionsMap =
    mergedRaw && typeof mergedRaw === "object" && !Array.isArray(mergedRaw)
      ? (mergedRaw as CapaActionsMap)
      : {};

  const sess = session || readProductionSession();
  if (Object.keys(merged).length > 0) {
    if (sess.isSatellite) saveCapaActionsForRole("Satélite", merged);
    if (sess.isProduction) saveCapaActionsForRole("Producción", merged);
    if (sess.roles.includes("Diseño")) saveCapaActionsForRole("Diseño", merged);
  }

  return getSessionCapaActionsMap(sess);
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

/** Activa o desactiva todas las acciones de una capa (fila completa). */
export function toggleAllCapaActionsForStage(
  map: CapaActionsMap,
  stageKey: string,
  selectAll: boolean,
  allStageKeys?: string[]
): CapaActionsMap {
  const baseMap: CapaActionsMap = { ...map };
  if (Object.keys(baseMap).length === 0 && allStageKeys && allStageKeys.length > 0) {
    for (const k of allStageKeys) {
      baseMap[k] = [...DEFAULT_CAPA_ACTIONS];
    }
  }
  return {
    ...baseMap,
    [stageKey]: selectAll ? [...DEFAULT_CAPA_ACTIONS] : [],
  };
}

export function isCapaRowFullySelected(
  map: CapaActionsMap,
  stageKey: string,
  adminAssignedStageKeys?: string[]
): boolean {
  const selected = getCapaActionsForStage(map, stageKey, adminAssignedStageKeys);
  return DEFAULT_CAPA_ACTIONS.every((code) => selected.includes(code));
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
  stageKey: string,
  adminAssignedStageKeys?: string[]
): CapaActionCode[] {
  if (!stageKey) return [];
  // Si la capa está explícitamente en el mapa, respetar lo configurado
  // (incluye [] = ninguna acción permitida).
  if (map && Object.prototype.hasOwnProperty.call(map, stageKey)) {
    const configured = map[stageKey] || [];
    return Array.isArray(configured) ? ([...configured] as CapaActionCode[]) : [];
  }
  if (!map || Object.keys(map).length === 0) {
    // Sin matriz de rol cargada: las capas asignadas al usuario son visibles.
    if (!adminAssignedStageKeys || adminAssignedStageKeys.includes(stageKey)) {
      return [...DEFAULT_CAPA_ACTIONS];
    }
    return [];
  }
  if (adminAssignedStageKeys?.includes(stageKey)) {
    return [...DEFAULT_CAPA_ACTIONS];
  }
  return [];
}

export function capaHasAction(
  map: CapaActionsMap,
  stageKey: string,
  action: CapaActionCode,
  adminAssignedStageKeys?: string[]
): boolean {
  return getCapaActionsForStage(map, stageKey, adminAssignedStageKeys).includes(action);
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

export function mergeProductionUserFromApi(me: Record<string, unknown>): ProductionSession {
  if (typeof window === "undefined") return readProductionSession();
  try {
    const raw = localStorage.getItem("user");
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const next = {
      ...prev,
      id: me.id || prev.id,
      username: me.username || prev.username,
      email: me.email || prev.email,
      first_name: me.first_name || prev.first_name,
      last_name: me.last_name || prev.last_name,
      phone: me.phone || prev.phone || "",
      area: me.area || prev.area || "",
      cargo: me.cargo || prev.cargo || "",
      roles: me.roles || prev.roles,
      production_stage_key: me.production_stage_key || prev.production_stage_key || "",
      production_stage_keys:
        me.production_stage_keys || prev.production_stage_keys || [],
      satellite_id: me.satellite_id ? String(me.satellite_id) : prev.satellite_id || "",
    };
    localStorage.setItem("user", JSON.stringify(next));
  } catch {
    // keep previous session
  }
  return readProductionSession();
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
    const isDesign = roles.includes("Diseño");
    const isKanbanOperator = isProduction || isSatellite || isDesign;
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
  if (!session.isKanbanOperator) return true;
  if (session.stageKeys.length === 0) return false;
  return session.stageKeys.includes(cardStageKey);
}

/** Capas Kanban que el operador puede ver (asignadas por administrador). */
export function getOperatorVisibleStageKeys(session: ProductionSession): string[] {
  if (session.unrestricted) return [];
  return session.stageKeys;
}

export type KanbanAssignableCard = {
  stage: string;
  assigneeId?: string | null;
  satelliteAssigneeId?: string | null;
  stageAssignees?: Record<
    string,
    { userId?: string | null; name?: string; kind?: "production" | "satellite" }
  >;
};

export type StageAssigneeRef = {
  userId: string;
  name?: string;
  kind?: "production" | "satellite";
};

/** Responsable de una capa concreta (mapa por etapa + campos vivos si es la capa actual). */
export function getStageAssignee(
  card: KanbanAssignableCard,
  stageKey?: string
): StageAssigneeRef | null {
  const sk = (stageKey || card.stage || "").trim();
  if (!sk) return null;

  const fromMap =
    card.stageAssignees?.[sk] ||
    card.stageAssignees?.[`${sk}__satellite`] ||
    card.stageAssignees?.[`${sk}__production`];

  if (fromMap?.userId) {
    const uid = String(fromMap.userId).trim();
    if (uid) {
      return {
        userId: uid,
        name: fromMap.name,
        kind: fromMap.kind,
      };
    }
  }

  if (sk !== card.stage) return null;

  if (card.satelliteAssigneeId) {
    const uid = String(card.satelliteAssigneeId).trim();
    if (uid) {
      return { userId: uid, kind: "satellite" };
    }
  }
  if (card.assigneeId) {
    const uid = String(card.assigneeId).trim();
    if (uid) {
      return { userId: uid, kind: "production" };
    }
  }
  return null;
}

/** Operador asignado en la capa indicada (por defecto la capa actual de la tarjeta). */
export function isOperatorAssignedToCardOnStage(
  session: ProductionSession,
  card: KanbanAssignableCard,
  stageKey?: string
): boolean {
  if (session.unrestricted) return true;
  if (!session.userId) return false;

  const sk = (stageKey || card.stage || "").trim();
  if (!sk || !session.stageKeys.includes(sk)) return false;

  const assignee = getStageAssignee(card, sk);
  if (!assignee?.userId || assignee.userId !== session.userId) return false;

  if (assignee.kind === "satellite") return session.isSatellite;
  if (assignee.kind === "production") return session.isProduction;

  if (session.isSatellite && card.satelliteAssigneeId === session.userId) return true;
  if (session.isProduction && card.assigneeId === session.userId) return true;
  return assignee.userId === session.userId;
}

export function cardAssignedToOperatorOnAllowedStage(
  session: ProductionSession,
  card: KanbanAssignableCard
): boolean {
  if (session.unrestricted) return true;
  if (!session.userId || session.stageKeys.length === 0) return false;
  return isOperatorAssignedToCardOnStage(session, card, card.stage);
}

/** Opera la tarjeta solo si está asignado en la capa actual. */
export function canProductionUserOperateCard(
  session: ProductionSession,
  card: KanbanAssignableCard
): boolean {
  if (session.unrestricted) return true;
  if (!canProductionUserActOnStage(session, card.stage)) return false;
  return isOperatorAssignedToCardOnStage(session, card, card.stage);
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
  if (session.roles.includes("Diseño")) return getCapaActionsForRole("Diseño");
  return {};
}
