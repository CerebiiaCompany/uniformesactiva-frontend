import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { SupplyRecord } from "@/types/variant";

export const useGetSupplyCosts = (variantId: string) => {
    return useQuery({
        queryKey: ["supplies", variantId],
        queryFn: () => http<SupplyRecord[]>(`/api/v1/costos/supply/${variantId}/`),
        enabled: !!variantId,
    });
};