import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export function useCreateProveedor() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const createProveedor = async (name: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await http<{ id: string; name: string }>(endpoints.costos.proveedores(), {
                method: "POST",
                body: JSON.stringify({ name: name.trim() }),
            });

            queryClient.invalidateQueries({ queryKey: ["cost-catalog", "proveedores"] });
            return { success: true, data };
        } catch (err: any) {
            const message = err.message || "Error al crear el proveedor.";
            setError(message);
            return { success: false, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return { createProveedor, isLoading, error };
}
