import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";

interface ProductFilters {
    name: string;
}

export function useGetProducts(lineId?: string) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState<ProductFilters>({ name: "" });

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    const fetchProducts = async () => {
        const params = new URLSearchParams();
        params.append("page", page.toString());
        params.append("page_size", pageSize.toString());

        if (filters.name) {
            params.append("name", filters.name);
        }

        if (lineId) {
            params.append("line_id", lineId);
        }
        const url = `${API_BASE_URL}/api/v1/products/productos/?${params.toString()}`;

        return await http<{ items: any[], total_count: number }>(url);
    };

    const { data, isLoading, refetch, error } = useQuery({
        queryKey: ["products", page, pageSize, filters, lineId],
        queryFn: fetchProducts,
        enabled: !!lineId,
    });

    const products = data?.items || [];
    const totalCount = data?.total_count || 0;

    const hasNext = page * pageSize < totalCount;
    const hasPrevious = page > 1;

    const updateFilters = useCallback((newFilters: Partial<ProductFilters>) => {
        setFilters((prev) => ({ ...prev, ...newFilters }));
        setPage(1);
    }, []);

    return {
        products,
        isLoading,
        error,
        refetch,
        pagination: {
            page,
            pageSize,
            totalCount,
            hasNext,
            hasPrevious,
            nextPage: () => setPage((prev) => prev + 1),
            prevPage: () => setPage((prev) => Math.max(1, prev - 1)),
            setPageSize: (size: number) => {
                setPageSize(size);
                setPage(1);
            }
        },
        filters: {
            current: filters,
            update: updateFilters,
        },
    };
}