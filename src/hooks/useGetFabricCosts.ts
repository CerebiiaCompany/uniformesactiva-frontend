import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { FabricRecord } from "@/types/variant";

const resolveProveedorNombre = (item: any, catalogById: Map<string, string>): string => {
    if (item.proveedor_nombre) return item.proveedor_nombre;
    if (item.proveedor?.name) return item.proveedor.name;
    if (item.provider) return item.provider;

    const proveedorId = item.proveedor_id ?? item.proveedor?.id;
    if (proveedorId && catalogById.has(proveedorId)) return catalogById.get(proveedorId)!;

    return "";
};

const mapFabric = (item: any, catalogById: Map<string, string>): FabricRecord => {
    const proveedorId = item.proveedor_id ?? item.proveedor?.id ?? "";
    const meters = Number(item.meters ?? 0);
    const pricePerMeter = Number(item.price_per_meter ?? 0);
    const tieneIva = Boolean(item.tiene_iva ?? item.iva);
    const base = meters * pricePerMeter;
    const computed = tieneIva ? base * 1.19 : base;
    const fromApi = Number(item.total ?? 0);
    const total = fromApi > 0 ? fromApi : computed;

    return {
        id: item.id,
        variant_id: item.variant_id,
        proveedor_id: proveedorId,
        proveedor_nombre: resolveProveedorNombre(item, catalogById),
        reference: item.reference ?? "",
        meters: String(item.meters ?? "0"),
        price_per_meter: String(item.price_per_meter ?? "0"),
        tiene_iva: tieneIva,
        es_principal: Boolean(item.es_principal),
        total: String(total),
    };
};

const buildCatalogMap = (catalog: any[]): Map<string, string> =>
    new Map(catalog.map((item) => [item.id, item.name ?? item.label ?? ""]));

export const useGetFabricCosts = (variantId: string) => {
    return useQuery({
        queryKey: ["fabric-costs", variantId],
        queryFn: async () => {
            const [data, proveedores] = await Promise.all([
                http<any[]>(endpoints.costos.telaByVariant(variantId)),
                http<any[]>(endpoints.costos.proveedores()),
            ]);
            const catalogById = buildCatalogMap(proveedores);
            return data.map((item) => mapFabric(item, catalogById));
        },
        enabled: !!variantId,
    });
};
