import type { CatalogOption, TallaGenero } from "@/types/variant";

const HOMBRE_ORDER: Record<string, number> = {
    XS: 1,
    S: 2,
    M: 3,
    L: 4,
    XL: 5,
    XXL: 6,
    XXXL: 7,
    "26": 20,
    "28": 21,
    "30": 22,
    "32": 23,
    "34": 24,
    "36": 25,
    "38": 26,
    "40": 27,
    "42": 28,
    "44": 29,
    "SOBRE MEDIDA": 99,
};

const HOMBRE_LETTER_NAMES = new Set(["XS", "S", "M", "L", "XL", "XXL", "XXXL"]);
const HOMBRE_PANTALON_NAMES = new Set(["26", "28", "30", "32", "34", "36", "38", "40", "42", "44"]);
const MUJER_NAMES = new Set([
    "0",
    "2",
    "4",
    "6",
    "8",
    "10",
    "12",
    "14",
    "16",
    "18",
    "20",
    "22",
]);
const SOBRE_MEDIDA_ALIASES = new Set(["SOBRE MEDIDA", "SOBREMEDIDA", "SM"]);

export function resolveTallaGenero(item: {
    genero?: string | null;
    talla_genero?: string | null;
    name?: string | null;
    label?: string | null;
    code?: string | null;
}): TallaGenero {
    const raw = String(item.genero ?? item.talla_genero ?? "")
        .toLowerCase()
        .trim();
    if (raw === "mujer" || raw === "hombre") return raw;

    const rawName = String(item.name ?? item.label ?? item.code ?? "").trim();
    const name = rawName.toUpperCase();

    if (MUJER_NAMES.has(rawName) || MUJER_NAMES.has(name)) {
        return "mujer";
    }
    if (
        HOMBRE_LETTER_NAMES.has(name) ||
        HOMBRE_PANTALON_NAMES.has(rawName) ||
        HOMBRE_PANTALON_NAMES.has(name)
    ) {
        return "hombre";
    }

    // Heurística: 6–20 mujer; 26+ pantalón hombre
    if (/^\d+$/.test(rawName)) {
        const n = Number(rawName);
        if (n >= 26) return "hombre";
        return "mujer";
    }

    return "hombre";
}

function tallaSortKey(size: CatalogOption): number {
    const name = String(size.name ?? size.label ?? size.code ?? "").trim();
    const upper = name.toUpperCase();

    if (HOMBRE_ORDER[upper] != null) return HOMBRE_ORDER[upper];
    if (HOMBRE_ORDER[name] != null) return HOMBRE_ORDER[name];
    if (SOBRE_MEDIDA_ALIASES.has(upper)) return 99;

    const asNumber = Number(name);
    if (!Number.isNaN(asNumber)) {
        // Pantalón hombre: después de letras; mujer: su número
        if (asNumber >= 26) return 20 + Math.floor((asNumber - 26) / 2);
        return asNumber;
    }

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
            orden: item.orden != null ? Number(item.orden) : undefined,
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
        .sort((a, b) => {
            const ordenA = a.orden ?? tallaSortKey(a);
            const ordenB = b.orden ?? tallaSortKey(b);
            if (ordenA !== ordenB) return ordenA - ordenB;
            return String(a.name ?? "").localeCompare(String(b.name ?? ""), "es");
        });
}

export type TallaVisualGroup = "prenda" | "pantalon" | "sobre_medida";

export function resolveTallaVisualGroup(size: {
    name?: string | null;
    label?: string | null;
    code?: string | null;
}): TallaVisualGroup {
    const rawName = String(size.name ?? size.label ?? size.code ?? "").trim();
    const upper = rawName.toUpperCase();

    if (SOBRE_MEDIDA_ALIASES.has(upper)) return "sobre_medida";
    if (HOMBRE_PANTALON_NAMES.has(rawName) || HOMBRE_PANTALON_NAMES.has(upper)) {
        return "pantalon";
    }
    if (/^\d+$/.test(rawName) && Number(rawName) >= 26) return "pantalon";
    return "prenda";
}

export function groupTallasForDisplay(
    sizes: CatalogOption[],
    genero: TallaGenero
): Array<{
    key: TallaVisualGroup;
    title: string | null;
    sizes: CatalogOption[];
}> {
    const buckets: Record<TallaVisualGroup, CatalogOption[]> = {
        prenda: [],
        pantalon: [],
        sobre_medida: [],
    };

    for (const size of sizes) {
        buckets[resolveTallaVisualGroup(size)].push(size);
    }

    const sections: Array<{ key: TallaVisualGroup; title: string | null; sizes: CatalogOption[] }> =
        [];

    if (buckets.prenda.length) {
        sections.push({
            key: "prenda",
            title:
                genero === "hombre" && buckets.pantalon.length > 0
                    ? "Tallas prenda"
                    : null,
            sizes: [...buckets.prenda],
        });
    }
    if (buckets.pantalon.length) {
        sections.push({
            key: "pantalon",
            title: "Medidas pantalón hombre",
            sizes: [...buckets.pantalon],
        });
    }
    // Misma grilla que la última sección (queda en la última fila, no sola).
    if (buckets.sobre_medida.length) {
        if (sections.length > 0) {
            sections[sections.length - 1].sizes.push(...buckets.sobre_medida);
        } else {
            sections.push({
                key: "sobre_medida",
                title: null,
                sizes: [...buckets.sobre_medida],
            });
        }
    }

    return sections;
}
