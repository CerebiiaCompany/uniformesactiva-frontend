import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { CatalogOption, SizeFabric } from "@/types/variant";

const normalizeCatalog = (items: any[]): CatalogOption[] =>
    items.map((item) => {
        if (typeof item === "string") {
            return { id: item, name: item, code: item };
        }
        return {
            id: item.id ?? item.code ?? item.value,
            code: item.code ?? item.value,
            name: item.name ?? item.label ?? item.code ?? item.value,
            label: item.label ?? item.name ?? item.code,
        };
    });

const resolveCatalogSizeId = (item: any, catalog: CatalogOption[]): string => {
    const candidates = [
        item.talla_id,
        item.size_id,
        item.talla?.id,
        item.size?.id,
        item.talla?.code,
        item.size?.code,
        item.size_code,
        item.talla_code,
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
        const match = catalog.find((s) => s.id === candidate || s.code === candidate);
        if (match) return match.id;
    }

    return candidates[0] ?? "";
};

const mapSizeConsumption = (item: any, catalog: CatalogOption[]): SizeFabric => ({
    id: item.id,
    variant_id: item.variant_id,
    size_id: resolveCatalogSizeId(item, catalog),
    consumption: String(item.consumption ?? item.consumo ?? "0"),
    size_label:
        item.size_label ??
        item.talla?.name ??
        item.size?.name ??
        item.talla?.label ??
        item.size?.label,
});

export const useGetSizeConsumption = (variantId: string) => {
    return useQuery({
        queryKey: ["size-consumption", variantId],
        queryFn: async () => {
            const [data, tallas] = await Promise.all([
                http<any[]>(endpoints.costos.tallasConsumoByVariant(variantId)),
                http<any[]>(endpoints.costos.tallas()),
            ]);
            const catalog = normalizeCatalog(tallas);
            return data.map((item) => mapSizeConsumption(item, catalog));
        },
        enabled: !!variantId,
    });
};
