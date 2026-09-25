import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Plus,
    Pencil,
    Trash2,
    Check,
    X,
    Loader2,
    Package,
    Tag,
    Building2,
} from "lucide-react";
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
    parseFabricSelectionInput,
} from "@/services/tnsService";

export type InventoryFabricRef = {
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
    onUpdate?: (id: string, payload: any) => Promise<boolean>;
    onEdit?: (fabric: FabricRecord) => void;
    onDelete: (id: string) => void;
    onSetPrincipal: (id: string) => Promise<boolean>;
    isSettingPrincipal?: boolean;
}

type FabricFormErrors = {
    bodega_kind?: string;
    proveedor_id?: string;
    reference?: string;
    descripcion?: string;
    meters?: string;
    price_per_meter?: string;
    general?: string;
};

const FABRIC_GRID =
    "grid grid-cols-[auto_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_56px_76px_44px_minmax(0,0.9fr)] gap-2";

const emptyRow = {
    bodega_kind: "" as FabricBodegaFilter | "",
    proveedor_id: "",
    reference: "",
    descripcion: "",
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
    onUpdate,
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

    // Modal de descripción al seleccionar tela TNS en creación
    const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
    const [pendingFabricForModal, setPendingFabricForModal] = useState<InventoryFabricRef | null>(null);
    const [fabricDescriptionInput, setFabricDescriptionInput] = useState("");
    const [descriptionModalError, setDescriptionModalError] = useState<string | null>(null);

    // Dropdown buscador de telas TNS en creación
    const [searchQuery, setSearchQuery] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Modal de Edición Completa de Tela (referencia TNS + descripción + proveedor + consumo + precio)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FabricRecord | null>(null);
    const [editForm, setEditForm] = useState({
        reference: "",
        descripcion: "",
        codigo: "",
        proveedor_id: "",
        meters: "1",
        price_per_meter: "",
        tiene_iva: false,
        bodega_kind: "" as FabricBodegaFilter | "",
    });
    const [editSearchQuery, setEditSearchQuery] = useState("");
    const [isEditDropdownOpen, setIsEditDropdownOpen] = useState(false);
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const editDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setRows(data);
    }, [data]);

    // Cerrar dropdowns al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (editDropdownRef.current && !editDropdownRef.current.contains(e.target as Node)) {
                setIsEditDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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

    // Resultados de búsqueda en el selector dropdown de creación
    const searchDropdownResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return filteredInventoryRefs.slice(0, 50);
        return filteredInventoryRefs
            .filter((r) => {
                const code = (r.code || "").toLowerCase();
                const refName = (r.reference || "").toLowerCase();
                const fullDesc = (r.full_desc || "").toLowerCase();
                const prov = (r.proveedor || "").toLowerCase();
                return code.includes(q) || refName.includes(q) || fullDesc.includes(q) || prov.includes(q);
            })
            .slice(0, 50);
    }, [filteredInventoryRefs, searchQuery]);

    // Resultados de búsqueda en el modal de edición
    const editSearchDropdownResults = useMemo(() => {
        const q = editSearchQuery.trim().toLowerCase();
        let pool = refsInAllowedBodegas;
        if (editForm.bodega_kind && editForm.bodega_kind !== "todas") {
            pool = filterRefsByBodega(pool, editForm.bodega_kind);
        }
        if (editForm.proveedor_id) {
            const provName = proveedorNameById.get(editForm.proveedor_id);
            if (provName) pool = pool.filter((r) => matchesProveedorName(r, provName));
        }
        if (!q) return pool.slice(0, 40);
        return pool
            .filter((r) => {
                const code = (r.code || "").toLowerCase();
                const refName = (r.reference || "").toLowerCase();
                const fullDesc = (r.full_desc || "").toLowerCase();
                const prov = (r.proveedor || "").toLowerCase();
                return code.includes(q) || refName.includes(q) || fullDesc.includes(q) || prov.includes(q);
            })
            .slice(0, 40);
    }, [refsInAllowedBodegas, editForm.bodega_kind, editForm.proveedor_id, editSearchQuery, proveedorNameById]);

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

    // Abre el modal para pedir la descripción cuando se selecciona una tela de TNS
    const handleSelectFabricFromTNS = (fabricItem: InventoryFabricRef) => {
        setPendingFabricForModal(fabricItem);
        // Pre-llenar descripción con la descripción actual si existe, o dejar lista para escribir
        setFabricDescriptionInput(newRow.descripcion || "");
        setDescriptionModalError(null);
        setIsDescriptionModalOpen(true);
        setIsDropdownOpen(false);
    };

    // Confirma la descripción en el modal de creación y actualiza los campos
    const handleConfirmFabricDescription = () => {
        if (!pendingFabricForModal) return;

        const fabric = pendingFabricForModal;
        const trimmedDesc = fabricDescriptionInput.trim();

        // Si el material tiene proveedor en TNS y no se ha seleccionado proveedor, autocompletar
        let matchedProvId = newRow.proveedor_id;
        if (!matchedProvId && fabric.proveedor && proveedores.length > 0) {
            const foundP = proveedores.find(
                (p) => p.name.toLowerCase() === fabric.proveedor?.toLowerCase()
            );
            if (foundP) matchedProvId = foundP.id;
        }

        setNewRow((prev) => ({
            ...prev,
            bodega_kind: fabric.bodega_kind || prev.bodega_kind,
            reference: (fabric.reference || fabric.full_desc || "").trim(),
            descripcion: trimmedDesc,
            codigo: (fabric.code || "").trim(),
            proveedor_id: matchedProvId,
            price_per_meter: fabric.unit_cost > 0 ? formatForInput(fabric.unit_cost) : prev.price_per_meter,
            meters: prev.meters || "1",
        }));

        setSearchQuery(fabric.reference || fabric.full_desc || "");
        clearFieldError("reference");
        clearFieldError("descripcion");
        clearFieldError("bodega_kind");
        clearFieldError("proveedor_id");
        clearFieldError("price_per_meter");
        clearFieldError("meters");

        setIsDescriptionModalOpen(false);
        setPendingFabricForModal(null);
    };

    // Inicia la edición de un costo de tela existente
    const handleStartEdit = (item: FabricRecord) => {
        if (onUpdate) {
            const match = findMaterialByReference(item.reference, item.proveedor_id, "", item.codigo);
            setEditingItem(item);
            setEditForm({
                reference: item.reference || "",
                descripcion: item.descripcion || "",
                codigo: item.codigo || match?.code || "",
                proveedor_id: item.proveedor_id || "",
                meters: formatForInput(item.meters) || "1",
                price_per_meter: formatForInput(item.price_per_meter) || "",
                tiene_iva: Boolean(item.tiene_iva),
                bodega_kind: match?.bodega_kind || "",
            });
            setEditSearchQuery(item.reference || (match ? (match.reference || match.full_desc || "") : ""));
            setEditErrors({});
            setIsEditModalOpen(true);
        } else if (onEdit) {
            onEdit(item);
        }
    };

    // Selecciona una tela TNS dentro del modal de edición
    const handleSelectFabricInEdit = (fabric: InventoryFabricRef) => {
        let matchedProvId = editForm.proveedor_id;
        if (!matchedProvId && fabric.proveedor && proveedores.length > 0) {
            const foundP = proveedores.find(
                (p) => p.name.toLowerCase() === fabric.proveedor?.toLowerCase()
            );
            if (foundP) matchedProvId = foundP.id;
        }

        setEditForm((prev) => ({
            ...prev,
            reference: (fabric.reference || fabric.full_desc || "").trim(),
            codigo: (fabric.code || "").trim(),
            bodega_kind: fabric.bodega_kind || prev.bodega_kind,
            proveedor_id: matchedProvId || prev.proveedor_id,
            price_per_meter: fabric.unit_cost > 0 ? formatForInput(fabric.unit_cost) : prev.price_per_meter,
        }));
        setEditSearchQuery(fabric.reference || fabric.full_desc || "");
        setIsEditDropdownOpen(false);
    };

    // Guarda los cambios del modal de edición
    const handleSaveEdit = async () => {
        if (!editingItem || !onUpdate) return;

        const nextErrors: Record<string, string> = {};
        if (!editForm.reference.trim()) nextErrors.reference = "La referencia de tela TNS es requerida";
        const metersNum = parseDecimalInput(editForm.meters);
        const priceNum = parseDecimalInput(editForm.price_per_meter);
        if (metersNum <= 0) nextErrors.meters = "Debe ser mayor a 0";
        if (priceNum <= 0) nextErrors.price_per_meter = "Debe ser mayor a 0";

        if (Object.keys(nextErrors).length > 0) {
            setEditErrors(nextErrors);
            return;
        }

        setIsSavingEdit(true);
        try {
            const payload: Record<string, string | boolean> = {
                reference: editForm.reference.trim(),
                descripcion: editForm.descripcion.trim(),
                codigo: editForm.codigo.trim(),
                proveedor_id: editForm.proveedor_id,
                meters: normalizeDecimalInput(editForm.meters),
                price_per_meter: normalizeDecimalInput(editForm.price_per_meter),
                tiene_iva: editForm.tiene_iva,
            };

            const success = await onUpdate(editingItem.id, payload);
            if (success) {
                setIsEditModalOpen(false);
                setEditingItem(null);
            }
        } finally {
            setIsSavingEdit(false);
        }
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
            // Comprobamos que la referencia/código coincida con una tela TNS
            const match = findMaterialByReference(
                newRow.reference,
                newRow.proveedor_id,
                newRow.bodega_kind,
                newRow.codigo
            );
            if (!match && !newRow.codigo) {
                nextErrors.reference = "Debe seleccionar una tela del inventario TNS";
                nextErrors.general = "Debe coincidir con una tela del inventario";
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
                reference: newRow.reference.trim() || match?.reference || "",
                descripcion: newRow.descripcion.trim(),
                codigo: (newRow.codigo || match?.code || "").trim(),
                variant_id: variantId,
                meters: normalizeDecimalInput(newRow.meters),
                price_per_meter: normalizeDecimalInput(newRow.price_per_meter),
                tiene_iva: newRow.tiene_iva,
                es_principal: newRow.es_principal,
            });

            if (success) {
                setIsAdding(false);
                setNewRow(emptyRow);
                setSearchQuery("");
                setErrors({});
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelAdd = () => {
        setIsAdding(false);
        setNewRow(emptyRow);
        setSearchQuery("");
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
                        Elige <strong>bodega</strong>, <strong>proveedor</strong> y la <strong>referencia</strong> de inventario TNS con su <strong>descripción</strong> personalizada. El{" "}
                        <strong>$/metro</strong> es el costo unitario con el que se configuró la tela;{" "}
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
                            setSearchQuery("");
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
                    <div>Descripción</div>
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
                                const match = findMaterialByReference(item.reference, item.proveedor_id, "", item.codigo);
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
                        <div className="truncate min-w-0" title={item.reference}>
                            {item.reference || "—"}
                        </div>
                        <div className="truncate min-w-0 font-medium text-foreground" title={item.descripcion || ""}>
                            {item.descripcion ? (
                                item.descripcion
                            ) : (
                                <span className="text-muted-foreground/50 italic text-xs">Sin descripción</span>
                            )}
                        </div>
                        <div className="truncate min-w-0 font-mono text-xs">{resolveRowCodigo(item)}</div>
                        <div>{formatDecimal(item.meters)}</div>
                        <div>${formatCurrency(item.price_per_meter)}</div>
                        <div>{item.tiene_iva ? "Sí" : "No"}</div>
                        <div className="flex items-center justify-between gap-1 min-w-0">
                            <span>${formatCurrency(item.total)}</span>
                            <div className="flex gap-1 shrink-0">
                                <Pencil
                                    className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-primary"
                                    onClick={() => handleStartEdit(item)}
                                    title="Editar información de tela y descripción"
                                />
                                <Trash2
                                    className="h-4 w-4 cursor-pointer text-red-500 hover:text-red-700"
                                    onClick={() => onDelete(item.id)}
                                    title="Eliminar tela"
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
                            {/* Selector de Bodega */}
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
                                        setNewRow((prev) => ({
                                            ...prev,
                                            bodega_kind: bodegaKind,
                                        }));
                                        clearFieldError("bodega_kind");
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
                                        Bodega M.P. o Prod.
                                    </p>
                                )}
                            </div>

                            {/* Selector de Proveedor */}
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
                                        setNewRow((prev) => ({
                                            ...prev,
                                            proveedor_id: proveedorId,
                                        }));
                                        clearFieldError("proveedor_id");
                                    }}
                                >
                                    <option value="">
                                        Todos ({proveedoresForBodega.length})
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

                            {/* Selector de Referencia TNS */}
                            <div className="space-y-1 relative" ref={dropdownRef}>
                                <Input
                                    value={newRow.reference || searchQuery}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSearchQuery(val);
                                        setNewRow((prev) => ({
                                            ...prev,
                                            reference: val,
                                        }));
                                        setIsDropdownOpen(true);
                                        clearFieldError("reference");
                                    }}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    placeholder={
                                        selectedProveedor
                                            ? `Buscar tela ${selectedProveedor.name}...`
                                            : "Seleccionar tela TNS..."
                                    }
                                    className={cn(
                                        "text-xs",
                                        errors.reference && "border-red-500 focus-visible:ring-red-500"
                                    )}
                                />

                                {/* Dropdown flotante con las telas disponibles */}
                                {isDropdownOpen && (
                                    <div className="absolute left-0 top-full mt-1 w-[380px] max-h-60 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg z-50 text-xs">
                                        <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground border-b flex justify-between items-center">
                                            <span>Telas TNS ({searchDropdownResults.length})</span>
                                            <span className="text-[10px]">Clic para definir descripción</span>
                                        </div>
                                        {searchDropdownResults.length === 0 ? (
                                            <div className="p-3 text-center text-muted-foreground text-xs">
                                                No se encontraron telas con los filtros actuales
                                            </div>
                                        ) : (
                                            searchDropdownResults.map((r, i) => (
                                                <button
                                                    key={`${r.bodega_cod || r.bodega_kind}-${r.code || r.reference}-${i}`}
                                                    type="button"
                                                    onClick={() => handleSelectFabricFromTNS(r)}
                                                    className="w-full text-left p-2 rounded hover:bg-muted/80 transition-colors flex flex-col gap-0.5 border-b last:border-0"
                                                >
                                                    <div className="flex items-center justify-between gap-1 font-medium">
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            {r.bodega_kind && (
                                                                <span className="px-1 py-0.2 rounded text-[10px] bg-primary/10 text-primary font-bold">
                                                                    {fabricBodegaShortLabel(r.bodega_kind)}
                                                                </span>
                                                            )}
                                                            {r.code && (
                                                                <span className="font-mono text-muted-foreground text-[11px]">
                                                                    [{r.code}]
                                                                </span>
                                                            )}
                                                            <span className="truncate">{r.reference}</span>
                                                        </div>
                                                        <span className="shrink-0 text-emerald-600 font-semibold">
                                                            {r.unit_cost > 0
                                                                ? `$${formatCurrency(r.unit_cost)}`
                                                                : "Sin costo"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                        <span className="truncate">
                                                            {r.proveedor || r.bodega_desc || "TNS"}
                                                        </span>
                                                        {r.stock !== undefined && (
                                                            <span>Stock: {formatDecimal(r.stock)} m</span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}

                                {errors.reference ? (
                                    <p className="text-[11px] text-red-600 leading-tight">{errors.reference}</p>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground leading-tight">
                                        Referencia exacta TNS
                                    </p>
                                )}
                            </div>

                            {/* Campo de Descripción personalizada en la fila */}
                            <div className="space-y-1">
                                <Input
                                    value={newRow.descripcion}
                                    onChange={(e) => {
                                        setNewRow({ ...newRow, descripcion: e.target.value });
                                        clearFieldError("descripcion");
                                    }}
                                    placeholder="Ej. Tela blanca suave..."
                                    className="text-xs"
                                    title="Descripción personalizada para esta variante"
                                />
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                    Descripción propia
                                </p>
                            </div>

                            {/* Código TNS */}
                            <div className="space-y-1">
                                <Input
                                    value={newRow.codigo}
                                    readOnly
                                    placeholder="Código"
                                    className="bg-muted/60 cursor-default font-mono text-xs"
                                    title="Código exacto TNS"
                                />
                            </div>

                            {/* Metros */}
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

                            {/* Precio por metro */}
                            <div className="space-y-1">
                                <Input
                                    value={newRow.price_per_meter}
                                    onChange={(e) => {
                                        setNewRow({ ...newRow, price_per_meter: e.target.value });
                                        clearFieldError("price_per_meter");
                                    }}
                                    placeholder="Costo"
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

                            {/* IVA */}
                            <div className="pt-2">
                                <Switch
                                    checked={newRow.tiene_iva}
                                    onCheckedChange={(val) => setNewRow({ ...newRow, tiene_iva: val })}
                                />
                            </div>

                            {/* Total y Acciones */}
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

            {/* Modal para ingresar la descripción al seleccionar la tela TNS en creación */}
            <Dialog
                open={isDescriptionModalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsDescriptionModalOpen(false);
                        setPendingFabricForModal(null);
                        setDescriptionModalError(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Tag className="h-4 w-4 text-primary" />
                            Descripción de la tela
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Define la descripción personalizada con la que se identificará esta tela en la prenda/variante.
                        </DialogDescription>
                    </DialogHeader>

                    {pendingFabricForModal && (
                        <div className="space-y-4 py-2">
                            {/* Tarjeta con los datos de la tela TNS seleccionada */}
                            <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                            Referencia TNS (Inventario)
                                        </span>
                                        <div className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                                            <Package className="h-3.5 w-3.5 text-primary" />
                                            {pendingFabricForModal.reference || pendingFabricForModal.full_desc}
                                        </div>
                                    </div>
                                    {pendingFabricForModal.bodega_kind && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                                            {fabricBodegaLabel(pendingFabricForModal.bodega_kind)}
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-muted-foreground text-[11px] pt-2 border-t">
                                    <div className="flex items-center gap-1">
                                        <span className="font-medium text-foreground">Código TNS:</span>
                                        <span className="font-mono">{pendingFabricForModal.code || "—"}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="font-medium text-foreground">Costo sugerido:</span>
                                        <span className="font-semibold text-emerald-600">
                                            ${formatCurrency(pendingFabricForModal.unit_cost)} / m
                                        </span>
                                    </div>
                                    {pendingFabricForModal.proveedor && (
                                        <div className="col-span-2 flex items-center gap-1 truncate">
                                            <Building2 className="h-3 w-3 shrink-0" />
                                            <span className="font-medium text-foreground">Proveedor:</span>
                                            <span className="truncate">{pendingFabricForModal.proveedor}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Campo para ingresar la descripción de la tela */}
                            <div className="space-y-1.5">
                                <Label htmlFor="fabric-description-input" className="text-xs font-semibold">
                                    Descripción personalizada de la tela
                                </Label>
                                <Input
                                    id="fabric-description-input"
                                    value={fabricDescriptionInput}
                                    onChange={(e) => {
                                        setFabricDescriptionInput(e.target.value);
                                        if (descriptionModalError) setDescriptionModalError(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleConfirmFabricDescription();
                                        }
                                    }}
                                    placeholder="Ej. Tela blanca suave para camisa, Forro, Bolsillos..."
                                    className="text-xs"
                                    autoFocus
                                />
                                {descriptionModalError ? (
                                    <p className="text-[11px] text-red-600 font-medium">{descriptionModalError}</p>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground">
                                        Esta descripción se mostrará en una columna separada a la referencia de inventario.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setIsDescriptionModalOpen(false);
                                setPendingFabricForModal(null);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleConfirmFabricDescription}
                        >
                            Confirmar descripción
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Edición Completa de Tela y Descripción */}
            <Dialog
                open={isEditModalOpen}
                onOpenChange={(open) => {
                    if (!open && !isSavingEdit) {
                        setIsEditModalOpen(false);
                        setEditingItem(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Pencil className="h-4 w-4 text-primary" />
                            Editar costo de tela
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Modifica la referencia de inventario TNS, descripción personalizada, proveedor, metros o precio.
                        </DialogDescription>
                    </DialogHeader>

                    {editingItem && (
                        <div className="space-y-4 py-2">
                            {/* Referencia de inventario TNS */}
                            <div className="space-y-1.5 relative" ref={editDropdownRef}>
                                <Label className="text-xs font-semibold flex items-center justify-between">
                                    <span>Referencia de inventario TNS <span className="text-red-500">*</span></span>
                                    {editForm.codigo && (
                                        <span className="font-mono text-[11px] font-normal text-muted-foreground">
                                            Código: {editForm.codigo}
                                        </span>
                                    )}
                                </Label>
                                <div className="relative">
                                    <Input
                                        value={editForm.reference || editSearchQuery}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setEditSearchQuery(val);
                                            setEditForm((prev) => ({ ...prev, reference: val }));
                                            setIsEditDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsEditDropdownOpen(true)}
                                        placeholder="Buscar por código o nombre en catálogo TNS..."
                                        className={cn("text-xs", editErrors.reference && "border-red-500")}
                                    />
                                </div>

                                {isEditDropdownOpen && (
                                    <div className="absolute left-0 top-full mt-1 w-full max-h-52 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg z-50 text-xs">
                                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-b">
                                            Telas en TNS ({editSearchDropdownResults.length})
                                        </div>
                                        {editSearchDropdownResults.length === 0 ? (
                                            <div className="p-3 text-center text-muted-foreground text-xs">
                                                No se encontraron telas coincidentes
                                            </div>
                                        ) : (
                                            editSearchDropdownResults.map((r, i) => (
                                                <button
                                                    key={`${r.bodega_cod || r.bodega_kind}-${r.code || r.reference}-${i}`}
                                                    type="button"
                                                    onClick={() => handleSelectFabricInEdit(r)}
                                                    className="w-full text-left p-2 rounded hover:bg-muted/80 transition-colors flex flex-col gap-0.5 border-b last:border-0"
                                                >
                                                    <div className="flex items-center justify-between gap-1 font-medium">
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            {r.bodega_kind && (
                                                                <span className="px-1 py-0.2 rounded text-[10px] bg-primary/10 text-primary font-bold">
                                                                    {fabricBodegaShortLabel(r.bodega_kind)}
                                                                </span>
                                                            )}
                                                            {r.code && (
                                                                <span className="font-mono text-muted-foreground text-[11px]">
                                                                    [{r.code}]
                                                                </span>
                                                            )}
                                                            <span className="truncate">{r.reference}</span>
                                                        </div>
                                                        <span className="shrink-0 text-emerald-600 font-semibold">
                                                            {r.unit_cost > 0
                                                                ? `$${formatCurrency(r.unit_cost)}`
                                                                : "Sin costo"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                        <span className="truncate">
                                                            {r.proveedor || r.bodega_desc || "TNS"}
                                                        </span>
                                                        {r.stock !== undefined && (
                                                            <span>Stock: {formatDecimal(r.stock)} m</span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                                {editErrors.reference && (
                                    <p className="text-[10px] text-red-600">{editErrors.reference}</p>
                                )}
                            </div>

                            {/* Campo de Descripción Personalizada (Separado de Referencia) */}
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-fabric-description" className="text-xs font-semibold">
                                    Descripción personalizada de la tela
                                </Label>
                                <Input
                                    id="edit-fabric-description"
                                    value={editForm.descripcion}
                                    onChange={(e) => {
                                        setEditForm({ ...editForm, descripcion: e.target.value });
                                    }}
                                    placeholder="Ej. tela blanca suave para camisa, tela blanca estrés..."
                                    className="text-xs"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Descripción o detalle propio con el que identificas esta tela en la prenda.
                                </p>
                            </div>

                            {/* Proveedor */}
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-fabric-proveedor" className="text-xs font-semibold">
                                    Proveedor
                                </Label>
                                <select
                                    id="edit-fabric-proveedor"
                                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-medium"
                                    value={editForm.proveedor_id}
                                    onChange={(e) => setEditForm({ ...editForm, proveedor_id: e.target.value })}
                                >
                                    <option value="">Seleccionar proveedor...</option>
                                    {proveedores.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Metros, $/metro e IVA */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="edit-fabric-meters" className="text-xs font-semibold">
                                        Metros (consumo)
                                    </Label>
                                    <Input
                                        id="edit-fabric-meters"
                                        value={editForm.meters}
                                        onChange={(e) => setEditForm({ ...editForm, meters: e.target.value })}
                                        inputMode="decimal"
                                        className={cn("text-xs", editErrors.meters && "border-red-500")}
                                        placeholder="1"
                                    />
                                    {editErrors.meters && (
                                        <p className="text-[10px] text-red-600">{editErrors.meters}</p>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="edit-fabric-price" className="text-xs font-semibold">
                                        $/metro (costo)
                                    </Label>
                                    <Input
                                        id="edit-fabric-price"
                                        value={editForm.price_per_meter}
                                        onChange={(e) => setEditForm({ ...editForm, price_per_meter: e.target.value })}
                                        inputMode="decimal"
                                        className={cn("text-xs", editErrors.price_per_meter && "border-red-500")}
                                        placeholder="0"
                                    />
                                    {editErrors.price_per_meter && (
                                        <p className="text-[10px] text-red-600">{editErrors.price_per_meter}</p>
                                    )}
                                </div>

                                <div className="space-y-1 flex flex-col justify-center pt-2">
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            id="edit-fabric-iva"
                                            checked={editForm.tiene_iva}
                                            onCheckedChange={(val) => setEditForm({ ...editForm, tiene_iva: val })}
                                        />
                                        <Label htmlFor="edit-fabric-iva" className="text-xs cursor-pointer">
                                            Aplica IVA
                                        </Label>
                                    </div>
                                </div>
                            </div>

                            {/* Previsualización del total */}
                            <div className="p-2.5 rounded-md bg-muted/50 flex justify-between items-center text-xs">
                                <span className="text-muted-foreground font-medium">Total estimado de tela:</span>
                                <span className="text-sm font-bold text-foreground">
                                    ${formatCurrency(calcTotal(editForm.meters, editForm.price_per_meter, editForm.tiene_iva))}
                                </span>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isSavingEdit}
                            onClick={() => {
                                setIsEditModalOpen(false);
                                setEditingItem(null);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={isSavingEdit}
                            onClick={handleSaveEdit}
                        >
                            {isSavingEdit ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Guardando...
                                </>
                            ) : (
                                "Guardar cambios"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
