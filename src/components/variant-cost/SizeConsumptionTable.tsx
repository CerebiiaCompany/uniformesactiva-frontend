import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { SizeFabric } from "@/types/variant";

interface SizeTableProps {
    data: SizeFabric[];
    variantId: string;
    onAdd: () => void;
    onEdit: (size: SizeFabric) => void;
    onDelete: (id: string) => void;
}

export function SizeConsumptionTable({ data, variantId, onAdd, onEdit, onDelete }: SizeTableProps) {
    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-sm font-bold">📏 Tallas y consumo de tela</CardTitle>
                <Button variant="outline" size="sm" onClick={onAdd}>
                    <Plus className="h-3 w-3 mr-1" /> Añadir
                </Button>
            </CardHeader>
            <CardContent>
                {data && data.length > 0 ? (
                    <div className="space-y-2">
                        <div className="grid grid-cols-3 text-xs font-semibold text-muted-foreground border-b pb-2">
                            <div>Talla (ID)</div><div>Consumo (m)</div><div></div>
                        </div>
                        {data.map((item) => (
                            <div key={item.id} className="grid grid-cols-3 text-sm items-center border-b py-2">
                                <div className="font-medium">{item.size_id}</div>
                                <div>{item.consumption}</div>
                                <div className="flex justify-end gap-2">
                                    <Pencil
                                        className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-primary"
                                        onClick={() => onEdit(item)}
                                        aria-label="Editar consumo de talla"
                                    />
                                    <Trash2
                                        className="h-4 w-4 cursor-pointer text-red-500 hover:text-red-700"
                                        onClick={() => onDelete(item.id)}
                                        aria-label="Eliminar consumo de talla"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-10 text-center text-muted-foreground">Sin tallas configuradas</div>
                )}
            </CardContent>
        </Card>
    );
}