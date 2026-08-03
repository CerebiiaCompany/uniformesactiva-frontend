import type { QueryClient } from "@tanstack/react-query";
import type { ProductVariant, VariantCostSummary } from "@/types/variant";

/** Respuesta enriquecida de POST/PATCH en endpoints de costos por variante. */
export interface CostMutationResponse {
    variant_id?: string;
    variant_estimated_cost?: number | string;
}

export function parseVariantEstimatedCost(value: number | string | undefined): number | null {
    if (value == null || value === "") return null;
    const num = typeof value === "number" ? value : Number(value);
    return Number.isNaN(num) ? null : num;
}

/** Sincroniza el costo estimado de la variante en caché sin llamar al resumen. */
export function applyVariantEstimatedCost(
    queryClient: QueryClient,
    variantId: string,
    estimatedCost: number | string | undefined
) {
    const parsed = parseVariantEstimatedCost(estimatedCost);
    if (parsed == null) return;

    queryClient.setQueriesData<ProductVariant[]>(
        { queryKey: ["product-variants"] },
        (old) =>
            old?.map((variant) =>
                variant.id === variantId
                    ? { ...variant, estimated_cost: String(parsed) }
                    : variant
            ) ?? old
    );

    queryClient.setQueryData<VariantCostSummary>(["cost-summary", variantId], (old) =>
        old ? { ...old, overall_total: parsed } : old
    );
}

export function invalidateVariantCostLists(queryClient: QueryClient, variantId: string) {
    queryClient.invalidateQueries({ queryKey: ["fabric-costs", variantId] });
    queryClient.invalidateQueries({ queryKey: ["supply-costs", variantId] });
    queryClient.invalidateQueries({ queryKey: ["labor-costs", variantId] });
    queryClient.invalidateQueries({ queryKey: ["extra-costs", variantId] });
    queryClient.invalidateQueries({ queryKey: ["size-consumption", variantId] });
}

/** Tras DELETE (204): el backend recalcula pero no devuelve body → refrescar resumen. */
export function invalidateVariantCostAfterDelete(queryClient: QueryClient, variantId: string) {
    invalidateVariantCostLists(queryClient, variantId);
    queryClient.invalidateQueries({ queryKey: ["cost-summary", variantId] });
    queryClient.invalidateQueries({ queryKey: ["product-variants"] });
}

export function handleCostMutationResponse(
    queryClient: QueryClient,
    variantId: string,
    response: CostMutationResponse | void
) {
    if (!response) return;
    applyVariantEstimatedCost(queryClient, variantId, response.variant_estimated_cost);
}
