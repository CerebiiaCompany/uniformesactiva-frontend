import { useState } from "react";
import { http } from "@/lib/http";

export interface UpdateLinePayload {
    name?: string;
    code?: string;
}

export interface ProductLine {
    id: string;
    code: string;
    name: string;
    products_count?: number;
}

export const useUpdateLine = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateLine = async (id: string, data: UpdateLinePayload) => {
        setIsLoading(true);
        setError(null);

        const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

        try {
            const updated = await http<ProductLine>(`${baseUrl}/api/v1/products/lineas/${id}/`, {
                method: "PATCH",
                body: JSON.stringify(data),
            });

            return { success: true, data: updated };
        } catch (err: any) {
            const message = err.message || "Error al actualizar la línea de producto.";
            setError(message);
            return { success: false, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return { updateLine, isLoading, error };
};
