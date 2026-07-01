import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { SupplyRecord } from "@/types/variant";

const resolveTipoLabel = (item: any, catalogById: Map<string, string>): string => {
    if (item.tipo_label) return item.tipo_label;
    if (item.tipo_nombre) return item.tipo_nombre;
    if (item.tipo_name) return item.tipo_name;
    if (typeof item.tipo === "object" && item.tipo) {
        return item.tipo.name ?? item.tipo.label ?? item.tipo.code ?? "";
    }
    if (typeof item.tipo === "string" && item.tipo) return item.tipo;
    if (item.description) return item.description;

    const tipoId = item.tipo_id ?? (typeof item.tipo === "object" ? item.tipo?.id : undefined);
    if (tipoId && catalogById.has(tipoId)) return catalogById.get(tipoId)!;

    return "";
};

const mapSupply = (item: any, catalogById: Map<string, string>): SupplyRecord => {
    const tipoId = item.tipo_id ?? (typeof item.tipo === "object" ? item.tipo?.id : undefined);
    const tipoLabel = resolveTipoLabel(item, catalogById);
    const quantity = Number(item.quantity ?? 0);
    const unitPrice = Number(item.unit_price ?? 0);
    const fromApi = Number(item.total ?? 0);
    const total = fromApi > 0 ? fromApi : quantity * unitPrice;

    return {
        id: item.id,
        variant_id: item.variant_id,
        tipo_id: tipoId ?? (typeof item.tipo === "string" ? item.tipo : ""),
        tipo: tipoId ?? (typeof item.tipo === "string" ? item.tipo : ""),
        tipo_label: tipoLabel,
        quantity: String(item.quantity ?? "0"),
        unit_price: String(item.unit_price ?? "0"),
        total: String(total),
    };
};

const buildCatalogMap = (catalog: any[]): Map<string, string> =>
    new Map(
        catalog.map((item) => [
            item.id,
            item.name ?? item.label ?? item.code ?? item.value ?? "",
        ])
    );

export const useGetSupplyCosts = (variantId: string) => {
    return useQuery({
        queryKey: ["supply-costs", variantId],
        queryFn: async () => {
            const [data, catalog] = await Promise.all([
                http<any[]>(endpoints.costos.insumosByVariant(variantId)),
                http<any[]>(endpoints.costos.tiposInsumo()),
            ]);
            const catalogById = buildCatalogMap(catalog);
            return data.map((item) => mapSupply(item, catalogById));
        },
        enabled: !!variantId,
    });
};
