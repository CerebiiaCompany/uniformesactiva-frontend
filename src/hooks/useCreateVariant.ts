import { useState } from "react";
import { http } from "@/lib/http";

interface CreateVariantPayload {
    name: string;
    attributes: {
        talla?: string;
        color?: string;
        material?: string;
    };
    estimated_cost: number;
}

export function useCreateVariant() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    const createVariant = async (productId: string, payload: CreateVariantPayload) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await http(`${API_BASE_URL}/api/v1/products/productos/${productId}/variantes/`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            return { success: true, data };
        } catch (err: any) {
            setError(err.message || "Error al crear la variante.");
            return { success: false, error: err.message };
        } finally {
            setIsLoading(false);
        }
    };

    return { createVariant, isLoading, error };
}