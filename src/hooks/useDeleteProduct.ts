import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export function useDeleteProduct() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const deleteProduct = async (id: string, lineId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            await http<{ detail: string }>(endpoints.productos.detail(id), {
                method: "DELETE",
            });

            queryClient.invalidateQueries({ queryKey: ["line-products", lineId] });
            queryClient.invalidateQueries({ queryKey: ["product-lines"] });
            return { success: true };
        } catch (err: any) {
            const message = err.message || "Error al eliminar el producto.";
            setError(message);
            return { success: false, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return { deleteProduct, isLoading, error };
}
