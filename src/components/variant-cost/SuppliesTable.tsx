import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { SupplyRecord } from "@/types/variant";
import { formatCurrency, formatQuantity } from "@/lib/format-number";

interface SuppliesTableProps {
    data: SupplyRecord[];
    onAdd: () => void;
    onCreateTipo?: () => void;
    onEdit: (supply: SupplyRecord) => void;
    onDelete: (id: string) => void;
}

const formatTalla = (item: Pick<SupplyRecord, "talla_nombre" | "talla_id">) => {
    if (item.talla_id && item.talla_nombre) return item.talla_nombre;
    if (item.talla_id) return item.talla_id;
    return "Todas las tallas (compartido)";
};

export function SuppliesTable({ data, onAdd, onCreateTipo, onEdit, onDelete }: SuppliesTableProps) {
    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between py-4 gap-3">
                <CardTitle className="text-sm font-bold">Insumos</CardTitle>
                <div className="flex items-center gap-2 shrink-0">
                    {onCreateTipo && (
                        <Button variant="ghost" size="sm" onClick={onCreateTipo}>
                            <Plus className="h-3 w-3 mr-1" /> Tipo de insumo
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={onAdd}>
                        <Plus className="h-3 w-3 mr-1" /> Añadir
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {data.length > 0 ? (
                    <div className="space-y-2">
                        <div className="grid grid-cols-[1.2fr_0.8fr_0.6fr_0.8fr_1fr] gap-2 text-xs font-semibold text-muted-foreground border-b pb-2">
                            <div>Tipo</div>
                            <div>Talla</div>
                            <div>Cantidad</div>
                            <div>Valor unit.</div>
                            <div>Total</div>
                        </div>
                        {data.map((item) => (
                            <div
                                key={item.id}
                                className="grid grid-cols-[1.2fr_0.8fr_0.6fr_0.8fr_1fr] gap-2 text-sm items-center border-b py-2"
                            >
                                <div className="truncate">{item.tipo_label || item.tipo || "—"}</div>
                                <div className="text-xs text-muted-foreground truncate">{formatTalla(item)}</div>
                                <div>{formatQuantity(item.quantity)}</div>
                                <div>${formatCurrency(item.unit_price)}</div>
                                <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold">${formatCurrency(item.total)}</span>
                                    <div className="flex gap-1 shrink-0">
                                        <Pencil
                                            className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-primary"
                                            onClick={() => onEdit(item)}
                                        />
                                        <Trash2
                                            className="h-4 w-4 cursor-pointer text-red-500 hover:text-red-700"
                                            onClick={() => onDelete(item.id)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-10 text-center text-muted-foreground">Sin insumos configurados</div>
                )}
            </CardContent>
        </Card>
    );
}
