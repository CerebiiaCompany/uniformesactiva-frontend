import { useState, useEffect, useCallback } from "react";

export interface Client {
    id: string;
    nit: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    status: string;
}

export interface ClientFilters {
    name?: string;
    nit?: string;
    email?: string;
    phone?: string;
}

export function useGetClients(initialPage = 1, initialPageSize = 10) {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [page, setPage] = useState(initialPage);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [totalCount, setTotalCount] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrevious, setHasPrevious] = useState(false);
    const [filters, setFilters] = useState<ClientFilters>({});

    const fetchClients = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
        const token = localStorage.getItem("token");

        const queryParams = new URLSearchParams({
            page: page.toString(),
            page_size: pageSize.toString(),
        });

        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                queryParams.append(key, value);
            }
        });

        try {
            const response = await fetch(`${baseUrl}/api/v1/clients/?${queryParams.toString()}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token ? `Bearer ${token}` : "",
                },
            });

            if (!response.ok) {
                throw new Error("No se pudo obtener la lista de clientes.");
            }

            const data = await response.json();

            setClients(data.results || []);
            setTotalCount(data.count || 0);
            setHasNext(!!data.next);
            setHasPrevious(!!data.previous);
        } catch (err: any) {
            setError(err.message || "Error al conectar con el servidor.");
        } finally {
            setIsLoading(false);
        }
    }, [page, pageSize, filters]);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const nextPage = () => { if (hasNext) setPage((prev) => prev + 1); };
    const prevPage = () => { if (hasPrevious) setPage((prev) => prev - 1); };
    const updateFilters = (newFilters: ClientFilters) => {
        setFilters(newFilters);
        setPage(1);
    };

    return {
        clients,
        isLoading,
        error,
        refetch: fetchClients,
        pagination: {
            page,
            pageSize,
            totalCount,
            hasNext,
            hasPrevious,
            nextPage,
            prevPage,
            setPage,
            setPageSize,
        },
        filters: {
            current: filters,
            update: updateFilters,
        }
    };
}