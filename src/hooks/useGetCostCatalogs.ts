import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { CatalogOption } from "@/types/variant";

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

export function useGetCostCatalogs() {
    const sizesQuery = useQuery({
        queryKey: ["cost-catalog", "tallas"],
        queryFn: async () => normalizeCatalog(await http<any[]>(endpoints.costos.tallas())),
    });

    const supplyTypesQuery = useQuery({
        queryKey: ["cost-catalog", "tipos-insumo"],
        queryFn: async () => normalizeCatalog(await http<any[]>(endpoints.costos.tiposInsumo())),
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
        isLoading:
            sizesQuery.isLoading ||
            supplyTypesQuery.isLoading ||
            laborPhasesQuery.isLoading ||
            proveedoresQuery.isLoading,
    };
}
