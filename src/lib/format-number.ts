/** Convierte string numérico de la API (punto decimal) a número. */
export function parseApiNumber(value: string | number): number {
    if (typeof value === "number") return Number.isNaN(value) ? 0 : value;
    const trimmed = String(value).trim().replace(/\s/g, "");
    if (!trimmed) return 0;
    const num = parseFloat(trimmed.replace(/,/g, ""));
    return Number.isNaN(num) ? 0 : num;
}

const isWholeNumber = (num: number) =>
    Number.isInteger(num) || Math.abs(num - Math.round(num)) < 1e-9;

/** Cantidades (unidades, piezas): sin decimales si es entero. */
export function formatQuantity(value: string | number): string {
    const num = parseApiNumber(value);
    if (isWholeNumber(num)) {
        return Math.round(num).toLocaleString("es-CO", { maximumFractionDigits: 0 });
    }
    return num.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

/** Montos en pesos: miles con punto; hasta 2 decimales si aplica. */
export function formatCurrency(value: string | number): string {
    const num = parseApiNumber(value);
    if (isWholeNumber(num)) {
        return Math.round(num).toLocaleString("es-CO", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });
    }
    return num.toLocaleString("es-CO", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

/**
 * Costo unitario de inventario: conserva decimales exactos (hasta 2),
 * sin forzar redondeo a pesos enteros (p. ej. 0,3).
 */
export function formatUnitCost(value: string | number): string {
    const num = parseApiNumber(value);
    if (Number.isNaN(num)) return "0";
    return num.toLocaleString("es-CO", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

/** Medidas decimales (metros, consumo): coma decimal, sin ceros de más. */
export function formatDecimal(value: string | number, maxFractionDigits = 3): string {
    const num = parseApiNumber(value);
    return num.toLocaleString("es-CO", {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxFractionDigits,
    });
}

/** Valor limpio para inputs de edición (sin .000 ni .00). */
export function formatForInput(value: string | number): string {
    const num = parseApiNumber(value);
    if (isWholeNumber(num)) return String(Math.round(num));
    return String(num).replace(".", ",");
}
