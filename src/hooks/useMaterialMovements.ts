import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export type StockMovementTipo = "entrada" | "salida" | "inicial";

export interface StockMovement {
    id: string;
    created_at: string;
    quantity: number | string;
    reference: string;
    tipo: StockMovementTipo;
    proveedor?: string | null;
    costo_total?: number | string | null;
    nota?: string | null;
}

export function useMaterialMovements(materialId: string | null, enabled = true) {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["material-movements", materialId],
        queryFn: () =>
            http<StockMovement[]>(endpoints.inventory.movements(materialId as string)),
        enabled: Boolean(materialId) && enabled,
    });

    return {
        movements: data || [],
        isLoading,
        error,
        refetch,
        count: data?.length ?? 0,
    };
}
