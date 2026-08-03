import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import type { FabricRecord, Proveedor } from "@/types/variant";
import { normalizeDecimalInput, parseDecimalInput } from "@/lib/decimal-input";
import { formatCurrency, formatDecimal, formatForInput } from "@/lib/format-number";
import { cn } from "@/lib/utils";

type InventoryFabricRef = {
    reference: string;
    unit_cost: number;
    color?: string;
};

interface FabricTableProps {
    data: FabricRecord[];
    variantId: string;
    proveedores: Proveedor[];
    /** Ofertas por referencia+proveedor (precio real) y color del material */
    inventoryFabricRefs?: InventoryFabricRef[];
    onAdd: (payload: any) => Promise<boolean>;
    onEdit: (fabric: FabricRecord) => void;
    onDelete: (id: string) => void;
    onSetPrincipal: (id: string) => Promise<boolean>;
    isSettingPrincipal?: boolean;
}

type FabricFormErrors = {
    proveedor_id?: string;
    reference?: string;
    meters?: string;
    price_per_meter?: string;
    general?: string;
};

const FABRIC_GRID =
    "grid grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1.1fr)_88px_64px_80px_48px_minmax(0,1fr)] gap-2";

const emptyRow = {
    proveedor_id: "",
    reference: "",
    color: "",
    meters: "1",
    price_per_meter: "",
    tiene_iva: false,
    es_principal: false,
};

