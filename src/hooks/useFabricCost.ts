import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import {
    handleCostMutationResponse,
    invalidateVariantCostAfterDelete,
    invalidateVariantCostLists,
    type CostMutationResponse,
} from "@/lib/variant-cost-cache";
import type { CreateFabricPayload, UpdateFabricPayload } from "@/types/variant";

export function useFabricCosts() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const afterMutation = (variantId: string, response: CostMutationResponse) => {
        handleCostMutationResponse(queryClient, variantId, response);
        invalidateVariantCostLists(queryClient, variantId);
        queryClient.invalidateQueries({ queryKey: ["cost-summary", variantId] });
    };

    const addFabric = async (payload: CreateFabricPayload) => {
        setLoading(true);
        setError(null);
        try {
            const body: Record<string, string | boolean> = {
                variant_id: payload.variant_id,
                reference: payload.reference,
                meters: String(payload.meters),
                price_per_meter: String(payload.price_per_meter),
            };
            if (payload.proveedor_id) body.proveedor_id = payload.proveedor_id;
            if (payload.tiene_iva != null) body.tiene_iva = payload.tiene_iva;
            if (payload.es_principal != null) body.es_principal = payload.es_principal;

            const response = await http<CostMutationResponse>(endpoints.costos.tela(), {
                method: "POST",
                body: JSON.stringify(body),
            });
            afterMutation(payload.variant_id, response);
            return true;
        } catch (err: any) {
            setError(err.message || "Error al agregar el costo de tela");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const updateFabric = async (id: string, payload: UpdateFabricPayload, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            const body: Record<string, string | boolean> = {};
            if (payload.proveedor_id != null) body.proveedor_id = payload.proveedor_id;
            if (payload.reference != null) body.reference = payload.reference;
            if (payload.meters != null) body.meters = String(payload.meters);
            if (payload.price_per_meter != null) body.price_per_meter = String(payload.price_per_meter);
            if (payload.tiene_iva != null) body.tiene_iva = payload.tiene_iva;
            if (payload.es_principal != null) body.es_principal = payload.es_principal;

            if (Object.keys(body).length === 0) return true;

            const response = await http<CostMutationResponse>(endpoints.costos.telaDetalle(id), {
                method: "PATCH",
                body: JSON.stringify(body),
            });
            afterMutation(variantId, response);
            return true;
        } catch (err: any) {
            setError(err.message || "Error al actualizar el costo de tela");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const deleteFabric = async (id: string, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(endpoints.costos.telaDetalle(id), { method: "DELETE" });
            invalidateVariantCostAfterDelete(queryClient, variantId);
            return true;
        } catch (err: any) {
            setError(err.message || "Error al eliminar el costo de tela");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const setFabricPrincipal = async (id: string, variantId: string) => {
        return updateFabric(id, { es_principal: true }, variantId);
    };

    return { loading, error, addFabric, updateFabric, deleteFabric, setFabricPrincipal };
}
