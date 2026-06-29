import { useState } from "react";
import { http } from "@/lib/http";

interface VariantPayload {
    name: string;
    attributes: {
        talla?: string;
        color?: string;
        material?: string;
        estampado?: string;
    };
    estimated_cost: number | string;
}

interface ProductPayload {
    line_id: string;
    name: string;
    description: string;
    variants: VariantPayload[];
}

export function useCreateProduct() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    const createProduct = async (productData: ProductPayload) => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await http(`${API_BASE_URL}/api/v1/products/productos/`, {
                method: 'POST',
                body: JSON.stringify(productData),
            });

            return { success: true, data };
        } catch (err: any) {
            setError(err.message || "Ocurrió un error inesperado al conectar con el servidor.");
            return { success: false, error: err.message };
        } finally {
            setIsLoading(false);
        }
    };

    return {
        createProduct,
        isLoading,
        error,
    };
}