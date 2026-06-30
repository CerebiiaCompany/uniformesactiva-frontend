import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export function useGetProductDetail(productId?: string) {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["product-detail", productId],
        queryFn: async () => {
            if (!productId) return null;
            return await http<any>(endpoints.productos.detail(productId));
        },
        enabled: !!productId,
    });

    return { product: data, isLoading, error, refetch };
}
