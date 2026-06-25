import { useState } from "react";
import { http } from "@/lib/http";

interface LinePayload {
    name: string;
    code: string;
}

export const useCreateLine = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createLine = async (data: LinePayload) => {
        setIsLoading(true);
        setError(null);

        const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

        try {
            await http(`${baseUrl}/api/v1/products/lineas/`, {
                method: "POST",
                body: JSON.stringify(data),
            });

            return { success: true };
        } catch (err: any) {
            const message = err.message || "Error al crear la línea de producto.";
            setError(message);
            return { success: false, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return { createLine, isLoading, error };
};