export function FabricCostsTable({
    data,
    variantId,
    proveedores,
    inventoryFabricRefs = [],
    onAdd,
    onEdit,
    onDelete,
    onSetPrincipal,
    isSettingPrincipal = false,
}: FabricTableProps) {
    const proveedorNameById = new Map(proveedores.map((p) => [p.id, p.name]));
    const [rows, setRows] = useState<FabricRecord[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [settingId, setSettingId] = useState<string | null>(null);
    const [newRow, setNewRow] = useState(emptyRow);
    const [errors, setErrors] = useState<FabricFormErrors>({});
    const [isSaving, setIsSaving] = useState(false);

    const uniqueRefs = useMemo(
        () => [...new Set(inventoryFabricRefs.map((r) => r.reference).filter(Boolean))],
        [inventoryFabricRefs]
    );

    useEffect(() => {
        setRows(data);
    }, [data]);

    const findMaterialByReference = (reference: string): InventoryFabricRef | undefined => {
        const ref = reference.trim().toLowerCase();
        if (!ref) return undefined;
        return inventoryFabricRefs.find((r) => r.reference.trim().toLowerCase() === ref);
    };

    const applyInventoryDefaults = (
        reference: string,
        proveedorId: string,
        current: typeof emptyRow
    ) => {
        const match = findMaterialByReference(reference);
        if (!match) {
            return {
                ...current,
                reference,
                proveedor_id: proveedorId,
                color: "",
                meters: current.meters || "1",
                price_per_meter: "",
            };
        }

        return {
            ...current,
            reference,
            proveedor_id: proveedorId,
            color: (match.color || "").trim(),
            meters: "1",
            // Siempre el costo unitario configurado al crear el material
            price_per_meter: formatForInput(match.unit_cost),
        };
    };

    const resolveRowColor = (item: FabricRecord) => {
        const match = findMaterialByReference(item.reference);
        return (match?.color || "").trim() || "—";
    };

    const clearFieldError = (field: keyof FabricFormErrors) => {
        setErrors((prev) => {
            if (!prev[field] && !prev.general) return prev;
            const next = { ...prev };
            delete next[field];
            delete next.general;
            return next;
        });
    };

    const validateNewRow = (): boolean => {
        const nextErrors: FabricFormErrors = {};

        if (!newRow.proveedor_id.trim()) {
            nextErrors.proveedor_id = "Debe seleccionar un proveedor";
        }
        if (!newRow.reference.trim()) nextErrors.reference = "Requerido";
        if (!newRow.meters.trim()) nextErrors.meters = "Requerido";
        if (!newRow.price_per_meter.trim()) nextErrors.price_per_meter = "Requerido";

        if (Object.keys(nextErrors).length) {
            nextErrors.general = "Debe llenar todos los campos";
        } else {
            const meters = parseDecimalInput(newRow.meters);
            const price = parseDecimalInput(newRow.price_per_meter);
            if (meters <= 0) {
                nextErrors.meters = "Debe ser mayor a 0";
                nextErrors.general = "Debe llenar todos los campos";
            }
            if (price <= 0) {
                nextErrors.price_per_meter = "Debe ser mayor a 0";
                nextErrors.general = "Debe llenar todos los campos";
            }
            if (!findMaterialByReference(newRow.reference)) {
                nextErrors.reference = "Debe coincidir con una tela del inventario";
                nextErrors.general = "La referencia no existe en inventario";
            }
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleConfirmAdd = async () => {
        if (!validateNewRow()) return;

        setIsSaving(true);
        try {
            const success = await onAdd({
                proveedor_id: newRow.proveedor_id,
                reference: newRow.reference,
                variant_id: variantId,
                meters: normalizeDecimalInput(newRow.meters),
                price_per_meter: normalizeDecimalInput(newRow.price_per_meter),
                tiene_iva: newRow.tiene_iva,
                es_principal: newRow.es_principal,
            });

            if (success) {
                setIsAdding(false);
                setNewRow(emptyRow);
                setErrors({});
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelAdd = () => {
        setIsAdding(false);
        setNewRow(emptyRow);
        setErrors({});
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
                        Elige <strong>proveedor</strong> (trazabilidad del pedido) y la{" "}
                        <strong>referencia</strong> de inventario. El <strong>$/metro</strong> es el
                        costo unitario con el que se creó/configuró la tela; <strong>metro</strong>{" "}
                        inicia en 1.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setIsAdding(true);
                            setNewRow({ ...emptyRow });
                            setErrors({});
                        }}
                    >
                        <Plus className="h-3 w-3 mr-1" /> Añadir tela
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className={`${FABRIC_GRID} text-xs font-semibold text-muted-foreground border-b pb-2 mb-2`}>
                    <div className="w-8 text-center" title="Usar para costeo">
                        ★
                    </div>
                    <div>Proveedor</div>
                    <div>Referencia (inventario)</div>
                    <div>Color</div>
                    <div>metro</div>
                    <div>$/metro</div>
                    <div>IVA</div>
                    <div>Total</div>
                </div>

                {rows.map((item) => (
                    <div
                        key={item.id}
                        className={`${FABRIC_GRID} items-center border-b py-2 text-sm ${
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
                            {item.proveedor_nombre ||
                                proveedorNameById.get(item.proveedor_id) ||
                                "—"}
                            {item.es_principal && (
                                <span className="ml-1 text-[10px] font-semibold text-primary">Principal</span>
                            )}
                        </div>
                        <div className="truncate min-w-0">{item.reference}</div>
                        <div className="truncate min-w-0 text-muted-foreground">{resolveRowColor(item)}</div>
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
                        <div className={`${FABRIC_GRID} items-start text-sm`}>
                            <div className="w-8" />
                            <div className="space-y-1">
                                <select
                                    className={cn(
                                        "h-9 w-full rounded-md border bg-background px-2 text-xs",
                                        errors.proveedor_id
                                            ? "border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                                            : "border-input"
                                    )}
                                    value={newRow.proveedor_id}
                                    onChange={(e) => {
                                        const proveedorId = e.target.value;
                                        setNewRow((prev) =>
                                            applyInventoryDefaults(prev.reference, proveedorId, {
                                                ...prev,
                                                proveedor_id: proveedorId,
                                            })
                                        );
                                        clearFieldError("proveedor_id");
                                        clearFieldError("price_per_meter");
                                    }}
                                >
                                    <option value="">Proveedor</option>
                                    {proveedores.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.proveedor_id && (
                                    <p className="text-[11px] text-red-600 leading-tight">
                                        {errors.proveedor_id}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Input
                                    list="fabric-inventory-refs"
                                    value={newRow.reference}
                                    onChange={(e) => {
                                        const reference = e.target.value;
                                        setNewRow((prev) =>
                                            applyInventoryDefaults(reference, prev.proveedor_id, {
                                                ...prev,
                                                reference,
                                            })
                                        );
                                        clearFieldError("reference");
                                        clearFieldError("price_per_meter");
                                        clearFieldError("meters");
                                    }}
                                    placeholder="Referencia exacta"
                                    className={cn(
                                        errors.reference && "border-red-500 focus-visible:ring-red-500"
                                    )}
                                />
                                <datalist id="fabric-inventory-refs">
                                    {uniqueRefs.map((ref) => (
                                        <option key={ref} value={ref} />
                                    ))}
                                </datalist>
                                {errors.reference ? (
                                    <p className="text-[11px] text-red-600 leading-tight">{errors.reference}</p>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground leading-tight">
                                        $/metro = costo unitario del material en inventario.
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Input
                                    value={newRow.color}
                                    readOnly
                                    placeholder="—"
                                    className="bg-muted/60 cursor-default"
                                />
                            </div>
                            <div className="space-y-1">
                                <Input
                                    value={newRow.meters}
                                    onChange={(e) => {
                                        setNewRow({ ...newRow, meters: e.target.value });
                                        clearFieldError("meters");
                                    }}
                                    placeholder="1"
                                    inputMode="decimal"
                                    className={cn(
                                        errors.meters && "border-red-500 focus-visible:ring-red-500"
                                    )}
                                />
                                {errors.meters && (
                                    <p className="text-[11px] text-red-600 leading-tight">{errors.meters}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Input
                                    value={newRow.price_per_meter}
                                    onChange={(e) => {
                                        setNewRow({ ...newRow, price_per_meter: e.target.value });
                                        clearFieldError("price_per_meter");
                                    }}
                                    placeholder="Desde inventario"
                                    inputMode="decimal"
                                    className={cn(
                                        errors.price_per_meter &&
                                            "border-red-500 focus-visible:ring-red-500"
                                    )}
                                />
                                {errors.price_per_meter && (
                                    <p className="text-[11px] text-red-600 leading-tight">
                                        {errors.price_per_meter}
                                    </p>
                                )}
                            </div>
                            <div className="pt-2">
                                <Switch
                                    checked={newRow.tiene_iva}
                                    onCheckedChange={(val) => setNewRow({ ...newRow, tiene_iva: val })}
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <span className="font-bold text-xs">
                                    $
                                    {formatCurrency(
                                        calcTotal(newRow.meters, newRow.price_per_meter, newRow.tiene_iva)
                                    )}
                                </span>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={handleConfirmAdd}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    ) : (
                                        <Check className="h-4 w-4 text-green-600" />
                                    )}
                                </Button>
                                <Button size="icon" variant="ghost" onClick={handleCancelAdd} disabled={isSaving}>
                                    <X className="h-4 w-4 text-gray-500" />
                                </Button>
                            </div>
                        </div>

                        {errors.general && (
                            <p className="text-xs text-red-600 font-medium">{errors.general}</p>
                        )}

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
