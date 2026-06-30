import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Check, X } from "lucide-react";
import { FabricRecord } from "@/types/variant";

interface UpdateFabricPayload {
    provider: string;
    reference: string;
    meters: number;
    price_per_meter: number;
    iva: boolean;
}

interface FabricTableProps {
    data: FabricRecord[];
    variantId: string;
    onAdd: (payload: any) => Promise<boolean>;
    onUpdate: (id: string, payload: any, variantId: string) => void | Promise<any>;
    onDelete: (id: string) => void | Promise<void>;
}

export function FabricCostsTable({ data, variantId, onAdd, onUpdate, onDelete }: FabricTableProps) {
    const [rows, setRows] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newRow, setNewRow] = useState({ provider: "", reference: "", meters: 0, price_per_meter: 0, iva: false });

    useEffect(() => {
        setRows(data);
    }, [data]);

    const handleUpdateRow = (index: number, field: string, value: any) => {
        const updated = [...rows];
        updated[index][field] = value;
        setRows(updated);
    };

    const handleConfirmAdd = async () => {
        const success = await onAdd({ ...newRow, variant_id: variantId });
        if (success) {
            setIsAdding(false);
            setNewRow({ provider: "", reference: "", meters: 0, price_per_meter: 0, iva: false });
        }
    };

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-sm font-bold">✂️ Costos de tela</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Añadir tela
                </Button>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-7 text-xs font-semibold text-muted-foreground border-b pb-2 mb-2">
                    <div>Proveedor</div><div>Referencia</div><div>Metros</div><div>$/metro</div><div>IVA</div><div>Total</div><div>Acción</div>
                </div>

                {rows.map((item, idx) => (
                    <div key={item.id || idx} className="grid grid-cols-7 gap-2 items-center border-b py-2 text-sm">
                        <Input value={item.provider} onChange={(e) => handleUpdateRow(idx, 'provider', e.target.value)} />
                        <Input value={item.reference} onChange={(e) => handleUpdateRow(idx, 'reference', e.target.value)} />
                        <Input type="number" value={item.meters} onChange={(e) => handleUpdateRow(idx, 'meters', Number(e.target.value))} className="w-20" />
                        <Input type="number" value={item.price_per_meter} onChange={(e) => handleUpdateRow(idx, 'price_per_meter', Number(e.target.value))} />
                        <Switch checked={item.iva} onCheckedChange={(val) => handleUpdateRow(idx, 'iva', val)} />
                        <div className="font-bold">${((Number(item.meters) * Number(item.price_per_meter)) * (item.iva ? 1.19 : 1)).toFixed(0)}</div>
                        <div className="flex gap-2">
                            <Button size="icon" variant="ghost" onClick={() => onUpdate(item.id, item, variantId)}><Check className="h-4 w-4 text-green-600" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => onDelete(item.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                    </div>
                ))}

                {isAdding && (
                    <div className="grid grid-cols-7 gap-2 items-center border-b py-2 text-sm bg-blue-50/50">
                        <Input value={newRow.provider} onChange={(e) => setNewRow({ ...newRow, provider: e.target.value })} placeholder="Proveedor" />
                        <Input value={newRow.reference} onChange={(e) => setNewRow({ ...newRow, reference: e.target.value })} placeholder="Ref" />
                        <Input type="number" value={newRow.meters} onChange={(e) => setNewRow({ ...newRow, meters: Number(e.target.value) })} className="w-20" />
                        <Input type="number" value={newRow.price_per_meter} onChange={(e) => setNewRow({ ...newRow, price_per_meter: Number(e.target.value) })} />
                        <Switch checked={newRow.iva} onCheckedChange={(val) => setNewRow({ ...newRow, iva: val })} />
                        <div className="font-bold">${((Number(newRow.meters) * Number(newRow.price_per_meter)) * (newRow.iva ? 1.19 : 1)).toFixed(0)}</div>
                        <div className="flex gap-2">
                            <Button size="icon" variant="ghost" onClick={handleConfirmAdd}><Check className="h-4 w-4 text-green-600" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}><X className="h-4 w-4 text-gray-500" /></Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}