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
import {
    fabricBodegaLabel,
    fabricBodegaShortLabel,
    type FabricBodegaFilter,
    type FabricBodegaKind,
} from "@/lib/tns-fabric-bodega";
import {
    formatFabricSelectionValue,
    parseFabricSelectionInput,
} from "@/services/tnsService";

type InventoryFabricRef = {
    reference: string;
    unit_cost: number;
    color?: string;
    code?: string;
    full_desc?: string;
    proveedor?: string;
    proveedoresList?: string[];
    stock?: number;
    bodega_cod?: string;
    bodega_desc?: string;
    bodega_kind?: FabricBodegaKind;
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
    bodega_kind?: string;
    proveedor_id?: string;
    reference?: string;
    meters?: string;
    price_per_meter?: string;
    general?: string;
};

const FABRIC_GRID =
    "grid grid-cols-[auto_minmax(0,0.95fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_64px_80px_48px_minmax(0,1fr)] gap-2";

const emptyRow = {
    bodega_kind: "" as FabricBodegaFilter | "",
    proveedor_id: "",
    reference: "",
    codigo: "",
    meters: "1",
    price_per_meter: "",
    tiene_iva: false,
    es_principal: false,
};

const matchesProveedorName = (ref: InventoryFabricRef, targetName: string): boolean => {
    const target = targetName.trim().toLowerCase();
    if (!target) return false;
    if (ref.proveedoresList && ref.proveedoresList.length > 0) {
        return ref.proveedoresList.some((p) => {
            const pLower = p.toLowerCase();
            return pLower === target || pLower.includes(target) || target.includes(pLower);
        });
    }
    if (ref.proveedor) {
        const pLower = ref.proveedor.toLowerCase();
        return pLower === target || pLower.includes(target) || target.includes(pLower);
    }
    return false;
};

const filterRefsByBodega = (
    refs: InventoryFabricRef[],
    bodegaKind: FabricBodegaFilter | ""
): InventoryFabricRef[] => {
    if (!bodegaKind || bodegaKind === "todas") return refs;
    return refs.filter((r) => r.bodega_kind === bodegaKind);
};

const scoreFabricMatch = (
    ref: InventoryFabricRef,
    codeHint: string,
    referenceHint: string
): number => {
    const code = (ref.code || "").trim().toLowerCase();
    const name = ref.reference.trim().toLowerCase();
    const full = (ref.full_desc || "").trim().toLowerCase();

    if (codeHint && code && code === codeHint) return 100;
    if (referenceHint && name && name === referenceHint) return 90;
    if (referenceHint && code && code === referenceHint) return 85;
    if (referenceHint && full && full === referenceHint) return 80;
    return 0;
};

