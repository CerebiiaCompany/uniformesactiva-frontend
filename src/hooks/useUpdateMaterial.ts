import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export interface UpdateMaterialPayload {
    name?: string;
    category?: string;
    color?: string;
    supplier?: string;
    unit?: string;
    min_stock?: number;
    unit_cost?: number;
}

interface MaterialResponse {
    id: string;
    name: string;
    category: string;
    color?: string;
    supplier: string;
    unit: string;
    stock: number;
    min_stock: number;
    unit_cost: number;
    status: string;
    is_low_stock: boolean;
}

export function useUpdateMaterial() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({
            materialId,
            payload,
        }: {
            materialId: string;
            payload: UpdateMaterialPayload;
        }) => {
            return http<MaterialResponse>(endpoints.inventory.detail(materialId), {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["materials"] });
        },
    });

    return {
        updateMaterial: mutation.mutateAsync,
        isPending: mutation.isPending,
        error: mutation.error,
    };
}
