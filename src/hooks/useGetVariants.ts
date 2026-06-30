import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { ProductVariant } from "@/types/variant";

export function useGetVariants(productId?: string) {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["product-variants", productId],
        queryFn: async () => {
            if (!productId) return [];
            return await http<ProductVariant[]>(endpoints.productos.variantes(productId));
        },
        enabled: !!productId,
    });

    return { variants: data ?? [], isLoading, error, refetch };
}
