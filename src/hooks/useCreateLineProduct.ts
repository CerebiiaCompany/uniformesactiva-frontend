import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { LineProduct } from "@/hooks/useGetLineProducts";

export interface CreateLineProductPayload {
    name: string;
    code: string;
}

export function useCreateLineProduct() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const createLineProduct = async (lineId: string, data: CreateLineProductPayload) => {
        setIsLoading(true);
        setError(null);

        try {
            const product = await http<LineProduct>(endpoints.lineas.productos(lineId), {
                method: "POST",
                body: JSON.stringify({
                    name: data.name.trim(),
                    code: data.code.trim().toUpperCase(),
                }),
            });

            queryClient.invalidateQueries({ queryKey: ["line-products", lineId] });
            queryClient.invalidateQueries({ queryKey: ["product-lines"] });
            return { success: true, data: product };
        } catch (err: any) {
            const message = err.message || "Error al crear el producto.";
            setError(message);
            return { success: false, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return { createLineProduct, isLoading, error };
}
