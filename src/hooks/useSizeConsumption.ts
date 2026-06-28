import { useState } from "react";
import { http } from "@/lib/http";
import { useQueryClient } from "@tanstack/react-query";
import { CreateSizeConsumptionPayload } from "@/types/variant";

// Interfaz para actualizar el consumo de talla
export interface UpdateSizeConsumptionPayload extends Partial<CreateSizeConsumptionPayload> {
    id: string;
}

export function useSizeConsumption() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const API_URL = import.meta.env.VITE_API_BASE_URL;

    // Crear consumo por talla
    const addSizeConsumption = async (payload: CreateSizeConsumptionPayload) => {
        setLoading(true);
        setError(null);
        try {
            await http(`${API_URL}/api/v1/costos/size-consumption/`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            queryClient.invalidateQueries({ queryKey: ["size-consumption", payload.variant_id] });
            return true;
        } catch (err: any) {
            setError(err.message || "Error al asignar el consumo de talla");
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Actualizar consumo por talla
    const updateSizeConsumption = async (id: string, payload: UpdateSizeConsumptionPayload, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(`${API_URL}/api/v1/costos/size-consumption/${id}/`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
            queryClient.invalidateQueries({ queryKey: ["size-consumption", variantId] });
            return true;
        } catch (err: any) {
            setError(err.message || "Error al actualizar el consumo de talla");
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Eliminar consumo por talla
    const deleteSizeConsumption = async (id: string, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(`${API_URL}/api/v1/costos/size-consumption/${id}/`, {
                method: "DELETE",
            });
            queryClient.invalidateQueries({ queryKey: ["size-consumption", variantId] });
            return true;
        } catch (err: any) {
            setError(err.message || "Error al eliminar el consumo de talla");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        addSizeConsumption,
        updateSizeConsumption,
        deleteSizeConsumption,
    };
}