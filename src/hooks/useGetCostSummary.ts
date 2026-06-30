import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { VariantCostSummary } from "@/types/variant";

export function useGetCostSummary(variantId?: string) {
    return useQuery({
        queryKey: ["cost-summary", variantId],
        queryFn: () => http<VariantCostSummary>(endpoints.costos.resumenByVariant(variantId!)),
        enabled: !!variantId,
    });
}
