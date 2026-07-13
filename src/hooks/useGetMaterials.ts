import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export interface Material {
    id: string;
    name: string;
    category: string;
    supplier: string;
    unit: string;
    stock: number;
    min_stock: number;
    unit_cost: number;
    status: string;
    is_low_stock: boolean;
}

interface UseGetMaterialsProps {
    search?: string;
    category?: string;
    stockStatus?: string;
}

export function useGetMaterials({ search, category, stockStatus }: UseGetMaterialsProps = {}) {
    const fetchMaterials = async () => {
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (category) params.append("category", category);
        if (stockStatus && stockStatus !== "all") params.append("stock_status", stockStatus);

        return http<Material[]>(endpoints.inventory.list(params.toString()));
    };

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["materials", search, category, stockStatus],
        queryFn: fetchMaterials,
    });

    return {
        materials: data || [],
        isLoading,
        error,
        refetch,
    };
}