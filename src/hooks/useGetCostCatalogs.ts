import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { normalizeTallaCatalog } from "@/lib/talla-catalog";
import type { CatalogOption } from "@/types/variant";

const normalizeCatalog = (items: any[]): CatalogOption[] =>
    items.map((item) => {
        if (typeof item === "string") {
            return { id: item, name: item, code: item };
        }
        return {
            id: item.id ?? item.code ?? item.value,
            code: item.code ?? item.value ?? item.codigo_sku,
            name: item.name ?? item.label ?? item.code ?? item.value,
            label: item.label ?? item.name ?? item.code,
            categoria: item.categoria,
            unidad_medida: item.unidad_medida,
            precio_unitario_default: item.precio_unitario_default ?? null,
            codigo_sku: item.codigo_sku,
            proveedor_marca: item.proveedor_marca,
            color: item.color,
            stock_minimo: item.stock_minimo ?? null,
            stock_inicial: item.stock_inicial ?? null,
        };
    });

export function useGetCostCatalogs() {
    const sizesQuery = useQuery({
        queryKey: ["cost-catalog", "tallas"],
        queryFn: async () => normalizeTallaCatalog(await http<any[]>(endpoints.costos.tallas())),
    });

    const supplyTypesQuery = useQuery({
        queryKey: ["cost-catalog", "tipos-insumo"],
        queryFn: async () => {
            const items = normalizeCatalog(await http<any[]>(endpoints.costos.tiposInsumo()));
            return items.sort((a, b) =>
                String(a.label || a.name).localeCompare(String(b.label || b.name), "es", {
                    sensitivity: "base",
                })
            );
        },
    });

    const laborPhasesQuery = useQuery({
        queryKey: ["cost-catalog", "fases-mano-de-obra"],
        queryFn: async () => normalizeCatalog(await http<any[]>(endpoints.costos.fasesManoDeObra())),
    });

    const proveedoresQuery = useQuery({
        queryKey: ["cost-catalog", "proveedores"],
        queryFn: async () => {
            const data = await http<any[]>(endpoints.costos.proveedores());
            return data.map((p) => ({ id: p.id, name: p.name }));
        },
    });

    return {
        sizes: sizesQuery.data ?? [],
        supplyTypes: supplyTypesQuery.data ?? [],
        laborPhases: laborPhasesQuery.data ?? [],
        proveedores: proveedoresQuery.data ?? [],
        refetchProveedores: proveedoresQuery.refetch,
        refetchSupplyTypes: supplyTypesQuery.refetch,
        isLoading:
            sizesQuery.isLoading ||
            supplyTypesQuery.isLoading ||
            laborPhasesQuery.isLoading ||
            proveedoresQuery.isLoading,
    };
}
