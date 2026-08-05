import type { VariantCostSummary } from "@/types/variant";
import { parseApiNumber } from "@/lib/format-number";

function pickAmount(
    record: Record<string, unknown>,
    ...keys: string[]
): string | number {
    for (const key of keys) {
        const value = record[key];
        if (value != null && value !== "") return value as string | number;
    }
    return 0;
}

export function normalizeVariantCostSummary(raw: Record<string, unknown>): VariantCostSummary {
    const sizes = Array.isArray(raw.sizes)
        ? raw.sizes.map((size: Record<string, unknown>) => ({
              talla_id: String(size.talla_id ?? ""),
              talla_nombre: String(size.talla_nombre ?? size.talla ?? ""),
              talla_genero: size.talla_genero != null ? String(size.talla_genero) : null,
              consumption: pickAmount(size, "consumption", "consumo"),
              fabric_total: pickAmount(size, "fabric_total", "tela", "costo_tela"),
              supplies_total: pickAmount(size, "supplies_total", "insumos", "costo_insumos"),
              labor_total: pickAmount(
                  size,
                  "labor_total",
                  "mano_de_obra",
                  "mano_obra",
                  "costo_mano_de_obra"
              ),
              extras_total: pickAmount(
                  size,
                  "extras_total",
                  "costos_extra",
                  "extras",
                  "costo_extra"
              ),
              overall_total: pickAmount(size, "overall_total", "total", "costo_total"),
              precio_venta: size.precio_venta ?? null,
              ganancia: size.ganancia ?? null,
          }))
        : [];

    return {
        variant_id: raw.variant_id as string | undefined,
        average_consumption: raw.average_consumption as string | number | undefined,
        fabric_price_per_meter: raw.fabric_price_per_meter as string | number | undefined,
        fabric_total: pickAmount(raw, "fabric_total", "tela"),
        supplies_total: pickAmount(raw, "supplies_total", "insumos"),
        labor_total: pickAmount(raw, "labor_total", "mano_de_obra", "mano_obra"),
        extras_total: pickAmount(raw, "extras_total", "costos_extra", "extras"),
        overall_total: pickAmount(raw, "overall_total", "total"),
        fabric_reference: String(raw.fabric_reference ?? "").trim() || undefined,
        fabric_color: String(raw.fabric_color ?? "").trim() || undefined,
        sizes,
    };
}

/** ¿Una línea de costo (insumo/MO/extra) aplica a la talla del artículo? Misma regla del backend. */
export function costLineAppliesToSize(
    lineTallaId: string | null | undefined,
    sizeTallaId: string | null | undefined,
    consumptionTallaIds: Set<string>
): boolean {
    if (!lineTallaId) return true;
    if (!consumptionTallaIds.has(lineTallaId)) return true;
    return Boolean(sizeTallaId) && lineTallaId === sizeTallaId;
}

export function sumApplicableCostLines(
    lines: Array<{ talla_id?: string | null; total?: string | number }>,
    sizeTallaId: string | null | undefined,
    consumptionTallaIds: Set<string>
): number {
    return lines.reduce((sum, line) => {
        if (!costLineAppliesToSize(line.talla_id, sizeTallaId, consumptionTallaIds)) {
            return sum;
        }
        return sum + parseApiNumber(line.total ?? 0);
    }, 0);
}
