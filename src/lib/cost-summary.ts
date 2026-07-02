import type { VariantCostSummary } from "@/types/variant";

export function normalizeVariantCostSummary(raw: Record<string, unknown>): VariantCostSummary {
    const sizes = Array.isArray(raw.sizes)
        ? raw.sizes.map((size: Record<string, unknown>) => ({
              talla_id: String(size.talla_id ?? ""),
              talla_nombre: String(size.talla_nombre ?? ""),
              consumption: size.consumption ?? 0,
              fabric_total: size.fabric_total ?? 0,
              supplies_total: size.supplies_total ?? 0,
              labor_total: size.labor_total ?? 0,
              overall_total: size.overall_total ?? 0,
          }))
        : [];

    return {
        variant_id: raw.variant_id as string | undefined,
        average_consumption: raw.average_consumption as string | number | undefined,
        fabric_price_per_meter: raw.fabric_price_per_meter as string | number | undefined,
        fabric_total: (raw.fabric_total ?? raw.tela ?? 0) as string | number,
        supplies_total: (raw.supplies_total ?? raw.insumos ?? 0) as string | number,
        labor_total: (raw.labor_total ?? raw.mano_de_obra ?? 0) as string | number,
        overall_total: (raw.overall_total ?? raw.total ?? 0) as string | number,
        sizes,
    };
}
