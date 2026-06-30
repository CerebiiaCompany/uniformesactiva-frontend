import { useState } from "react";
import { http } from "@/lib/http";

export const useDeleteLine = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const deleteLine = async (id: string) => {
        setIsLoading(true);
        setError(null);

        const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

        try {
            await http<{ detail: string }>(`${baseUrl}/api/v1/products/lineas/${id}/`, {
                method: "DELETE",
            });

            return { success: true };
        } catch (err: any) {
            const message = err.message || "Error al eliminar la línea de producto.";
            setError(message);
            return { success: false, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return { deleteLine, isLoading, error };
};
