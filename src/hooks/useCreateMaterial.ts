import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

interface CreateMaterialPayload {
    name: string;
    category: string;
    supplier: string;
    unit: string;
    stock: number;
    min_stock: number;
    unit_cost: number;
}

interface MaterialResponse {
    id: string;
    name: string;
    category: string;
    supplier: string;
    unit: string;
    stock: number;
    min_stock: number;
    unit_cost: number;
    status: string;
    is_low_stock: boolean;
}

export function useCreateMaterial() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (payload: CreateMaterialPayload) => {
            return http<MaterialResponse>(endpoints.inventory.create(), {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["materials"] });
        },
    });

    return {
        createMaterial: mutation.mutateAsync,
        isPending: mutation.isPending,
        error: mutation.error,
        isSuccess: mutation.isSuccess,
    };
}