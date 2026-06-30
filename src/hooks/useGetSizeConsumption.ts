import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { SizeFabric } from "@/types/variant";

export const useGetSizeConsumption = (variantId: string) => {
    return useQuery({
        queryKey: ["size-consumption", variantId],
        queryFn: () => http<SizeFabric[]>(`/api/v1/costos/size-consumption/${variantId}/`),
        enabled: !!variantId,
    });
};