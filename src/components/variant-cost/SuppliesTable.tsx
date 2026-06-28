import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { SupplyRecord } from "@/types/variant";

interface SuppliesTableProps {
    data: SupplyRecord[];
    variantId: string;
    onAdd: () => void;
    onEdit: (supply: SupplyRecord) => void;
    onDelete: (id: string) => void;
}

export function SuppliesTable({ data, variantId, onAdd, onEdit, onDelete }: SuppliesTableProps) {
    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-sm font-bold">Insumos</CardTitle>
                <Button variant="outline" size="sm" onClick={onAdd}>
                    <Plus className="h-3 w-3 mr-1" /> Añadir
                </Button>
            </CardHeader>
            <CardContent>
                {data && data.length > 0 ? (
                    <div className="space-y-2">
                        <div className="grid grid-cols-5 text-xs font-semibold text-muted-foreground border-b pb-2">
                            <div className="col-span-1">Descripción</div>
                            <div className="col-span-1">Cantidad</div>
                            <div className="col-span-1">Valor Unit.</div>
                            <div className="col-span-1">Total</div>
                            <div className="col-span-1"></div>
                        </div>
                        {data.map((item) => (
                            <div key={item.id} className="grid grid-cols-5 text-sm items-center border-b py-2">
                                <div className="col-span-1">{item.description}</div>
                                <div className="col-span-1">{item.quantity}</div>
                                <div className="col-span-1">${item.unit_price}</div>
                                <div className="col-span-1 font-bold">${Number(item.total).toFixed(2)}</div>
                                <div className="col-span-1 flex justify-end gap-2">
                                    <Pencil
                                        className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-primary"
                                        onClick={() => onEdit(item)}
                                        aria-label="Editar insumo"
                                    />
                                    <Trash2
                                        className="h-4 w-4 cursor-pointer text-red-500 hover:text-red-700"
                                        onClick={() => onDelete(item.id)}
                                        aria-label="Eliminar insumo"
                                    />
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