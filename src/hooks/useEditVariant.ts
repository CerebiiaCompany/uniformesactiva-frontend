import { useState } from "react";
import { http } from "@/lib/http";

export function useEditVariant() {
    const [isLoading, setIsLoading] = useState(false);
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    const editVariant = async (productId: string, variantId: string, payload: any) => {
        setIsLoading(true);
        try {
            const data = await http(`${API_BASE_URL}/api/v1/products/productos/${productId}/editar_variante/`, {
                method: "PATCH",
                body: JSON.stringify({ variant_id: variantId, ...payload }),
            });
            return { success: true, data };
        } catch (err: any) {
            return { success: false, error: err.message };
        } finally {
            setIsLoading(false);
        }
    };

    return { editVariant, isLoading };
}