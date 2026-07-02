import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { normalizeVariantCostSummary } from "@/lib/cost-summary";
import type { VariantCostSummary } from "@/types/variant";

export function useGetCostSummary(variantId?: string) {
    return useQuery({
        queryKey: ["cost-summary", variantId],
        queryFn: async () => {
            const data = await http<Record<string, unknown>>(
                endpoints.costos.resumenByVariant(variantId!)
            );
            return normalizeVariantCostSummary(data);
        },
        enabled: !!variantId,
    });
}

export async function fetchVariantCostSummary(variantId: string): Promise<VariantCostSummary> {
    const data = await http<Record<string, unknown>>(endpoints.costos.resumenByVariant(variantId));
    return normalizeVariantCostSummary(data);
}
