import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

interface RemoveStockPayload {
    materialId: string;
    quantity: number;
    reference?: string;
    note?: string;
}

export function useRemoveMaterialStock() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({ materialId, quantity, reference, note }: RemoveStockPayload) => {
            return http(endpoints.inventory.removeStock(materialId), {
                method: "POST",
                body: JSON.stringify({
                    quantity,
                    reference: reference || "",
                    note: note || "",
                }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["materials"] });
            queryClient.invalidateQueries({ queryKey: ["material-movements"] });
        },
    });

    return {
        removeStock: mutation.mutateAsync,
        isPending: mutation.isPending,
        error: mutation.error,
    };
}
