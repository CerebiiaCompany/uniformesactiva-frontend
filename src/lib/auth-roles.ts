import { jwtDecode } from "jwt-decode";

function normalizeRoleName(raw: unknown): string {
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return "";
    const m = s.match(/name=['"]([^'"]+)['"]/);
    return (m?.[1] || s).trim();
  }
  if (raw && typeof raw === "object" && "name" in raw) {
    return String((raw as { name?: string }).name || "").trim();
  }
  return "";
}

function stripAccents(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function roleLooksAdmin(raw: unknown): boolean {
  const lower = stripAccents(normalizeRoleName(raw));
  if (!lower) return false;
  return (
    lower.includes("administrador") ||
    lower.includes("administracion") ||
    lower === "admin" ||
    lower === "superadmin"
  );
}

function roleLooksNotificationAudience(raw: unknown): boolean {
  const lower = stripAccents(normalizeRoleName(raw));
  if (!lower) return false;
  return (
    lower.includes("administrador") ||
    lower.includes("administracion") ||
    lower === "admin" ||
    lower === "superadmin" ||
    lower.includes("comercial") ||
    lower.includes("inventario") ||
    lower.includes("despacho")
  );
}

function areaLooksNotificationAudience(areaRaw: unknown): boolean {
  const area = stripAccents(String(areaRaw || ""));
  if (!area) return false;
  return (
    area.includes("administracion") ||
    area.includes("comercial") ||
    area.includes("inventario") ||
    area.includes("despacho")
  );
}

/** Detecta rol Administrador desde localStorage / JWT (tolerant a repr de Role). */
export function isAdminUser(): boolean {
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.is_superuser) return true;
      const area = String(user?.area || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (area.includes("administracion")) return true;

      const roles = Array.isArray(user?.roles) ? user.roles : [];
      if (roles.some(roleLooksAdmin)) return true;
    }

    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode<{
        roles?: unknown[];
        is_superuser?: boolean;
      }>(token);
      if (decoded?.is_superuser) return true;
      const roles = Array.isArray(decoded?.roles) ? decoded.roles : [];
      return roles.some(roleLooksAdmin);
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Áreas con campana de notificaciones:
 * Administración, Comercial, Inventario y Despacho.
 */
export function canReceiveNotifications(): boolean {
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.is_superuser) return true;
      if (areaLooksNotificationAudience(user?.area)) return true;
      const roles = Array.isArray(user?.roles) ? user.roles : [];
      if (roles.some(roleLooksNotificationAudience)) return true;
    }

    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode<{
        roles?: unknown[];
        area?: string;
        is_superuser?: boolean;
      }>(token);
      if (decoded?.is_superuser) return true;
      if (areaLooksNotificationAudience(decoded?.area)) return true;
      const roles = Array.isArray(decoded?.roles) ? decoded.roles : [];
      return roles.some(roleLooksNotificationAudience);
    }
  } catch {
    return false;
  }
  return false;
}
