/**
 * Orden de módulos alineado al menú lateral (AppSidebar).
 * Usar en Roles y permisos para que la matriz sea fácil de configurar.
 */
export const MODULE_SIDEBAR_ORDER = [
  "dashboard",
  "website",
  "clients",
  "quotations",
  "orders",
  "production",
  "inventory",
  "satellites",
  "products",
  "billing",
  "reports",
  "users",
] as const;

const orderIndex = new Map(
  MODULE_SIDEBAR_ORDER.map((code, idx) => [code, idx])
);

export function sortModulesBySidebarOrder<T extends { code: string }>(
  modules: T[]
): T[] {
  return [...modules].sort((a, b) => {
    const ia = orderIndex.get(a.code as (typeof MODULE_SIDEBAR_ORDER)[number]);
    const ib = orderIndex.get(b.code as (typeof MODULE_SIDEBAR_ORDER)[number]);
    return (ia ?? 999) - (ib ?? 999);
  });
}
