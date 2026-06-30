import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";

interface ProductLine {
    id: string;
    code: string;
    name: string;
    products_count?: number;
}

export function useGetProductLines() {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    const fetchLines = async () => {
        const url = `${API_BASE_URL}/api/v1/products/lineas/`;
        return await http<ProductLine[]>(url);
    };

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["product-lines"],
        queryFn: fetchLines,
    });

    return {
        lines: data || [],
        isLoading,
        error,
        refetch
    };
}