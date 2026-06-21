import { useState, useEffect, useCallback } from "react";
import { http } from "@/lib/http";

export interface ClientDetail {
    id: string;
    nit: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    status: string;
    orders: any[]; // Historial de pedidos simulado
}

export function useGetClientDetail(clientId: string | null) {
    const [client, setClient] = useState<ClientDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

    const fetchClientDetail = useCallback(async () => {
        if (!clientId) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await http<ClientDetail>(`${baseUrl}/api/v1/clients/${clientId}/`);
            setClient(data);
        } catch (err: any) {
            setError(err.message || "Ocurrió un error inesperado al consultar el cliente.");
            setClient(null);
        } finally {
            setIsLoading(false);
        }
    }, [clientId, baseUrl]);

    useEffect(() => {
        if (clientId) {
            fetchClientDetail();
        } else {
            setClient(null);
        }
    }, [clientId, fetchClientDetail]);

    return {
        client,
        isLoading,
        error,
        refetch: fetchClientDetail,
    };
}