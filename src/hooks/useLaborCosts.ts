import { useState } from "react";
import { http } from "@/lib/http";
import { useQueryClient } from "@tanstack/react-query";
import { CreateLaborPayload } from "@/types/variant";

// Interfaz para actualizar mano de obra
export interface UpdateLaborPayload extends Partial<CreateLaborPayload> {
    id: string;
}

export function useLaborCosts() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const API_URL = import.meta.env.VITE_API_BASE_URL;

    // Crear fase de mano de obra
    const addLabor = async (payload: CreateLaborPayload) => {
        setLoading(true);
        setError(null);
        try {
            await http(`${API_URL}/api/v1/costos/labor/`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            queryClient.invalidateQueries({ queryKey: ["labor-costs", payload.variant_id] });
            return true;
        } catch (err: any) {
            setError(err.message || "Error al agregar la fase de mano de obra");
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Actualizar fase de mano de obra
    const updateLabor = async (id: string, payload: UpdateLaborPayload, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(`${API_URL}/api/v1/costos/labor/${id}/`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
            queryClient.invalidateQueries({ queryKey: ["labor-costs", variantId] });
            return true;
        } catch (err: any) {
            setError(err.message || "Error al actualizar la fase de mano de obra");
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Eliminar fase de mano de obra
    const deleteLabor = async (id: string, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(`${API_URL}/api/v1/costos/labor/${id}/`, {
                method: "DELETE",
            });
            queryClient.invalidateQueries({ queryKey: ["labor-costs", variantId] });
            return true;
        } catch (err: any) {
            setError(err.message || "Error al eliminar la fase de mano de obra");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        addLabor,
        updateLabor,
        deleteLabor,
    };
}