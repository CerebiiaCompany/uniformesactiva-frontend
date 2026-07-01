/** Normaliza entrada decimal (2,5 / 2.500 / 1.234,56) a string con punto decimal para la API. */
export function normalizeDecimalInput(value: string): string {
    const trimmed = value.trim().replace(/\s/g, "");
    if (!trimmed) return "";

    if (trimmed.includes(",") && trimmed.includes(".")) {
        return trimmed.replace(/\./g, "").replace(",", ".");
    }

    if (trimmed.includes(",")) {
        return trimmed.replace(",", ".");
    }

    return trimmed;
}

export function parseDecimalInput(value: string): number {
    const normalized = normalizeDecimalInput(value);
    const num = parseFloat(normalized);
    return Number.isNaN(num) ? 0 : num;
}
