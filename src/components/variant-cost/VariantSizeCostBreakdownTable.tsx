import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDecimal, parseApiNumber } from "@/lib/format-number";
import type { VariantSizeCostSummary } from "@/types/variant";

interface VariantSizeCostBreakdownTableProps {
    sizes: VariantSizeCostSummary[];
    selectedSizeId?: string;
    onSelectSize?: (sizeId: string) => void;
    /** Si viene del resumen del backend, se usa; si no, se calcula en cliente. */
    averageConsumption?: string | number | null;
}

const formatMoney = (value: string | number) => formatCurrency(value);

export function VariantSizeCostBreakdownTable({
    sizes,
    selectedSizeId,
    onSelectSize,
    averageConsumption,
}: VariantSizeCostBreakdownTableProps) {
    const computedAverage = useMemo(() => {
        let raw = 0;
        if (averageConsumption != null && averageConsumption !== "") {
            const fromProp = parseApiNumber(averageConsumption);
            if (fromProp > 0) raw = fromProp;
        }
        if (!raw && sizes.length) {
            const total = sizes.reduce((sum, size) => sum + parseApiNumber(size.consumption), 0);
            raw = total / sizes.length;
        }
        // Solo este valor: aproximado a 1 decimal
        return Math.round(raw * 10) / 10;
    }, [sizes, averageConsumption]);

    if (!sizes.length) {
        return (
            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-lg font-bold tracking-tight">Costo por talla</CardTitle>
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
                <CardTitle className="text-lg font-bold tracking-tight">Costo por talla</CardTitle>
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
                            <th className="text-right font-semibold px-3 py-2">CIF</th>
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
                                        "border-b cursor-pointer transition-colors hover:bg-primary/5",
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
                                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                                        ${formatMoney(size.cif_total ?? 0)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-semibold">
                                        ${formatMoney(size.overall_total)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-muted/40 border-t-2">
                            <td className="px-4 py-3 font-semibold text-foreground">
                                Consumo promedio de tallas
                            </td>
                            <td className="px-3 py-3 text-right text-foreground">
                                ≈ {formatDecimal(computedAverage, 1)} m
                            </td>
                            <td className="px-3 py-3" />
                            <td className="px-3 py-3" />
                            <td className="px-3 py-3" />
                            <td className="px-3 py-3" />
                            <td className="px-3 py-3" />
                            <td className="px-4 py-3" />
                        </tr>
                    </tfoot>
                </table>
            </CardContent>
        </Card>
    );
}
