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
import type { CreateCIFCostPayload, UpdateCIFCostPayload } from "@/types/variant";

function buildCIFBody(payload: CreateCIFCostPayload | UpdateCIFCostPayload, isCreate: boolean) {
    const body: Record<string, unknown> = {};
    if (isCreate && "variant_id" in payload && payload.variant_id) {
        body.variant_id = payload.variant_id;
    }
    body.concepto = payload.concepto ? String(payload.concepto).trim() : "Costos Indirectos de Fabricación (CIF)";
    if (payload.cantidad != null) body.cantidad = String(payload.cantidad);
    else if (isCreate) body.cantidad = "1";
    if (payload.unit_price != null) body.unit_price = String(payload.unit_price);
    if (payload.talla_id !== undefined) {
        body.talla_id = payload.talla_id || null;
    } else if (isCreate) {
        body.talla_id = null;
    }
    return body;
}

export function useCIFCosts() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const afterMutation = (variantId: string, response: CostMutationResponse) => {
        handleCostMutationResponse(queryClient, variantId, response);
        invalidateVariantCostLists(queryClient, variantId);
        queryClient.invalidateQueries({ queryKey: ["cif-costs", variantId] });
        queryClient.invalidateQueries({ queryKey: ["cost-summary", variantId] });
    };

    const addCIF = async (payload: CreateCIFCostPayload) => {
        setLoading(true);
        setError(null);
        try {
            const body = buildCIFBody(payload, true);
            const response = await http<CostMutationResponse>(endpoints.costos.cif(), {
                method: "POST",
                body: JSON.stringify(body),
            });
            afterMutation(payload.variant_id, response);
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error al registrar CIF";
            setError(message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const updateCIF = async (id: string, payload: UpdateCIFCostPayload, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            const body = buildCIFBody(payload, false);
            if (Object.keys(body).length === 0) return true;
            const response = await http<CostMutationResponse>(endpoints.costos.cifDetalle(id), {
                method: "PATCH",
                body: JSON.stringify(body),
            });
            afterMutation(variantId, response);
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error al actualizar CIF";
            setError(message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const deleteCIF = async (id: string, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(endpoints.costos.cifDetalle(id), { method: "DELETE" });
            invalidateVariantCostAfterDelete(queryClient, variantId);
            queryClient.invalidateQueries({ queryKey: ["cif-costs", variantId] });
            queryClient.invalidateQueries({ queryKey: ["cost-summary", variantId] });
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error al eliminar CIF";
            setError(message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { addCIF, updateCIF, deleteCIF, loading, error };
}
