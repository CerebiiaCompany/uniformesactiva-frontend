import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { CreateSupplyPayload } from "@/types/variant";

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

    return { loading, error, addSupply, deleteSupply };
}
