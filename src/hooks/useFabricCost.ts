import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { CreateFabricPayload } from "@/types/variant";

export function useFabricCosts() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const invalidate = (variantId: string) => {
        queryClient.invalidateQueries({ queryKey: ["fabric-costs", variantId] });
        queryClient.invalidateQueries({ queryKey: ["cost-summary", variantId] });
    };

    const addFabric = async (payload: CreateFabricPayload) => {
        setLoading(true);
        setError(null);
        try {
            await http(endpoints.costos.tela(), {
                method: "POST",
                body: JSON.stringify({
                    ...payload,
                    meters: String(payload.meters),
                    price_per_meter: String(payload.price_per_meter),
                }),
            });
            invalidate(payload.variant_id);
            return true;
        } catch (err: any) {
            setError(err.message || "Error al agregar el costo de tela");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { loading, error, addFabric };
}
