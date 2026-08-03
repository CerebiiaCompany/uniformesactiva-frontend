import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export interface MaterialSupplierOffer {
    id: string;
    material_id: string;
    supplier_name: string;
    code: string;
    unit_cost: number | string;
    last_purchase_at: string | null;
}

export interface MaterialSuppliersResponse {
    material: {
        id: string;
        name: string;
        category: string;
        color: string;
        unit: string;
        supplier: string;
        unit_cost: number | string;
    };
    reference_unit_cost_max: number | string;
    best_unit_cost: number | string;
    offers: MaterialSupplierOffer[];
}

export interface CreateSupplierOfferPayload {
    supplier_name: string;
    unit_cost: number;
    code?: string;
    last_purchase_at?: string | null;
}

export interface UpdateSupplierOfferPayload {
    supplier_name?: string;
    unit_cost?: number;
    code?: string;
    last_purchase_at?: string | null;
}

export function useMaterialSuppliers(materialId: string | null) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["material-suppliers", materialId],
        queryFn: () =>
            http<MaterialSuppliersResponse>(endpoints.inventory.suppliers(materialId!)),
        enabled: !!materialId,
    });

    const createMutation = useMutation({
        mutationFn: (payload: CreateSupplierOfferPayload) =>
            http<MaterialSupplierOffer>(endpoints.inventory.suppliers(materialId!), {
                method: "POST",
                body: JSON.stringify(payload),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["material-suppliers", materialId] });
            queryClient.invalidateQueries({ queryKey: ["materials"] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({
            offerId,
            payload,
        }: {
            offerId: string;
            payload: UpdateSupplierOfferPayload;
        }) =>
            http<MaterialSupplierOffer>(
                endpoints.inventory.supplierDetail(materialId!, offerId),
                {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                }
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["material-suppliers", materialId] });
            queryClient.invalidateQueries({ queryKey: ["materials"] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (offerId: string) =>
            http(endpoints.inventory.supplierDetail(materialId!, offerId), {
                method: "DELETE",
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["material-suppliers", materialId] });
            queryClient.invalidateQueries({ queryKey: ["materials"] });
        },
    });

    return {
        data: query.data,
        isLoading: query.isLoading,
        refetch: query.refetch,
        createOffer: createMutation.mutateAsync,
        updateOffer: updateMutation.mutateAsync,
        deleteOffer: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
}
