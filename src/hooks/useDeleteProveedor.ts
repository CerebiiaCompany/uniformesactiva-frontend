import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export function useDeleteProveedor() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const deleteProveedor = async (id: string) => {
        setIsLoading(true);
        setError(null);

        try {
            await http(endpoints.costos.proveedorDetalle(id), {
                method: "DELETE",
            });
            queryClient.invalidateQueries({ queryKey: ["cost-catalog", "proveedores"] });
            return { success: true as const };
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Error al eliminar el proveedor.";
            setError(message);
            return { success: false as const, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return { deleteProveedor, isLoading, error };
}
