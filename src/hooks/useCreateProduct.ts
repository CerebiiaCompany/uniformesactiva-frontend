import { useState } from "react";

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

        const token = localStorage.getItem("token");

        const url = `${API_BASE_URL}/api/v1/products/`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify(productData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.detail || errorData?.message || "Error al registrar el producto y sus variantes");
            }

            const data = await response.json();
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