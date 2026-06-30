import { useState } from "react";
import { http } from "@/lib/http";
import { useQueryClient } from "@tanstack/react-query";
import { CreateFabricPayload } from "@/types/variant";

// Si tienes una interfaz para actualizar, puedes añadirla aquí o usar la misma
export interface UpdateFabricPayload extends Partial<CreateFabricPayload> {
    id: string;
}

export function useFabricCosts() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const API_URL = import.meta.env.VITE_API_BASE_URL;

    // Crear
    const addFabric = async (payload: CreateFabricPayload) => {
        setLoading(true);
        setError(null);
        try {
            await http(`${API_URL}/api/v1/costos/fabric/`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            queryClient.invalidateQueries({ queryKey: ["fabric-costs", payload.variant_id] });
            return true;
        } catch (err: any) {
            setError(err.message || "Error al agregar el costo de tela");
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Actualizar
    const updateFabric = async (id: string, payload: UpdateFabricPayload, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(`${API_URL}/api/v1/costos/fabric/${id}/`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
            queryClient.invalidateQueries({ queryKey: ["fabric-costs", variantId] });
            return true;
        } catch (err: any) {
            setError(err.message || "Error al actualizar el costo de tela");
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Eliminar
    const deleteFabric = async (id: string, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(`${API_URL}/api/v1/costos/fabric/${id}/`, {
                method: "DELETE",
            });
            queryClient.invalidateQueries({ queryKey: ["fabric-costs", variantId] });
            return true;
        } catch (err: any) {
            setError(err.message || "Error al eliminar el costo de tela");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        addFabric,
        updateFabric,
        deleteFabric,
    };
}