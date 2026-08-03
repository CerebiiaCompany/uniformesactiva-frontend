import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDecimal } from "@/lib/format-number";
import type { VariantSizeCostSummary } from "@/types/variant";

interface VariantSizeCostBreakdownTableProps {
    sizes: VariantSizeCostSummary[];
    selectedSizeId?: string;
    onSelectSize?: (sizeId: string) => void;
}

const formatMoney = (value: string | number) => formatCurrency(value);

export function VariantSizeCostBreakdownTable({
    sizes,
    selectedSizeId,
    onSelectSize,
}: VariantSizeCostBreakdownTableProps) {
    if (!sizes.length) {
        return (
            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-sm font-bold">Costo por talla</CardTitle>
                </CardHeader>
                <CardContent className="pb-6 text-sm text-muted-foreground">
                    Configura el consumo de tela por talla para ver el desglose completo (tela + insumos + mano
                    de obra + extras).
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold">Costo por talla</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                    Desglose real usado en órdenes. Haz clic en una fila para ver el detalle en el resumen.
                </p>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                            <th className="text-left font-semibold px-4 py-2">Talla</th>
                            <th className="text-right font-semibold px-3 py-2">Consumo</th>
                            <th className="text-right font-semibold px-3 py-2">Tela</th>
                            <th className="text-right font-semibold px-3 py-2">Insumos</th>
                            <th className="text-right font-semibold px-3 py-2">M. obra</th>
                            <th className="text-right font-semibold px-3 py-2">Extras</th>
                            <th className="text-right font-semibold px-4 py-2">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sizes.map((size) => {
                            const isSelected = selectedSizeId === size.talla_id;
                            return (
                                <tr
                                    key={size.talla_id}
                                    className={cn(
                                        "border-b cursor-pointer transition-colors hover:bg-muted/40",
                                        isSelected && "bg-primary/5"
                                    )}
                                    onClick={() => onSelectSize?.(size.talla_id)}
                                >
                                    <td className="px-4 py-2.5 font-semibold">{size.talla_nombre || "—"}</td>
                                    <td className="px-3 py-2.5 text-right text-muted-foreground">
                                        {formatDecimal(size.consumption)} m
                                    </td>
                                    <td className="px-3 py-2.5 text-right">${formatMoney(size.fabric_total)}</td>
                                    <td className="px-3 py-2.5 text-right">${formatMoney(size.supplies_total)}</td>
                                    <td className="px-3 py-2.5 text-right">${formatMoney(size.labor_total)}</td>
                                    <td className="px-3 py-2.5 text-right">
                                        ${formatMoney(size.extras_total ?? 0)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-bold">
                                        ${formatMoney(size.overall_total)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
}
