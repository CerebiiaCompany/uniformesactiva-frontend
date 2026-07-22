import { useState } from "react";
import { http } from "@/lib/http";

export function useDeleteClient() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const deleteClient = async (id: string) => {
        setIsLoading(true);
        setError(null);

        const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

        try {
            await http(`${baseUrl}/api/v1/clients/${id}/`, {
                method: "DELETE",
            });

            setIsLoading(false);
            return { success: true };
        } catch (err: any) {
            setIsLoading(false);
            let errorMessage = err.message || "Ocurrió un error inesperado al eliminar el cliente.";

            if (err.data && typeof err.data === "object") {
                errorMessage = Object.entries(err.data)
                    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
                    .join(" | ");
            }

            setError(errorMessage);
            return { success: false, error: errorMessage };
        }
    };

    return { deleteClient, isLoading, error };
}