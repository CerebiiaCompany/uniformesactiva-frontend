import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { VariantCostSummary } from "@/types/variant";

const normalizeSummary = (raw: any): VariantCostSummary => ({
    variant_id: raw.variant_id,
    average_consumption: raw.average_consumption,
    fabric_price_per_meter: raw.fabric_price_per_meter,
    fabric_total: raw.fabric_total ?? raw.tela ?? 0,
    supplies_total: raw.supplies_total ?? raw.insumos ?? 0,
    labor_total: raw.labor_total ?? raw.mano_de_obra ?? 0,
    overall_total: raw.overall_total ?? raw.total ?? 0,
});

export function useGetCostSummary(variantId?: string) {
    return useQuery({
        queryKey: ["cost-summary", variantId],
        queryFn: async () => {
            const data = await http<any>(endpoints.costos.resumenByVariant(variantId!));
            return normalizeSummary(data);
        },
        enabled: !!variantId,
    });
}
