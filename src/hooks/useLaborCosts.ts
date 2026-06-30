import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { CreateLaborPayload } from "@/types/variant";

export function useLaborCosts() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const invalidate = (variantId: string) => {
        queryClient.invalidateQueries({ queryKey: ["labor-costs", variantId] });
        queryClient.invalidateQueries({ queryKey: ["cost-summary", variantId] });
    };

    const addLabor = async (payload: CreateLaborPayload) => {
        setLoading(true);
        setError(null);
        try {
            await http(endpoints.costos.manoDeObra(), {
                method: "POST",
                body: JSON.stringify({
                    variant_id: payload.variant_id,
                    fase_id: payload.fase_id,
                    cantidad: String(payload.cantidad),
                    unit_price: String(payload.unit_price),
                }),
            });
            invalidate(payload.variant_id);
            return true;
        } catch (err: any) {
            setError(err.message || "Error al agregar la fase de mano de obra");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const updateLabor = async (
        id: string,
        payload: Partial<Pick<CreateLaborPayload, "fase_id" | "cantidad" | "unit_price">>,
        variantId: string
    ) => {
        setLoading(true);
        setError(null);
        try {
            const body: Record<string, string> = {};
            if (payload.fase_id != null) body.fase_id = payload.fase_id;
            if (payload.cantidad != null) body.cantidad = String(payload.cantidad);
            if (payload.unit_price != null) body.unit_price = String(payload.unit_price);

            await http(endpoints.costos.manoDeObraDetalle(id), {
                method: "PATCH",
                body: JSON.stringify(body),
            });
            invalidate(variantId);
            return true;
        } catch (err: any) {
            setError(err.message || "Error al actualizar la fase de mano de obra");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const deleteLabor = async (id: string, variantId: string) => {
        setLoading(true);
        setError(null);
        try {
            await http(endpoints.costos.manoDeObraDetalle(id), { method: "DELETE" });
            invalidate(variantId);
            return true;
        } catch (err: any) {
            setError(err.message || "Error al eliminar la fase de mano de obra");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { loading, error, addLabor, updateLabor, deleteLabor };
}
