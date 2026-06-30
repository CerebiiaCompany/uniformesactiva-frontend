import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export interface LineProduct {
    id: string;
    code: string;
    name: string;
    line_id: string;
}

export function useGetLineProducts(lineId?: string) {
    const fetchLineProducts = async () => {
        if (!lineId) return [];
        return await http<LineProduct[]>(endpoints.lineas.productos(lineId));
    };

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["line-products", lineId],
        queryFn: fetchLineProducts,
        enabled: !!lineId,
    });

    return {
        products: data ?? [],
        isLoading,
        error,
        refetch,
    };
}
