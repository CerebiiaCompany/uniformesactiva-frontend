export const getApiBaseUrl = () =>
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

/** Resuelve rutas de media del backend a URL absoluta usable en el navegador. */
export function resolveMediaUrl(pathOrUrl?: string | null): string | null {
    if (!pathOrUrl) return null;
    const raw = String(pathOrUrl).trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:")) return raw;

    const base = getApiBaseUrl().replace(/\/$/, "");
    let path = raw.startsWith("/") ? raw : `/${raw}`;
    if (path.startsWith("/media/")) return `${base}${path}`;
    if (path.startsWith("/soportes/") || path.startsWith("/logos/")) {
        return `${base}/media${path}`;
    }
    // Clave relativa del storage: "soportes/satelites/xxx.pdf"
    path = path.replace(/^\/+/, "");
    return `${base}/media/${path}`;
}