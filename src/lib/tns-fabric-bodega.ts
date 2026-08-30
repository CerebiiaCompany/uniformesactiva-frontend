/** Bodegas TNS usadas en costeo de tela (materia prima vs producción). */

export type FabricBodegaKind = "materia_prima" | "produccion";

export type FabricBodegaFilter = FabricBodegaKind | "todas";

const normalizeBodegaText = (value?: string | null): string =>
    (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();

/** Clasifica una bodega TNS para costeo de telas. */
export function classifyFabricBodega(
    bodegaDesc?: string | null,
    bodegaCod?: string | null
): FabricBodegaKind | null {
    const raw = normalizeBodegaText(`${bodegaDesc || ""} ${bodegaCod || ""}`);
    if (!raw) return null;

    if (
        raw.includes("MATERIA PRI") ||
        raw.includes("MAT PRI") ||
        raw.includes("MATERIAS PRI") ||
        /\bMP\b/.test(raw)
    ) {
        return "materia_prima";
    }

    if (raw.includes("PRODUCC") || raw.includes("PRODUC")) {
        return "produccion";
    }

    return null;
}

export function isFabricCostBodega(
    bodegaDesc?: string | null,
    bodegaCod?: string | null
): boolean {
    return classifyFabricBodega(bodegaDesc, bodegaCod) !== null;
}

export function fabricBodegaShortLabel(kind: FabricBodegaKind): string {
    return kind === "materia_prima" ? "M.P." : "Prod.";
}

export function fabricBodegaLabel(kind: FabricBodegaKind): string {
    return kind === "materia_prima" ? "Materia prima" : "Producción";
}

export function cleanFabricBodegaDisplayName(rawName?: string | null): string {
    if (!rawName) return "Bodega";
    return rawName
        .replace(/^BODEGA\s+(DE\s+|PARA\s+)?/i, "")
        .replace(/^BOD\.?\s+/i, "")
        .trim();
}
