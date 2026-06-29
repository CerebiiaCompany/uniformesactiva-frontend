import { useState } from "react";
import { http } from "@/lib/http";

export function useDeleteVariant() {
    const [isLoading, setIsLoading] = useState(false);
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    const deleteVariant = async (productId: string, variantId: string) => {
        setIsLoading(true);
        try {
            const data = await http(`${API_BASE_URL}/api/v1/products/productos/${productId}/eliminar_variante/`, {
                method: "DELETE",
                body: JSON.stringify({ variant_id: variantId }),
            });
            return { success: true, data };
        } catch (err: any) {
            return { success: false, error: err.message };
        } finally {
            setIsLoading(false);
        }
    };

    return { deleteVariant, isLoading };
}