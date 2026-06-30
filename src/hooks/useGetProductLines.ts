import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export interface ProductLine {
    id: string;
    code: string;
    name: string;
    products_count?: number;
}

export function useGetProductLines() {
    const fetchLines = async () => http<ProductLine[]>(endpoints.lineas.list());

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["product-lines"],
        queryFn: fetchLines,
    });

    return {
        lines: data || [],
        isLoading,
        error,
        refetch,
    };
}