const pickBestFabricMatch = (candidates: InventoryFabricRef[]): InventoryFabricRef | undefined => {
    if (!candidates.length) return undefined;
    if (candidates.length === 1) return candidates[0];

    return [...candidates].sort((a, b) => {
        const costDiff = (b.unit_cost || 0) - (a.unit_cost || 0);
        if (costDiff !== 0) return costDiff;
        return (b.stock || 0) - (a.stock || 0);
    })[0];
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

    useEffect(() => {
        setRows(data);
    }, [data]);

    // Proveedor seleccionado en la fila de creación
    const selectedProveedor = useMemo(() => {
        if (!newRow.proveedor_id) return null;
        return (
            proveedores.find(
                (p) => p.id === newRow.proveedor_id || p.name.toLowerCase() === newRow.proveedor_id.toLowerCase()
            ) || null
        );
    }, [newRow.proveedor_id, proveedores]);

    const refsInAllowedBodegas = useMemo(
        () => inventoryFabricRefs.filter((r) => r.bodega_kind),
        [inventoryFabricRefs]
    );

    const refsForBodegaFilter = useMemo(
        () => filterRefsByBodega(refsInAllowedBodegas, newRow.bodega_kind),
        [refsInAllowedBodegas, newRow.bodega_kind]
    );

    const proveedoresForBodega = useMemo(() => {
        const names = new Map<string, Proveedor>();
        refsForBodegaFilter.forEach((ref) => {
            const candidates = ref.proveedoresList?.length
                ? ref.proveedoresList
                : ref.proveedor
                  ? [ref.proveedor]
                  : [];
            candidates.forEach((rawName) => {
                const match = proveedores.find((p) => p.name.trim().toLowerCase() === rawName.trim().toLowerCase());
                if (match) names.set(match.id, match);
            });
        });
        return Array.from(names.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
    }, [refsForBodegaFilter, proveedores]);

    const proveedorBodegaHint = (provName: string): string => {
        const pool = filterRefsByBodega(
            refsInAllowedBodegas.filter((r) => matchesProveedorName(r, provName)),
            newRow.bodega_kind
        );
        const kinds = new Set(pool.map((r) => r.bodega_kind).filter(Boolean));
        if (kinds.size > 1) return "M.P. + Prod.";
        if (kinds.has("materia_prima")) return "M.P.";
        if (kinds.has("produccion")) return "Prod.";
        return "";
    };

    // Lista de telas filtradas según bodega y proveedor seleccionados
    const filteredInventoryRefs = useMemo(() => {
        let pool = refsForBodegaFilter;
        if (!selectedProveedor) return pool;
        return pool.filter((r) => matchesProveedorName(r, selectedProveedor.name));
    }, [refsForBodegaFilter, selectedProveedor]);

    const uniqueRefs = useMemo(
        () => [...new Set(filteredInventoryRefs.map((r) => r.reference).filter(Boolean))],
        [filteredInventoryRefs]
    );

    const findMaterialByReference = (
        reference: string,
        proveedorId?: string,
        bodegaKind?: FabricBodegaFilter | "",
        explicitCodigo?: string
    ): InventoryFabricRef | undefined => {
        const parsed = parseFabricSelectionInput(reference);
        const codeHint = (explicitCodigo || parsed.code || "").trim().toLowerCase();
        const referenceHint = (parsed.reference || reference).trim().toLowerCase();
        if (!codeHint && !referenceHint) return undefined;

        const prov = proveedorId
            ? proveedores.find((p) => p.id === proveedorId || p.name.toLowerCase() === proveedorId.toLowerCase())
            : selectedProveedor;

        let pool = filterRefsByBodega(refsInAllowedBodegas, bodegaKind ?? newRow.bodega_kind);

        if (prov) {
            pool = pool.filter((r) => matchesProveedorName(r, prov.name));
        }

        const exactMatches = pool.filter((r) => scoreFabricMatch(r, codeHint, referenceHint) > 0);
        if (exactMatches.length) {
            if (codeHint) {
                const byCode = exactMatches.filter(
                    (r) => (r.code || "").trim().toLowerCase() === codeHint
                );
                if (byCode.length) return pickBestFabricMatch(byCode);
            }
            return pickBestFabricMatch(exactMatches);
        }

        if (referenceHint.length >= 3) {
            const partialMatches = pool.filter((r) => {
                const code = (r.code || "").trim().toLowerCase();
                const name = r.reference.trim().toLowerCase();
                const full = (r.full_desc || "").trim().toLowerCase();
                return (
                    name.includes(referenceHint) ||
                    code.includes(referenceHint) ||
                    full.includes(referenceHint)
                );
            });
            if (partialMatches.length === 1) return partialMatches[0];
            if (codeHint) {
                const byCodePartial = partialMatches.filter((r) =>
                    (r.code || "").trim().toLowerCase().startsWith(codeHint)
                );
                if (byCodePartial.length === 1) return byCodePartial[0];
            }
        }

        return undefined;
    };

    const applyInventoryDefaults = (
        reference: string,
        proveedorId: string,
        current: typeof emptyRow,
        bodegaKind?: FabricBodegaFilter | ""
    ) => {
        const match = findMaterialByReference(
            reference,
            proveedorId,
            bodegaKind ?? current.bodega_kind,
            current.codigo
        );
        if (!match) {
            return {
                ...current,
                reference,
                proveedor_id: proveedorId,
                codigo: "",
                meters: current.meters || "1",
                price_per_meter: "",
            };
        }

        // Si el material tiene proveedor en TNS y no se ha seleccionado proveedor, buscar si coincide por nombre
        let matchedProvId = proveedorId;
        if (!matchedProvId && match.proveedor && proveedores.length > 0) {
            const foundP = proveedores.find(
                (p) => p.name.toLowerCase() === match.proveedor?.toLowerCase()
            );
            if (foundP) matchedProvId = foundP.id;
        }

        const selectionLabel = formatFabricSelectionValue(match.code || "", match.reference);

        return {
            ...current,
            bodega_kind: match.bodega_kind || current.bodega_kind,
            reference: selectionLabel,
            proveedor_id: matchedProvId,
            codigo: (match.code || "").trim(),
            meters: current.meters || "1",
            price_per_meter:
                match.unit_cost > 0 ? formatForInput(match.unit_cost) : "",
        };
    };

    const resolveRowCodigo = (item: FabricRecord) => {
        if (item.codigo?.trim()) return item.codigo.trim();
        const match = findMaterialByReference(item.reference, item.proveedor_id, "", item.codigo);
        return (match?.code || "").trim() || "—";
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

        if (!newRow.reference.trim()) nextErrors.reference = "Requerido";
        if (!newRow.meters.trim()) nextErrors.meters = "Requerido";
        if (!newRow.price_per_meter.trim()) nextErrors.price_per_meter = "Requerido";

        if (Object.keys(nextErrors).length) {
            nextErrors.general = "Debe llenar los campos de referencia, metro y precio";
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
            // Comprobamos que la referencia exista en el inventario TNS
            const match = findMaterialByReference(
                newRow.reference,
                newRow.proveedor_id,
                newRow.bodega_kind,
                newRow.codigo
            );
            if (!match) {
                nextErrors.reference = "La referencia no existe en el catálogo de telas TNS";
                nextErrors.general = "Debe coincidir con una tela del inventario";
            } else {
                const codeNorm = (newRow.codigo || match.code || "").trim().toLowerCase();
                const ambiguous = refsInAllowedBodegas.filter((r) => {
                    if (!selectedProveedor || matchesProveedorName(r, selectedProveedor.name)) {
                        if (codeNorm) {
                            return (r.code || "").trim().toLowerCase() === codeNorm;
                        }
                        return r.reference.trim().toLowerCase() === match.reference.trim().toLowerCase();
                    }
                    return false;
                });
                const bodegas = new Set(ambiguous.map((r) => r.bodega_kind).filter(Boolean));
                if (bodegas.size > 1 && !newRow.bodega_kind) {
                    nextErrors.bodega_kind = "Esta tela existe en M.P. y Producción";
                    nextErrors.general = "Seleccione la bodega de origen";
                } else if (!(match.code || newRow.codigo || "").trim()) {
                    nextErrors.reference = "La tela seleccionada no tiene código TNS";
                    nextErrors.general = "Seleccione una tela con código de inventario";
                }
            }
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleConfirmAdd = async () => {
        if (!validateNewRow()) return;

        setIsSaving(true);
        try {
            const match = findMaterialByReference(
                newRow.reference,
                newRow.proveedor_id,
                newRow.bodega_kind,
                newRow.codigo
            );
            let finalProveedorId = newRow.proveedor_id;

            // Si no se eligió proveedor a mano, autocompletarlo desde el material o usar fallback
            if (!finalProveedorId && match?.proveedor && proveedores.length > 0) {
                const foundP = proveedores.find(
                    (p) => p.name.toLowerCase() === match.proveedor?.toLowerCase()
                );
                if (foundP) finalProveedorId = foundP.id;
            }
            if (!finalProveedorId && proveedores.length > 0) {
                finalProveedorId = proveedores[0].id;
            }

            const success = await onAdd({
                proveedor_id: finalProveedorId,
                reference: match?.reference || parseFabricSelectionInput(newRow.reference).reference,
                codigo: (match?.code || newRow.codigo || "").trim(),
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
                    <CardTitle className="text-lg font-bold tracking-tight">Costos de tela</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Elige <strong>bodega</strong> (materia prima o producción),{" "}
                        <strong>proveedor</strong> y la <strong>referencia</strong> de inventario TNS. El{" "}
                        <strong>$/metro</strong> es el costo unitario con el que se creó/configuró la tela;{" "}
                        <strong>metro</strong> inicia en 1.
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
                    <div>Bodega</div>
                    <div>Proveedor</div>
                    <div>Referencia (inventario)</div>
                    <div>Código</div>
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
                        <div className="truncate min-w-0 text-xs text-muted-foreground">
                            {(() => {
                                const match = findMaterialByReference(item.reference, item.proveedor_id);
                                return match?.bodega_kind
                                    ? fabricBodegaShortLabel(match.bodega_kind)
                                    : "—";
                            })()}
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
                        <div className="truncate min-w-0 font-mono text-xs">{resolveRowCodigo(item)}</div>
                        <div>{formatDecimal(item.meters)}</div>
                        <div>${formatCurrency(item.price_per_meter)}</div>
                        <div>{item.tiene_iva ? "Sí" : "No"}</div>
                        <div className="flex items-center justify-between gap-1 min-w-0">
                            <span>${formatCurrency(item.total)}</span>
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
                                        "h-9 w-full rounded-md border bg-background px-2 text-xs font-medium",
                                        errors.bodega_kind
                                            ? "border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                                            : "border-input"
                                    )}
                                    value={newRow.bodega_kind}
                                    onChange={(e) => {
                                        const bodegaKind = e.target.value as FabricBodegaFilter | "";
                                        setNewRow((prev) => {
                                            const matchInNewBodega = findMaterialByReference(
                                                prev.reference,
                                                prev.proveedor_id,
                                                bodegaKind
                                            );
                                            if (!matchInNewBodega) {
                                                return {
                                                    ...prev,
                                                    bodega_kind: bodegaKind,
                                                    reference: "",
                                                    codigo: "",
                                                    price_per_meter: "",
                                                    proveedor_id: "",
                                                };
                                            }
                                            return applyInventoryDefaults(
                                                prev.reference,
                                                prev.proveedor_id,
                                                { ...prev, bodega_kind: bodegaKind },
                                                bodegaKind
                                            );
                                        });
                                        clearFieldError("bodega_kind");
                                        clearFieldError("reference");
                                        clearFieldError("proveedor_id");
                                    }}
                                >
                                    <option value="">Todas (M.P. + Prod.)</option>
                                    <option value="materia_prima">Materia prima</option>
                                    <option value="produccion">Producción</option>
                                </select>
                                {errors.bodega_kind ? (
                                    <p className="text-[11px] text-red-600 leading-tight">{errors.bodega_kind}</p>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground leading-tight">
                                        Solo telas de bodega M.P. o Producción
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <select
                                    className={cn(
                                        "h-9 w-full rounded-md border bg-background px-2 text-xs font-medium",
                                        errors.proveedor_id
                                            ? "border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                                            : "border-input"
                                    )}
                                    value={newRow.proveedor_id}
                                    onChange={(e) => {
                                        const proveedorId = e.target.value;
                                        setNewRow((prev) => {
                                            const matchInNewProv = findMaterialByReference(
                                                prev.reference,
                                                proveedorId,
                                                prev.bodega_kind
                                            );
                                            if (!matchInNewProv) {
                                                return {
                                                    ...prev,
                                                    proveedor_id: proveedorId,
                                                    reference: "",
                                                    codigo: "",
                                                    price_per_meter: "",
                                                };
                                            }
                                            return applyInventoryDefaults(prev.reference, proveedorId, {
                                                ...prev,
                                                proveedor_id: proveedorId,
                                            });
                                        });
                                        clearFieldError("proveedor_id");
                                        clearFieldError("reference");
                                        clearFieldError("price_per_meter");
                                    }}
                                >
                                    <option value="">
                                        Todos los proveedores ({proveedoresForBodega.length})
                                    </option>
                                    {proveedoresForBodega.map((p) => {
                                        const hint = proveedorBodegaHint(p.name);
                                        return (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                                {hint ? ` · ${hint}` : ""}
                                            </option>
                                        );
                                    })}
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
                                    placeholder={
                                        selectedProveedor
                                            ? `Telas de ${selectedProveedor.name}...`
                                            : newRow.bodega_kind && newRow.bodega_kind !== "todas"
                                              ? `Telas en ${fabricBodegaLabel(newRow.bodega_kind)}...`
                                              : "Referencia de tela..."
                                    }
                                    className={cn(
                                        errors.reference && "border-red-500 focus-visible:ring-red-500"
                                    )}
                                />
                                <datalist id="fabric-inventory-refs">
                                    {filteredInventoryRefs.map((r, i) => {
                                        const optionValue = formatFabricSelectionValue(
                                            r.code || "",
                                            r.reference
                                        );
                                        return (
                                            <option
                                                key={`${r.bodega_cod || r.bodega_kind}-${r.code || r.reference}-${i}`}
                                                value={optionValue}
                                            >
                                                {r.bodega_kind ? `[${fabricBodegaShortLabel(r.bodega_kind)}] ` : ""}
                                                {r.code ? `[${r.code}] ` : ""}
                                                {r.reference}
                                                {r.bodega_desc ? ` · ${r.bodega_desc}` : ""}
                                                {r.unit_cost > 0
                                                    ? ` (${formatCurrency(r.unit_cost)}/m)`
                                                    : " (sin costo TNS)"}
                                            </option>
                                        );
                                    })}
                                </datalist>
                                {errors.reference ? (
                                    <p className="text-[11px] text-red-600 leading-tight">{errors.reference}</p>
                                ) : selectedProveedor ? (
                                    <p className="text-[10px] text-muted-foreground leading-tight">
                                        {filteredInventoryRefs.length > 0
                                            ? `${filteredInventoryRefs.length} telas de ${selectedProveedor.name}${
                                                  newRow.bodega_kind && newRow.bodega_kind !== "todas"
                                                      ? ` en ${fabricBodegaLabel(newRow.bodega_kind)}`
                                                      : ""
                                              }`
                                            : `Sin telas de este proveedor en la bodega seleccionada`}
                                    </p>
                                ) : newRow.bodega_kind && newRow.bodega_kind !== "todas" ? (
                                    <p className="text-[10px] text-muted-foreground leading-tight">
                                        {filteredInventoryRefs.length > 0
                                            ? `${filteredInventoryRefs.length} telas en ${fabricBodegaLabel(newRow.bodega_kind)}`
                                            : `Sin telas en ${fabricBodegaLabel(newRow.bodega_kind)}`}
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground leading-tight">
                                        Elige bodega y proveedor para filtrar telas de M.P. o Producción.
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Input
                                    value={newRow.codigo}
                                    readOnly
                                    placeholder="Código TNS"
                                    className="bg-muted/60 cursor-default font-mono text-xs"
                                    title="Código exacto del producto en inventario TNS"
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
                                <span className="text-xs">
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
