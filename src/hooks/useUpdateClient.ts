import { useState } from "react";
import { http } from "@/lib/http";

export interface UpdateClientData {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    tipo_cliente?: string;
}

export function useUpdateClient() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateClient = async (id: string, data: UpdateClientData) => {
        setIsLoading(true);
        setError(null);

        const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

        try {
            const result = await http(`${baseUrl}/api/v1/clients/${id}/`, {
                method: "PATCH",
                body: JSON.stringify(data),
            });

            setIsLoading(false);
            return { success: true, data: result };
        } catch (err: any) {
            setIsLoading(false);
            let errorMessage = err.message || "Ocurrió un error inesperado al actualizar el cliente.";

            if (err.data && typeof err.data === "object") {
                errorMessage = Object.entries(err.data)
                    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
                    .join(" | ");
            }

            setError(errorMessage);
            return { success: false, error: errorMessage };
        }
    };

    return { updateClient, isLoading, error };
}