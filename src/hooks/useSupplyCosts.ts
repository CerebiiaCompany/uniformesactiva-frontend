import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { CreateSupplyPayload, UpdateSupplyPayload } from "@/types/variant";

export function useSupplyCosts() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const invalidate = (variantId: string) => {
        queryClient.invalidateQueries({ queryKey: ["supply-costs", variantId] });
        queryClient.invalidateQueries({ queryKey: ["cost-summary", variantId] });
    };

    const addSupply = async (payload: CreateSupplyPayload) => {
        setLoading(true);
        setError(null);
        try {
            await http(endpoints.costos.insumos(), {
                method: "POST",
                body: JSON.stringify({
                    variant_id: payload.variant_id,
                    tipo_id: payload.tipo_id,
                    quantity: String(payload.quantity),
                    unit_price: String(payload.unit_price),
                }),
            });
            invalidate(payload.variant_id);
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
            const body: Record<string, string> = {};
            if (payload.tipo_id != null) body.tipo_id = payload.tipo_id;
            if (payload.quantity != null) body.quantity = String(payload.quantity);
            if (payload.unit_price != null) body.unit_price = String(payload.unit_price);

            if (Object.keys(body).length === 0) return true;

            await http(endpoints.costos.insumosDetalle(id), {
                method: "PATCH",
                body: JSON.stringify(body),
            });
            invalidate(variantId);
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
            invalidate(variantId);
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
