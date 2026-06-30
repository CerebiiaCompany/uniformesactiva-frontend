import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { FabricRecord } from "@/types/variant";

export const useGetFabricCosts = (variantId: string) => {
    return useQuery({
        queryKey: ["fabrics", variantId],
        queryFn: () => http<FabricRecord[]>(`/api/v1/costos/fabric/${variantId}/`),
        enabled: !!variantId,
    });
};