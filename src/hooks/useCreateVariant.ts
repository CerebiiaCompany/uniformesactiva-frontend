import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { CreateVariantPayload } from "@/types/variant";

export function useCreateVariant() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const createVariant = async (productId: string, payload: CreateVariantPayload) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await http(endpoints.productos.variantes(productId), {
                method: "POST",
                body: JSON.stringify({
                    name: payload.name.trim(),
                    code: payload.code.trim().toUpperCase(),
                }),
            });
            queryClient.invalidateQueries({ queryKey: ["product-variants", productId] });
            queryClient.invalidateQueries({ queryKey: ["product-detail", productId] });
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
