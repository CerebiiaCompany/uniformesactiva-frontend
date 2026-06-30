import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { LaborPhase } from "@/types/variant";

const resolveFaseLabel = (item: any, catalogById: Map<string, string>): string => {
    if (item.fase_label) return item.fase_label;
    if (item.fase_nombre) return item.fase_nombre;
    if (item.fase_name) return item.fase_name;
    if (typeof item.fase === "object" && item.fase) {
        return item.fase.name ?? item.fase.label ?? item.fase.code ?? "";
    }
    if (typeof item.fase === "string" && item.fase) return item.fase;
    if (item.activity_name) return item.activity_name;

    const faseId = item.fase_id ?? (typeof item.fase === "object" ? item.fase?.id : undefined);
    if (faseId && catalogById.has(faseId)) return catalogById.get(faseId)!;

    return "";
};

const computeLineTotal = (apiTotal: unknown, quantity: number, unitPrice: number): string => {
    const fromApi = Number(apiTotal);
    if (!Number.isNaN(fromApi) && fromApi > 0) return String(fromApi);
    return String(quantity * unitPrice);
};

const mapLabor = (item: any, catalogById: Map<string, string>): LaborPhase => {
    const faseId = item.fase_id ?? (typeof item.fase === "object" ? item.fase?.id : undefined);
    const faseLabel = resolveFaseLabel(item, catalogById);
    const cantidad = Number(item.cantidad ?? 1);
    const unitPrice = Number(item.unit_price ?? 0);

    return {
        id: item.id,
        variant_id: item.variant_id,
        fase_id: faseId ?? "",
        fase: faseId ?? (typeof item.fase === "string" ? item.fase : ""),
        fase_label: faseLabel,
        cantidad: String(item.cantidad ?? "1"),
        unit_price: String(item.unit_price ?? "0"),
        total: computeLineTotal(item.total, cantidad, unitPrice),
    };
};

const buildCatalogMap = (catalog: any[]): Map<string, string> =>
    new Map(
        catalog.map((item) => [
            item.id,
            item.name ?? item.label ?? item.code ?? item.value ?? "",
        ])
    );

export const useGetLaborCosts = (variantId: string) => {
    return useQuery({
        queryKey: ["labor-costs", variantId],
        queryFn: async () => {
            const [data, catalog] = await Promise.all([
                http<any[]>(endpoints.costos.manoDeObraByVariant(variantId)),
                http<any[]>(endpoints.costos.fasesManoDeObra()),
            ]);
            const catalogById = buildCatalogMap(catalog);
            return data.map((item) => mapLabor(item, catalogById));
        },
        enabled: !!variantId,
    });
};
