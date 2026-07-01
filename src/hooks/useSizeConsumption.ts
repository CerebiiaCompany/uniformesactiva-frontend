import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { CreateSizeConsumptionPayload, UpdateSizeConsumptionPayload } from "@/types/variant";

export interface SizeConsumptionResponse {
    id: string;
    variant_id: string;
    talla_id?: string;
    size_id?: string;
    consumption: number | string;
}

export function useSizeConsumption() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const invalidate = (variantId: string) => {
        queryClient.invalidateQueries({ queryKey: ["size-consumption", variantId] });
        queryClient.invalidateQueries({ queryKey: ["cost-summary", variantId] });
    };

    const addSizeConsumption = async (
        payload: CreateSizeConsumptionPayload
    ): Promise<SizeConsumptionResponse | null> => {
        setLoading(true);
        setError(null);
        try {
            const data = await http<SizeConsumptionResponse>(endpoints.costos.tallasConsumo(), {
                method: "POST",
                body: JSON.stringify({
                    variant_id: payload.variant_id,
                    talla_id: payload.talla_id,
                    consumption: String(payload.consumption),
                }),
            });
            invalidate(payload.variant_id);
            return data;
        } catch (err: any) {
            const message = err.message || "Error al asignar el consumo de talla";
            setError(message);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const updateSizeConsumption = async (
        id: string,
        payload: UpdateSizeConsumptionPayload,
        variantId: string
    ) => {
        setLoading(true);
        setError(null);
        try {
            const body: Record<string, string> = {};
            if (payload.talla_id != null) body.talla_id = payload.talla_id;
            if (payload.consumption != null) body.consumption = String(payload.consumption);

            if (Object.keys(body).length === 0) return true;

            await http(endpoints.costos.tallasConsumoDetalle(id), {
                method: "PATCH",
                body: JSON.stringify(body),
            });
            invalidate(variantId);
            return true;
        } catch (err: any) {
            const message = err.message || "Error al actualizar el consumo de talla";
            setError(message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const deleteSizeConsumption = async (id: string, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(endpoints.costos.tallasConsumoDetalle(id), { method: "DELETE" });
            invalidate(variantId);
            return true;
        } catch (err: any) {
            const message = err.message || "Error al eliminar el consumo de talla";
            setError(message);
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
