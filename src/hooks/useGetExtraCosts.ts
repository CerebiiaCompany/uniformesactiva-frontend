import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { ExtraCost } from "@/types/variant";

const computeLineTotal = (apiTotal: unknown, quantity: number, unitPrice: number): string => {
    const fromApi = Number(apiTotal);
    if (!Number.isNaN(fromApi) && fromApi > 0) return String(fromApi);
    return String(quantity * unitPrice);
};

const mapExtra = (item: Record<string, unknown>): ExtraCost => {
    const cantidad = Number(item.cantidad ?? 1);
    const unitPrice = Number(item.unit_price ?? 0);

    return {
        id: String(item.id ?? ""),
        variant_id: String(item.variant_id ?? ""),
        concepto: String(item.concepto ?? ""),
        talla_id: (item.talla_id as string | null | undefined) ?? null,
        talla_nombre: (item.talla_nombre as string | null | undefined) ?? null,
        cantidad: String(item.cantidad ?? "1"),
        unit_price: String(item.unit_price ?? "0"),
        total: computeLineTotal(item.total, cantidad, unitPrice),
    };
};

export const useGetExtraCosts = (variantId: string) => {
    return useQuery({
        queryKey: ["extra-costs", variantId],
        queryFn: async () => {
            const data = await http<Record<string, unknown>[]>(
                endpoints.costos.extrasByVariant(variantId)
            );
            return data.map(mapExtra);
        },
        enabled: !!variantId,
    });
};
