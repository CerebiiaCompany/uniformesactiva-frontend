import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

interface ProductFilters {
    name: string;
}

export function useGetProducts() {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState<ProductFilters>({ name: "" });

    // Capturamos la URL base desde el archivo .env
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    const fetchProducts = async () => {
        const params = new URLSearchParams();
        params.append("page", page.toString());
        params.append("page_size", pageSize.toString());

        if (filters.name) {
            params.append("name", filters.name);
        }

        const token = localStorage.getItem("token");

        const url = `${API_BASE_URL}/api/v1/products/?${params.toString()}`;

        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": token ? `Bearer ${token}` : "",
            }
        });

        if (!response.ok) {
            throw new Error("Error al consultar el catálogo de productos");
        }

        return response.json();
    };

    const { data, isLoading, refetch, error } = useQuery({
        queryKey: ["products", page, pageSize, filters],
        queryFn: fetchProducts,
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