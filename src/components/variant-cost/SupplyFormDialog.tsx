import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, X, Check, Loader2 } from "lucide-react";
import { formatCurrency, formatForInput } from "@/lib/format-number";
import { normalizeDecimalInput } from "@/lib/decimal-input";
import { cn } from "@/lib/utils";
import type { Size } from "@/types/variant";
import { fabricBodegaShortLabel } from "@/lib/tns-fabric-bodega";
import { formatFabricSelectionValue } from "@/services/tnsService";

export interface InventorySupplyRef {
    code: string;
    reference: string;
    full_desc: string;
    categoria: "Accesorios" | "Insumos";
    unit_cost: number;
    unidad: string;
    color?: string;
    stock?: number;
    bodega_cod?: string;
    bodega_desc?: string;
    bodega_kind?: "materia_prima" | "produccion";
}

export interface SupplyFormSubmitData {
    tipo_categoria: "Accesorios" | "Insumos";
    reference: string;
    code?: string;
    talla_id: string;
    quantity: string;
    unit_price: string;
    full_desc?: string;
}

interface SupplyFormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: SupplyFormSubmitData) => Promise<boolean>;
    initialData?: any;
    inventorySupplyRefs: InventorySupplyRef[];
    sizes: Size[];
    defaultTallaId?: string;
    isEditing?: boolean;
}

