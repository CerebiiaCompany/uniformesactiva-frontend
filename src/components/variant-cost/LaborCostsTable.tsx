import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { LaborPhase } from "@/types/variant";

// Define el payload esperado para la actualización de mano de obra
interface UpdateLaborPayload {
    activity_name: string;
    total: number;
}

interface LaborTableProps {
    data: LaborPhase[];
    variantId: string;
    onAdd: () => void;
    onEdit: (labor: LaborPhase) => void;
    // Cambiado a Promise<any> para resolver la discrepancia de tipos (boolean vs void)
    onUpdate: (id: string, payload: UpdateLaborPayload, variantId: string) => Promise<any>;
    onDelete: (id: string) => Promise<void>;
}

export function LaborCostsTable({ data, variantId, onAdd, onEdit, onUpdate, onDelete }: LaborTableProps) {
    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-sm font-bold">Mano de obra</CardTitle>
                <Button variant="outline" size="sm" onClick={onAdd}>
                    <Plus className="h-3 w-3 mr-1" /> Añadir
                </Button>
            </CardHeader>
            <CardContent>
                {data && data.length > 0 ? (
                    <div className="space-y-2">
                        <div className="grid grid-cols-4 text-xs font-semibold text-muted-foreground border-b pb-2">
                            <div className="col-span-2">Fase</div>
                            <div className="col-span-1">Valor</div>
                            <div className="col-span-1"></div>
                        </div>
                        {data.map((item) => (
                            <div key={item.id} className="grid grid-cols-4 text-sm items-center border-b py-2">
                                <div className="col-span-2">{item.activity_name}</div>
                                <div className="col-span-1 font-bold">${Number(item.total).toFixed(2)}</div>
                                <div className="col-span-1 flex justify-end gap-2">
                                    <Pencil
                                        className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-primary"
                                        onClick={() => onEdit(item)}
                                        aria-label="Editar mano de obra"
                                    />
                                    <Trash2
                                        className="h-4 w-4 cursor-pointer text-red-500 hover:text-red-700"
                                        onClick={() => onDelete(item.id)}
                                        aria-label="Eliminar mano de obra"
                                    />
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