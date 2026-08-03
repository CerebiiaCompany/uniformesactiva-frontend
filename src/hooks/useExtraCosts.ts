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
import type { CreateExtraCostPayload, UpdateExtraCostPayload } from "@/types/variant";

function buildExtraBody(payload: CreateExtraCostPayload | UpdateExtraCostPayload, isCreate: boolean) {
    const body: Record<string, unknown> = {};
    if (isCreate && "variant_id" in payload && payload.variant_id) {
        body.variant_id = payload.variant_id;
    }
    if (payload.concepto != null) body.concepto = String(payload.concepto).trim();
    if (payload.cantidad != null) body.cantidad = String(payload.cantidad);
    if (payload.unit_price != null) body.unit_price = String(payload.unit_price);
    if (payload.talla_id !== undefined) {
        body.talla_id = payload.talla_id || null;
    } else if (isCreate) {
        body.talla_id = null;
    }
    return body;
}

export function useExtraCosts() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const afterMutation = (variantId: string, response: CostMutationResponse) => {
        handleCostMutationResponse(queryClient, variantId, response);
        invalidateVariantCostLists(queryClient, variantId);
        queryClient.invalidateQueries({ queryKey: ["extra-costs", variantId] });
        queryClient.invalidateQueries({ queryKey: ["cost-summary", variantId] });
    };

    const addExtra = async (payload: CreateExtraCostPayload) => {
        setLoading(true);
        setError(null);
        try {
            const body = buildExtraBody(payload, true);
            const response = await http<CostMutationResponse>(endpoints.costos.extras(), {
                method: "POST",
                body: JSON.stringify(body),
            });
            afterMutation(payload.variant_id, response);
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error al agregar el costo extra";
            setError(message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const updateExtra = async (id: string, payload: UpdateExtraCostPayload, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            const body = buildExtraBody(payload, false);
            if (Object.keys(body).length === 0) return true;
            const response = await http<CostMutationResponse>(endpoints.costos.extrasDetalle(id), {
                method: "PATCH",
                body: JSON.stringify(body),
            });
            afterMutation(variantId, response);
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error al actualizar el costo extra";
            setError(message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const deleteExtra = async (id: string, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(endpoints.costos.extrasDetalle(id), { method: "DELETE" });
            invalidateVariantCostAfterDelete(queryClient, variantId);
            queryClient.invalidateQueries({ queryKey: ["extra-costs", variantId] });
            queryClient.invalidateQueries({ queryKey: ["cost-summary", variantId] });
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error al eliminar el costo extra";
            setError(message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { addExtra, updateExtra, deleteExtra, loading, error };
}
