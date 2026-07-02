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
import type { CreateSupplyPayload, UpdateSupplyPayload } from "@/types/variant";

function buildSupplyBody(payload: CreateSupplyPayload | UpdateSupplyPayload, isCreate: boolean) {
    const body: Record<string, unknown> = {};
    if (isCreate && "variant_id" in payload && payload.variant_id) {
        body.variant_id = payload.variant_id;
    }
    if (payload.tipo_id != null) body.tipo_id = payload.tipo_id;
    if (payload.quantity != null) body.quantity = String(payload.quantity);
    if (payload.unit_price != null) body.unit_price = String(payload.unit_price);
    if (payload.talla_id !== undefined) {
        body.talla_id = payload.talla_id || null;
    } else if (isCreate) {
        body.talla_id = null;
    }
    return body;
}

export function useSupplyCosts() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const afterMutation = (variantId: string, response: CostMutationResponse) => {
        handleCostMutationResponse(queryClient, variantId, response);
        invalidateVariantCostLists(queryClient, variantId);
        queryClient.invalidateQueries({ queryKey: ["cost-summary", variantId] });
    };

    const addSupply = async (payload: CreateSupplyPayload) => {
        setLoading(true);
        setError(null);
        try {
            const body = buildSupplyBody(payload, true);

            const response = await http<CostMutationResponse>(endpoints.costos.insumos(), {
                method: "POST",
                body: JSON.stringify(body),
            });
            afterMutation(payload.variant_id, response);
            return true;
        } catch (err: any) {
            setError(err.message || "Error al agregar el insumo");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const updateSupply = async (id: string, payload: UpdateSupplyPayload, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            const body = buildSupplyBody(payload, false);

            if (Object.keys(body).length === 0) return true;

            const response = await http<CostMutationResponse>(endpoints.costos.insumosDetalle(id), {
                method: "PATCH",
                body: JSON.stringify(body),
            });
            afterMutation(variantId, response);
            return true;
        } catch (err: any) {
            setError(err.message || "Error al actualizar el insumo");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const deleteSupply = async (id: string, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(endpoints.costos.insumosDetalle(id), { method: "DELETE" });
            invalidateVariantCostAfterDelete(queryClient, variantId);
            return true;
        } catch (err: any) {
            setError(err.message || "Error al eliminar el insumo");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { loading, error, addSupply, updateSupply, deleteSupply };
}
