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

export function useGetClients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchClients = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${baseUrl}/api/v1/clients/`, {
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
            setClients(data);
        } catch (err: any) {
            setError(err.message || "Error al conectar con el servidor.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    return { clients, isLoading, error, refetch: fetchClients };
}