export function SupplyFormDialog({
    isOpen,
    onClose,
    onSubmit,
    initialData,
    inventorySupplyRefs,
    sizes,
    defaultTallaId,
    isEditing = false,
}: SupplyFormDialogProps) {
    const [selectedRef, setSelectedRef] = useState<InventorySupplyRef | null>(null);
    const [referenceInput, setReferenceInput] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
    const [tallaId, setTallaId] = useState<string>(defaultTallaId || "");
    const [quantity, setQuantity] = useState<string>("1");
    const [unitPrice, setUnitPrice] = useState<string>("");
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const dropdownRef = useRef<HTMLDivElement>(null);

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Inicializar o resetear datos del formulario al abrir
    useEffect(() => {
        if (isOpen) {
            setErrorMsg(null);
            setIsSaving(false);
            setIsDropdownOpen(false);

            if (initialData) {
                // Modo Edición
                const refText = initialData.tipo_label || initialData.name || initialData.reference || initialData.tipo || "";
                setReferenceInput(refText);
                setSearchQuery(refText);
                setTallaId(initialData.talla_id || "");
                setQuantity(initialData.quantity ? formatForInput(initialData.quantity) : "1");
                setUnitPrice(initialData.unit_price ? formatForInput(initialData.unit_price) : "");

                const matched = inventorySupplyRefs.find(
                    (r) =>
                        r.code === initialData.code ||
                        r.reference.toLowerCase() === refText.toLowerCase()
                );
                setSelectedRef(matched || null);
            } else {
                // Modo Creación: por defecto "Todas las tallas (compartido)" (tallaId vacío)
                setSelectedRef(null);
                setReferenceInput("");
                setSearchQuery("");
                setTallaId("");
                setQuantity("1");
                setUnitPrice("");
            }
        }
    }, [isOpen, initialData, inventorySupplyRefs]);

    // Referencias de insumos de TNS (con y sin stock)
    const categoryRefs = useMemo(() => {
        return inventorySupplyRefs;
    }, [inventorySupplyRefs]);

    // Resultados de búsqueda filtrados por código o nombre
    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return categoryRefs.slice(0, 40);
        return categoryRefs.filter(
            (r) =>
                r.code.toLowerCase().includes(q) ||
                r.reference.toLowerCase().includes(q) ||
                r.full_desc.toLowerCase().includes(q)
        ).slice(0, 40);
    }, [categoryRefs, searchQuery]);

    // Al seleccionar una referencia de TNS de la lista
    const handleSelectReference = (item: InventorySupplyRef) => {
        setSelectedRef(item);
        const label = formatFabricSelectionValue(item.code || "", item.reference || item.full_desc);
        setReferenceInput(label);
        setSearchQuery(label);
        setIsDropdownOpen(false);
        if (item.unit_cost && item.unit_cost > 0) {
            setUnitPrice(formatForInput(item.unit_cost));
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const refName = referenceInput.trim() || searchQuery.trim();
        if (!refName) {
            setErrorMsg("Debes seleccionar o ingresar una referencia.");
            return;
        }

        const normQty = normalizeDecimalInput(quantity);
        if (!normQty || Number(normQty) <= 0) {
            setErrorMsg("Ingresa una cantidad válida.");
            return;
        }

        const normPrice = normalizeDecimalInput(unitPrice);
        if (!normPrice || Number(normPrice) < 0) {
            setErrorMsg("Ingresa un precio unitario válido.");
            return;
        }

        setIsSaving(true);
        setErrorMsg(null);

        try {
            const ok = await onSubmit({
                tipo_categoria: "Insumos",
                reference: selectedRef?.reference || refName,
                code: selectedRef?.code,
                talla_id: tallaId,
                quantity: normQty,
                unit_price: normPrice,
                full_desc: selectedRef?.full_desc,
            });

            if (ok) {
                onClose();
            }
        } catch (err: any) {
            setErrorMsg(err?.message || "Ocurrió un error al guardar el insumo.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[460px] p-6">
                <DialogHeader className="pb-2 border-b">
                    <DialogTitle className="text-base font-bold text-foreground">
                        {isEditing ? "Editar insumo" : "Nuevo insumo"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
                    {errorMsg && (
                        <div className="p-2.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
                            {errorMsg}
                        </div>
                    )}

                    {/* Selecciona la referencia (Buscador y Select con filtro dinámico por código o nombre) */}
                    <div className="space-y-1.5 relative" ref={dropdownRef}>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="referencia_input" className="text-xs font-semibold text-foreground">
                                Selecciona la referencia
                            </Label>
                            <span className="text-[10px] text-muted-foreground">
                                {categoryRefs.length} disponibles en inventario TNS
                            </span>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                id="referencia_input"
                                type="text"
                                placeholder="Buscar código o nombre del insumo en TNS..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setReferenceInput(e.target.value);
                                    setSelectedRef(null);
                                    setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                className="pl-8 pr-7 text-xs h-9 bg-background"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setReferenceInput("");
                                        setSelectedRef(null);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Menú desplegable flotante con los resultados filtrados */}
                        {isDropdownOpen && (
                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-56 overflow-y-auto p-1 text-xs">
                                {searchResults.length === 0 ? (
                                    <div className="py-3 px-2 text-center text-muted-foreground text-[11px]">
                                        No se encontraron insumos que coincidan.
                                    </div>
                                ) : (
                                    searchResults.map((item, idx) => {
                                        const isSelected =
                                            selectedRef?.code === item.code ||
                                            referenceInput ===
                                                formatFabricSelectionValue(
                                                    item.code || "",
                                                    item.reference || item.full_desc
                                                );
                                        return (
                                            <div
                                                key={`supply-${item.code || "nocode"}-${item.reference || "noref"}-${idx}`}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => handleSelectReference(item)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault();
                                                        handleSelectReference(item);
                                                    }
                                                }}
                                                className={cn(
                                                    "px-2.5 py-1.5 rounded cursor-pointer transition-colors flex items-center justify-between gap-2 hover:bg-accent hover:text-accent-foreground",
                                                    isSelected && "bg-accent/60 font-semibold"
                                                )}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {(item.bodega_kind || item.bodega_desc) && (
                                                            <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">
                                                                {item.bodega_kind
                                                                    ? fabricBodegaShortLabel(item.bodega_kind)
                                                                    : item.bodega_desc}
                                                            </span>
                                                        )}
                                                        <span className="font-mono text-[11px] text-muted-foreground font-bold shrink-0">
                                                            {item.code}
                                                        </span>
                                                        <span className="truncate text-foreground font-medium">
                                                            {item.reference}
                                                        </span>
                                                    </div>
                                                    {item.full_desc && item.full_desc !== item.reference && (
                                                        <div className="text-[10px] text-muted-foreground truncate">
                                                            {item.full_desc}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="text-right shrink-0">
                                                    {item.unit_cost > 0 ? (
                                                        <div className="text-xs font-semibold text-foreground font-mono">
                                                            ${formatCurrency(Math.round(item.unit_cost))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] text-muted-foreground italic">
                                                            Sin costo
                                                        </div>
                                                    )}
                                                    <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                                                        <span>/ {item.unidad || "UND"}</span>
                                                        {item.stock !== undefined && (
                                                            <span
                                                                className={cn(
                                                                    "px-1 py-0.2 rounded text-[9px] font-medium leading-none",
                                                                    item.stock > 0
                                                                        ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/50"
                                                                        : "text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/50"
                                                                )}
                                                            >
                                                                {item.stock > 0 ? `${item.stock.toLocaleString("es-CO")} disp.` : "0 stock"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* 3. Alcance por talla */}
                    <div className="space-y-1.5">
                        <Label htmlFor="alcance_talla" className="text-xs font-semibold text-foreground">
                            Alcance por talla
                        </Label>
                        <Select
                            value={tallaId || "__ALL__"}
                            onValueChange={(val) => setTallaId(val === "__ALL__" ? "" : val)}
                        >
                            <SelectTrigger id="alcance_talla" className="w-full text-xs h-9 bg-background">
                                <SelectValue placeholder="Todas las tallas (compartido)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__ALL__" className="text-xs">
                                    Todas las tallas (compartido)
                                </SelectItem>
                                {sizes.map((s) => (
                                    <SelectItem key={s.id} value={s.id} className="text-xs">
                                        {s.label || s.name || s.code || s.id} (solo esta talla)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 4. Cantidad */}
                    <div className="space-y-1.5">
                        <Label htmlFor="cantidad_input" className="text-xs font-semibold text-foreground">
                            Cantidad
                        </Label>
                        <Input
                            id="cantidad_input"
                            type="text"
                            inputMode="decimal"
                            placeholder="8"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value.replace(/[^\d.,]/g, ""))}
                            className="text-xs h-9 bg-background tabular-nums"
                            required
                        />
                    </div>

                    {/* 5. Precio unitario */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="precio_unitario" className="text-xs font-semibold text-foreground">
                                Precio unitario {selectedRef?.unidad ? `(${selectedRef.unidad})` : ""}
                            </Label>
                            {selectedRef?.unit_cost && selectedRef.unit_cost > 0 ? (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium font-mono">
                                    Costo TNS: ${formatCurrency(Math.round(selectedRef.unit_cost))}
                                </span>
                            ) : null}
                        </div>
                        <Input
                            id="precio_unitario"
                            type="text"
                            inputMode="decimal"
                            placeholder="Ej. 3500 o 12,50"
                            value={unitPrice}
                            onChange={(e) => setUnitPrice(e.target.value.replace(/[^\d.,]/g, ""))}
                            className="text-xs h-9 bg-background tabular-nums font-mono font-medium"
                            required
                        />
                    </div>

                    <DialogFooter className="pt-3 border-t flex flex-row items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSaving}
                            className="text-xs h-9 px-4"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving}
                            className="text-xs h-9 px-5 bg-red-600 hover:bg-red-700 text-white font-semibold"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                    Guardando...
                                </>
                            ) : (
                                "Guardar"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
