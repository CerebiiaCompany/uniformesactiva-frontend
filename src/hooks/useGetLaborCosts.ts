import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { LaborPhase } from "@/types/variant";

export const useGetLaborCosts = (variantId: string) => {
    return useQuery({
        queryKey: ["labor", variantId],
        queryFn: () => http<LaborPhase[]>(`/api/v1/costos/labor/${variantId}/`),
        enabled: !!variantId,
    });
};