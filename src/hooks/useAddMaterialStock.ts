import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

interface AddStockPayload {
    materialId: string;
    quantity: number;
    reference: string;
}

export function useAddMaterialStock() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({ materialId, quantity, reference }: AddStockPayload) => {
            return http(endpoints.inventory.addStock(materialId), {
                method: "POST",
                body: JSON.stringify({ quantity, reference }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["materials"] });
        },
    });

    return {
        addStock: mutation.mutateAsync,
        isPending: mutation.isPending,
        error: mutation.error,
    };
}