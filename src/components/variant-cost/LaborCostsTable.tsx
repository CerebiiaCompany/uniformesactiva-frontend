import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { LaborPhase } from "@/types/variant";
import { formatCurrency, formatQuantity } from "@/lib/format-number";

interface LaborTableProps {
    data: LaborPhase[];
    onAdd: () => void;
    onEdit: (labor: LaborPhase) => void;
    onDelete: (id: string) => void;
}

export function LaborCostsTable({ data, onAdd, onEdit, onDelete }: LaborTableProps) {
    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-sm font-bold">Mano de obra</CardTitle>
                <Button variant="outline" size="sm" onClick={onAdd}>
                    <Plus className="h-3 w-3 mr-1" /> Añadir
                </Button>
            </CardHeader>
            <CardContent>
                {data.length > 0 ? (
                    <div className="space-y-2">
                        <div className="grid grid-cols-5 text-xs font-semibold text-muted-foreground border-b pb-2">
                            <div className="col-span-2">Fase</div>
                            <div>Cantidad</div>
                            <div>Precio unit.</div>
                            <div>Total</div>
                        </div>
                        {data.map((item) => (
                            <div key={item.id} className="grid grid-cols-5 text-sm items-center border-b py-2">
                                <div className="col-span-2">{item.fase_label || item.fase || "—"}</div>
                                <div>{formatQuantity(item.cantidad)}</div>
                                <div>${formatCurrency(item.unit_price)}</div>
                                <div className="flex items-center justify-between">
                                    <span className="font-bold">${formatCurrency(item.total)}</span>
                                    <div className="flex gap-2">
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
                    <div className="py-10 text-center text-muted-foreground">Sin mano de obra configurada</div>
                )}
            </CardContent>
        </Card>
    );
}
