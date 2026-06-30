import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export const useDeleteLine = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const deleteLine = async (id: string) => {
        setIsLoading(true);
        setError(null);

        try {
            await http<{ detail: string }>(endpoints.lineas.detail(id), {
                method: "DELETE",
            });

            queryClient.invalidateQueries({ queryKey: ["product-lines"] });
            return { success: true };
        } catch (err: any) {
            const message = err.message || "Error al eliminar la línea de producto.";
            setError(message);
            return { success: false, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return { deleteLine, isLoading, error };
};
