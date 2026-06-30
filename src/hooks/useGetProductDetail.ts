import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";

export function useGetProductDetail(productId?: string) {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    const fetchProduct = async () => {
        if (!productId) return null;
        const url = `${API_BASE_URL}/api/v1/products/productos/${productId}/`;
        return await http<any>(url);
    };

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["product-detail", productId],
        queryFn: fetchProduct,
        enabled: !!productId,
    });

    return {
        product: data,
        isLoading,
        error,
        refetch
    };
}