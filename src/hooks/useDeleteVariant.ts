import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export function useDeleteVariant() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const deleteVariant = async (productId: string, variantId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            await http<{ detail: string }>(endpoints.productos.eliminarVariante(productId, variantId), {
                method: "DELETE",
            });

            queryClient.invalidateQueries({ queryKey: ["product-variants", productId] });
            queryClient.invalidateQueries({ queryKey: ["product-detail", productId] });
            queryClient.removeQueries({ queryKey: ["fabric-costs", variantId] });
            queryClient.removeQueries({ queryKey: ["supply-costs", variantId] });
            queryClient.removeQueries({ queryKey: ["labor-costs", variantId] });
            queryClient.removeQueries({ queryKey: ["extra-costs", variantId] });
            queryClient.removeQueries({ queryKey: ["size-consumption", variantId] });
            queryClient.removeQueries({ queryKey: ["cost-summary", variantId] });

            return { success: true as const };
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Error al eliminar la variante.";
            setError(message);
            return { success: false as const, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return { deleteVariant, isLoading, error };
}
