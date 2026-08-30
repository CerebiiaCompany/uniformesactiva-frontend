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

/** Sanitiza la escritura de números decimales permitiendo un solo separador (. o ,) */
export function sanitizeDecimalTyping(value: string): string {
    let cleaned = value.replace(/[^\d.,]/g, "");
    const sepIndex = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
    if (sepIndex >= 0) {
        const intPart = cleaned.slice(0, sepIndex).replace(/[.,]/g, "");
        const decPart = cleaned.slice(sepIndex + 1).replace(/[.,]/g, "");
        const sep = cleaned[sepIndex];
        cleaned = decPart.length > 0 || cleaned.endsWith(",") || cleaned.endsWith(".")
            ? `${intPart}${sep}${decPart}`
            : intPart + sep;
    }
    return cleaned;
}

