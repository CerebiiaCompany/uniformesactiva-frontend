import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { LineProduct } from "@/hooks/useGetLineProducts";

export interface UpdateProductPayload {
    name?: string;
    code?: string;
}

export function useUpdateProduct() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const updateProduct = async (id: string, lineId: string, data: UpdateProductPayload) => {
        setIsLoading(true);
        setError(null);

        try {
            const updated = await http<LineProduct>(endpoints.productos.detail(id), {
                method: "PATCH",
                body: JSON.stringify(data),
            });

            queryClient.invalidateQueries({ queryKey: ["line-products", lineId] });
            queryClient.invalidateQueries({ queryKey: ["product-detail", id] });
            return { success: true, data: updated };
        } catch (err: any) {
            const message = err.message || "Error al actualizar el producto.";
            setError(message);
            return { success: false, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return { updateProduct, isLoading, error };
}
