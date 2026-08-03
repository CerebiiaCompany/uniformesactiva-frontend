import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

interface AddStockPayload {
    materialId: string;
    quantity: number;
    reference?: string;
    supplier_offer_id?: string;
    unit_cost?: number;
}

export function useAddMaterialStock() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({
            materialId,
            quantity,
            reference,
            supplier_offer_id,
            unit_cost,
        }: AddStockPayload) => {
            return http(endpoints.inventory.addStock(materialId), {
                method: "POST",
                body: JSON.stringify({
                    quantity,
                    reference: reference || "",
                    supplier_offer_id: supplier_offer_id || null,
                    unit_cost: unit_cost ?? null,
                }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["materials"] });
            queryClient.invalidateQueries({ queryKey: ["material-suppliers"] });
        },
    });

    return {
        addStock: mutation.mutateAsync,
        isPending: mutation.isPending,
        error: mutation.error,
    };
}
