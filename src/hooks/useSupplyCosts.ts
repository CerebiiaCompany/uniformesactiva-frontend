import { useState } from "react";
import { http } from "@/lib/http";
import { useQueryClient } from "@tanstack/react-query";
import { CreateSupplyPayload } from "@/types/variant";

export interface UpdateSupplyPayload extends Partial<CreateSupplyPayload> {
    id?: string;
}

export function useSupplyCosts() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const API_URL = import.meta.env.VITE_API_BASE_URL;

    // Crear insumo
    const addSupply = async (payload: CreateSupplyPayload) => {
        setLoading(true);
        setError(null);
        try {
            await http(`${API_URL}/api/v1/costos/supply/`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            queryClient.invalidateQueries({ queryKey: ["supply-costs", payload.variant_id] });
            return true;
        } catch (err: any) {
            setError(err.message || "Error al agregar el insumo");
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Actualizar insumo
    const updateSupply = async (id: string, payload: UpdateSupplyPayload, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(`${API_URL}/api/v1/costos/supply/${id}/`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
            queryClient.invalidateQueries({ queryKey: ["supply-costs", variantId] });
            return true;
        } catch (err: any) {
            setError(err.message || "Error al actualizar el insumo");
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Eliminar insumo
    const deleteSupply = async (id: string, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(`${API_URL}/api/v1/costos/supply/${id}/`, {
                method: "DELETE",
            });
            queryClient.invalidateQueries({ queryKey: ["supply-costs", variantId] });
            return true;
        } catch (err: any) {
            setError(err.message || "Error al eliminar el insumo");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        addSupply,
        updateSupply,
        deleteSupply,
    };
}