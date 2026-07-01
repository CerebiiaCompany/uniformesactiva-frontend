import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import type { FabricRecord, Proveedor } from "@/types/variant";
import { normalizeDecimalInput, parseDecimalInput } from "@/lib/decimal-input";
import { formatCurrency, formatDecimal } from "@/lib/format-number";

interface FabricTableProps {
    data: FabricRecord[];
    variantId: string;
    proveedores: Proveedor[];
    onAdd: (payload: any) => Promise<boolean>;
    onEdit: (fabric: FabricRecord) => void;
    onDelete: (id: string) => void;
    onSetPrincipal: (id: string) => Promise<boolean>;
    onCreateProveedor: () => void;
    isSettingPrincipal?: boolean;
}

export function FabricCostsTable({
    data,
    variantId,
    proveedores,
    onAdd,
    onEdit,
    onDelete,
    onSetPrincipal,
    onCreateProveedor,
    isSettingPrincipal = false,
}: FabricTableProps) {
    const proveedorNameById = new Map(proveedores.map((p) => [p.id, p.name]));
    const [rows, setRows] = useState<FabricRecord[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [settingId, setSettingId] = useState<string | null>(null);
    const [newRow, setNewRow] = useState({
        proveedor_id: "",
        reference: "",
        meters: "",
        price_per_meter: "",
        tiene_iva: false,
        es_principal: false,
    });

    useEffect(() => {
        setRows(data);
    }, [data]);

    const handleConfirmAdd = async () => {
        if (!newRow.proveedor_id || !newRow.reference) return;

        const success = await onAdd({
            ...newRow,
            variant_id: variantId,
            meters: normalizeDecimalInput(newRow.meters),
            price_per_meter: normalizeDecimalInput(newRow.price_per_meter),
            tiene_iva: newRow.tiene_iva,
            es_principal: newRow.es_principal,
        });

        if (success) {
            setIsAdding(false);
            setNewRow({
                proveedor_id: "",
                reference: "",
                meters: "",
                price_per_meter: "",
                tiene_iva: false,
                es_principal: false,
            });
        }
    };

    const handleSetPrincipal = async (id: string) => {
        const item = rows.find((r) => r.id === id);
        if (!item || item.es_principal) return;

        setSettingId(id);
        try {
            await onSetPrincipal(id);
        } finally {
            setSettingId(null);
        }
    };

    const calcTotal = (meters: string, price: string, iva: boolean) => {
        const base = parseDecimalInput(meters) * parseDecimalInput(price);
        return iva ? base * 1.19 : base;
    };

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <div>
                    <CardTitle className="text-sm font-bold">Costos de tela</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Marca una tela como principal para calcular el costo base en el resumen.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={onCreateProveedor}>
                        <Plus className="h-3 w-3 mr-1" /> Proveedor
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
                        <Plus className="h-3 w-3 mr-1" /> Añadir tela
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-[auto_1fr_1fr_72px_80px_48px_1fr] gap-2 text-xs font-semibold text-muted-foreground border-b pb-2 mb-2">
                    <div className="w-8 text-center" title="Usar para costeo">★</div>
                    <div>Proveedor</div>
                    <div>Referencia</div>
                    <div>Metros</div>
                    <div>$/metro</div>
                    <div>IVA</div>
                    <div>Total</div>
                </div>

                {rows.map((item) => (
                    <div
                        key={item.id}
                        className={`grid grid-cols-[auto_1fr_1fr_72px_80px_48px_1fr] gap-2 items-center border-b py-2 text-sm ${
                            item.es_principal ? "bg-primary/5" : ""
                        }`}
                    >
                        <div className="w-8 flex justify-center">
                            <button
                                type="button"
                                title="Usar esta tela para el costeo"
                                disabled={isSettingPrincipal || settingId === item.id}
                                onClick={() => handleSetPrincipal(item.id)}
                                className="rounded-full p-0.5 hover:bg-muted disabled:opacity-50"
                            >
                                {settingId === item.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : (
                                    <span
                                        className={`text-base leading-none ${
                                            item.es_principal ? "text-primary" : "text-muted-foreground/40"
                                        }`}
                                    >
                                        {item.es_principal ? "★" : "☆"}
                                    </span>
                                )}
                            </button>
                        </div>
                        <div className="truncate min-w-0">
                            {item.proveedor_nombre || proveedorNameById.get(item.proveedor_id) || "—"}
                            {item.es_principal && (
                                <span className="ml-1 text-[10px] font-semibold text-primary">Principal</span>
                            )}
                        </div>
                        <div className="truncate min-w-0">{item.reference}</div>
                        <div>{formatDecimal(item.meters)}</div>
                        <div>${formatCurrency(item.price_per_meter)}</div>
                        <div>{item.tiene_iva ? "Sí" : "No"}</div>
                        <div className="flex items-center justify-between gap-1 min-w-0">
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

                {rows.length === 0 && !isAdding && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                        Sin costos de tela configurados
                    </div>
                )}

                {isAdding && (
                    <div className="space-y-3 border rounded-lg mt-2 p-3 bg-muted/30">
                        <div className="grid grid-cols-[auto_1fr_1fr_72px_80px_48px_1fr] gap-2 items-center text-sm">
                            <div className="w-8" />
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
                                placeholder="2,500"
                                inputMode="decimal"
                            />
                            <Input
                                value={newRow.price_per_meter}
                                onChange={(e) => setNewRow({ ...newRow, price_per_meter: e.target.value })}
                                placeholder="5000,00"
                                inputMode="decimal"
                            />
                            <Switch
                                checked={newRow.tiene_iva}
                                onCheckedChange={(val) => setNewRow({ ...newRow, tiene_iva: val })}
                            />
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-xs">
                                    ${formatCurrency(calcTotal(newRow.meters, newRow.price_per_meter, newRow.tiene_iva))}
                                </span>
                                <Button size="icon" variant="ghost" onClick={handleConfirmAdd}>
                                    <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}>
                                    <X className="h-4 w-4 text-gray-500" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="new-fabric-principal"
                                checked={newRow.es_principal}
                                onCheckedChange={(val) => setNewRow({ ...newRow, es_principal: val })}
                            />
                            <Label htmlFor="new-fabric-principal" className="text-xs cursor-pointer">
                                Usar esta tela para el costeo (principal)
                            </Label>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
