import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Check, X } from "lucide-react";
import type { FabricRecord, Proveedor } from "@/types/variant";

interface FabricTableProps {
    data: FabricRecord[];
    variantId: string;
    proveedores: Proveedor[];
    onAdd: (payload: any) => Promise<boolean>;
    onCreateProveedor: () => void;
}

export function FabricCostsTable({ data, variantId, proveedores, onAdd, onCreateProveedor }: FabricTableProps) {
    const proveedorNameById = new Map(proveedores.map((p) => [p.id, p.name]));
    const [rows, setRows] = useState<FabricRecord[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newRow, setNewRow] = useState({
        proveedor_id: "",
        reference: "",
        meters: "",
        price_per_meter: "",
        tiene_iva: false,
    });

    useEffect(() => {
        setRows(data);
    }, [data]);

    const handleConfirmAdd = async () => {
        if (!newRow.proveedor_id || !newRow.reference) return;

        const success = await onAdd({
            ...newRow,
            variant_id: variantId,
            meters: newRow.meters || "0",
            price_per_meter: newRow.price_per_meter || "0",
            tiene_iva: newRow.tiene_iva,
        });

        if (success) {
            setIsAdding(false);
            setNewRow({
                proveedor_id: "",
                reference: "",
                meters: "",
                price_per_meter: "",
                tiene_iva: false,
            });
        }
    };

    const calcTotal = (meters: string, price: string, iva: boolean) => {
        const base = Number(meters) * Number(price);
        return (iva ? base * 1.19 : base).toFixed(0);
    };

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-sm font-bold">Costos de tela</CardTitle>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={onCreateProveedor}>
                        <Plus className="h-3 w-3 mr-1" /> Proveedor
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
                        <Plus className="h-3 w-3 mr-1" /> Añadir tela
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-6 text-xs font-semibold text-muted-foreground border-b pb-2 mb-2">
                    <div>Proveedor</div>
                    <div>Referencia</div>
                    <div>Metros</div>
                    <div>$/metro</div>
                    <div>IVA</div>
                    <div>Total</div>
                </div>

                {rows.map((item) => (
                    <div key={item.id} className="grid grid-cols-6 gap-2 items-center border-b py-2 text-sm">
                        <div className="truncate">
                            {item.proveedor_nombre ||
                                proveedorNameById.get(item.proveedor_id) ||
                                "—"}
                        </div>
                        <div>{item.reference}</div>
                        <div>{item.meters}</div>
                        <div>${item.price_per_meter}</div>
                        <div>{item.tiene_iva ? "Sí" : "No"}</div>
                        <div className="font-bold">${Number(item.total).toFixed(0)}</div>
                    </div>
                ))}

                {isAdding && (
                    <div className="grid grid-cols-6 gap-2 items-center border-b py-2 text-sm bg-muted/30 rounded-lg mt-2 px-2">
                        <select
                            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                            value={newRow.proveedor_id}
                            onChange={(e) => setNewRow({ ...newRow, proveedor_id: e.target.value })}
                        >
                            <option value="">Proveedor</option>
                            {proveedores.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                        <Input
                            value={newRow.reference}
                            onChange={(e) => setNewRow({ ...newRow, reference: e.target.value })}
                            placeholder="REF-001"
                        />
                        <Input
                            value={newRow.meters}
                            onChange={(e) => setNewRow({ ...newRow, meters: e.target.value })}
                            placeholder="2.500"
                        />
                        <Input
                            value={newRow.price_per_meter}
                            onChange={(e) => setNewRow({ ...newRow, price_per_meter: e.target.value })}
                            placeholder="15000"
                        />
                        <Switch
                            checked={newRow.tiene_iva}
                            onCheckedChange={(val) => setNewRow({ ...newRow, tiene_iva: val })}
                        />
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-xs">
                                ${calcTotal(newRow.meters, newRow.price_per_meter, newRow.tiene_iva)}
                            </span>
                            <Button size="icon" variant="ghost" onClick={handleConfirmAdd}>
                                <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}>
                                <X className="h-4 w-4 text-gray-500" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
