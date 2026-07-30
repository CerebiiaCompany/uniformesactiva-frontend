import type { CatalogOption, TallaGenero } from "@/types/variant";

const HOMBRE_ORDER: Record<string, number> = {
    XS: 1,
    S: 2,
    M: 3,
    L: 4,
    XL: 5,
    XXL: 6,
};

const HOMBRE_NAMES = new Set(Object.keys(HOMBRE_ORDER));
const MUJER_NAMES = new Set(["6", "8", "10", "12", "14", "16", "18", "20"]);

export function resolveTallaGenero(item: {
    genero?: string | null;
    name?: string | null;
    label?: string | null;
    code?: string | null;
}): TallaGenero {
    const raw = String(item.genero ?? "").toLowerCase().trim();
    if (raw === "mujer" || raw === "hombre") return raw;

    const name = String(item.name ?? item.label ?? item.code ?? "")
        .trim()
        .toUpperCase();

    if (MUJER_NAMES.has(String(item.name ?? "").trim()) || MUJER_NAMES.has(name)) {
        return "mujer";
    }
    if (HOMBRE_NAMES.has(name)) return "hombre";

    // Números típicos de tallaje mujer
    if (/^\d+$/.test(String(item.name ?? "").trim())) return "mujer";

    return "hombre";
}

function tallaSortKey(size: CatalogOption): number {
    const name = String(size.name ?? size.label ?? size.code ?? "").trim();
    const upper = name.toUpperCase();

    if (HOMBRE_ORDER[upper] != null) return HOMBRE_ORDER[upper];

    const asNumber = Number(name);
    if (!Number.isNaN(asNumber)) return asNumber;

    return Number.MAX_SAFE_INTEGER;
}

export function normalizeTallaCatalog(items: unknown[]): CatalogOption[] {
    return items.map((raw) => {
        if (typeof raw === "string") {
            return {
                id: raw,
                name: raw,
                code: raw,
                label: raw,
                genero: resolveTallaGenero({ name: raw }),
            };
        }

        const item = (raw ?? {}) as Record<string, unknown>;
        const name = String(item.name ?? item.label ?? item.code ?? item.value ?? "");
        const option: CatalogOption = {
            id: String(item.id ?? item.code ?? item.value ?? name),
            code: item.code != null ? String(item.code) : item.value != null ? String(item.value) : undefined,
            name,
            label: String(item.label ?? item.name ?? item.code ?? name),
            genero: resolveTallaGenero({
                genero: item.genero != null ? String(item.genero) : null,
                name,
                label: item.label != null ? String(item.label) : null,
                code: item.code != null ? String(item.code) : null,
            }),
        };
        return option;
    });
}

export function filterTallasByGenero(
    sizes: CatalogOption[],
    genero: TallaGenero
): CatalogOption[] {
    return sizes
        .filter((size) => (size.genero ?? resolveTallaGenero(size)) === genero)
        .sort((a, b) => tallaSortKey(a) - tallaSortKey(b));
}
