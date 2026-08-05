import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ProveedorCombobox } from "@/components/ProveedorCombobox";
import {
    useMaterialSuppliers,
    type MaterialSupplierOffer,
} from "@/hooks/useMaterialSuppliers";
import { useCreateProveedor } from "@/hooks/useCreateProveedor";
import { formatUnitCost } from "@/lib/format-number";
import { cn } from "@/lib/utils";

type ProveedorOption = { id: string; name: string };

interface MaterialSuppliersDialogProps {
    open: boolean;
    materialId: string | null;
    materialName?: string;
    onClose: () => void;
    proveedores: ProveedorOption[];
    onProveedoresChange?: () => void | Promise<unknown>;
}

const emptyForm = {
    supplier_name: "",
    unit_cost: "",
    code: "",
};

function formatDate(value: string | null) {
    if (!value) return "—";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export function MaterialSuppliersDialog({
    open,
    materialId,
    materialName,
    onClose,
    proveedores,
    onProveedoresChange,
}: MaterialSuppliersDialogProps) {
    const {
        data,
        isLoading,
        createOffer,
        updateOffer,
        deleteOffer,
        isCreating,
        isUpdating,
        isDeleting,
    } = useMaterialSuppliers(open ? materialId : null);
    const { createProveedor, isLoading: isCreatingProveedor } = useCreateProveedor();

    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState("");
    const [editing, setEditing] = useState<MaterialSupplierOffer | null>(null);
    const [editForm, setEditForm] = useState(emptyForm);
    const [editError, setEditError] = useState("");

    const sortedProveedores = useMemo(
        () => [...proveedores].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })),
        [proveedores]
    );

    const ensureProveedorInCatalog = async (name: string): Promise<string> => {
        const trimmed = name.trim();
        if (!trimmed) {
            throw new Error("Selecciona o escribe el nombre del proveedor.");
        }

        const exists = sortedProveedores.some(
            (p) => p.name.toLocaleLowerCase("es") === trimmed.toLocaleLowerCase("es")
        );
        if (exists) {
            return (
                sortedProveedores.find(
                    (p) => p.name.toLocaleLowerCase("es") === trimmed.toLocaleLowerCase("es")
                )?.name ?? trimmed
            );
        }

        const result = await createProveedor(trimmed);
        if (!result.success) {
            throw new Error(result.error || "No se pudo crear el proveedor en el catálogo.");
        }
        await onProveedoresChange?.();
        toast.success(`Proveedor «${result.data?.name || trimmed}» creado`);
        return result.data?.name?.trim() || trimmed;
    };

    useEffect(() => {
        if (!open) {
            setForm(emptyForm);
            setFormError("");
            setEditing(null);
            setEditError("");
        }
    }, [open]);

    if (!open || !materialId) return null;

    const titleName = data?.material.name || materialName || "Material";
    const maxCost = data?.reference_unit_cost_max ?? data?.material.unit_cost ?? 0;
    const bestCost = data?.best_unit_cost;

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError("");
        if (!form.supplier_name.trim()) {
            setFormError("Selecciona o escribe el nombre del proveedor.");
            return;
        }
        const cost = parseFloat(form.unit_cost);
        if (Number.isNaN(cost) || cost < 0) {
            setFormError("Ingresa un costo unitario válido.");
            return;
        }
        try {
            const supplierName = await ensureProveedorInCatalog(form.supplier_name);
            await createOffer({
                supplier_name: supplierName,
                unit_cost: cost,
                code: form.code.trim() || undefined,
            });
            toast.success("Proveedor añadido al material");
            setForm(emptyForm);
        } catch (err: any) {
            setFormError(err.message || "No se pudo añadir el proveedor");
        }
    };

    const handleStartEdit = (offer: MaterialSupplierOffer) => {
        setEditing(offer);
        setEditForm({
            supplier_name: offer.supplier_name,
            unit_cost: String(offer.unit_cost ?? ""),
            code: offer.code || "",
        });
        setEditError("");
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        setEditError("");
        if (!editForm.supplier_name.trim()) {
            setEditError("El nombre es obligatorio.");
            return;
        }
        const cost = parseFloat(editForm.unit_cost);
        if (Number.isNaN(cost) || cost < 0) {
            setEditError("Ingresa un costo unitario válido.");
            return;
        }
        try {
            const supplierName = await ensureProveedorInCatalog(editForm.supplier_name);
            await updateOffer({
                offerId: editing.id,
                payload: {
                    supplier_name: supplierName,
                    unit_cost: cost,
                    code: editForm.code.trim(),
                },
            });
            toast.success("Oferta actualizada");
            setEditing(null);
        } catch (err: any) {
            setEditError(err.message || "No se pudo actualizar");
        }
    };

    const handleDelete = async (offer: MaterialSupplierOffer) => {
        if (!confirm(`¿Eliminar la oferta de "${offer.supplier_name}"?`)) return;
        try {
            await deleteOffer(offer.id);
            toast.success("Oferta eliminada");
            if (editing?.id === offer.id) setEditing(null);
        } catch (err: any) {
            toast.error(err.message || "No se pudo eliminar");
        }
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card text-card-foreground border rounded-lg shadow-lg w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                        <h3 className="text-lg font-semibold">
                            Proveedores · {titleName}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {data?.material.category ? `${data.material.category} — ` : ""}
                            Costo unitario de referencia (mayor): ${formatUnitCost(maxCost)}
                            {bestCost != null && (
                                <span className="ml-2 text-emerald-700">
                                    · Mejor: ${formatUnitCost(bestCost)}
                                </span>
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-muted rounded-md transition-colors shrink-0"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-4 border rounded-md overflow-hidden">
                    <div className="grid grid-cols-[1.3fr_0.8fr_0.7fr_0.9fr_72px] gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/40 border-b">
                        <div>Proveedor</div>
                        <div>Código</div>
                        <div>Costo</div>
                        <div>Última compra</div>
                        <div className="text-right">Acciones</div>
                    </div>

                    {isLoading ? (
                        <div className="p-8 flex justify-center text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : !data?.offers?.length ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                            Aún no hay proveedores para comparar. Añade el primero abajo.
                        </div>
                    ) : (
                        data.offers.map((offer) => {
                            const isBest =
                                Number(offer.unit_cost) === Number(data.best_unit_cost) &&
                                data.offers.length > 1;
                            return (
                                <div
                                    key={offer.id}
                                    className={cn(
                                        "grid grid-cols-[1.3fr_0.8fr_0.7fr_0.9fr_72px] gap-2 px-3 py-2.5 text-sm items-center border-b last:border-b-0",
                                        isBest && "bg-emerald-50/80"
                                    )}
                                >
                                    <div className="truncate font-medium">
                                        {offer.supplier_name}
                                        {isBest && (
                                            <span className="ml-1.5 text-[10px] font-semibold text-emerald-700">
                                                Mejor precio
                                            </span>
                                        )}
                                    </div>
                                    <div className="truncate text-muted-foreground">
                                        {offer.code?.trim() ? offer.code : "—"}
                                    </div>
                                    <div className="font-semibold">${formatUnitCost(offer.unit_cost)}</div>
                                    <div className="text-muted-foreground text-xs">
                                        {formatDate(offer.last_purchase_at)}
                                    </div>
                                    <div className="flex justify-end gap-1">
                                        <button
                                            type="button"
                                            title="Editar"
                                            onClick={() => handleStartEdit(offer)}
                                            className="p-1 rounded hover:bg-muted"
                                        >
                                            <Pencil className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                        <button
                                            type="button"
                                            title="Eliminar"
                                            disabled={isDeleting}
                                            onClick={() => handleDelete(offer)}
                                            className="p-1 rounded hover:bg-muted"
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {editing && (
                    <form
                        onSubmit={handleSaveEdit}
                        className="mt-4 border rounded-md p-3 space-y-3 bg-muted/20"
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">Editar oferta</p>
                            <button
                                type="button"
                                className="text-xs text-muted-foreground hover:underline"
                                onClick={() => setEditing(null)}
                            >
                                Cancelar
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                    Nombre
                                </label>
                                <ProveedorCombobox
                                    value={editForm.supplier_name}
                                    proveedores={sortedProveedores}
                                    onChange={(name) =>
                                        setEditForm((prev) => ({ ...prev, supplier_name: name }))
                                    }
                                    placeholder="Proveedor"
                                    allowCreate
                                    onCreateNew={ensureProveedorInCatalog}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                    Costo
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    className="w-full border rounded px-3 py-2 text-sm bg-background"
                                    value={editForm.unit_cost}
                                    onChange={(e) =>
                                        setEditForm((prev) => ({ ...prev, unit_cost: e.target.value }))
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                    Código (opcional)
                                </label>
                                <input
                                    type="text"
                                    maxLength={100}
                                    placeholder="Ej. TB-OX-01"
                                    className="w-full border rounded px-3 py-2 text-sm bg-background"
                                    value={editForm.code}
                                    onChange={(e) =>
                                        setEditForm((prev) => ({ ...prev, code: e.target.value }))
                                    }
                                />
                            </div>
                        </div>
                        {editError && (
                            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                                {editError}
                            </p>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isUpdating || isCreatingProveedor}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded disabled:opacity-55"
                            >
                                {isUpdating || isCreatingProveedor ? "Guardando..." : "Guardar cambios"}
                            </button>
                        </div>
                    </form>
                )}

                <form onSubmit={handleCreate} className="mt-5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                Nombre
                            </label>
                            <ProveedorCombobox
                                value={form.supplier_name}
                                proveedores={sortedProveedores}
                                onChange={(name) => setForm((prev) => ({ ...prev, supplier_name: name }))}
                                placeholder="Proveedor"
                                allowCreate
                                onCreateNew={ensureProveedorInCatalog}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                Costo
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                placeholder="0"
                                className="w-full border rounded px-3 py-2 text-sm bg-background"
                                value={form.unit_cost}
                                onChange={(e) => setForm((prev) => ({ ...prev, unit_cost: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                Código (opcional)
                            </label>
                            <input
                                type="text"
                                maxLength={100}
                                placeholder="Ej. TB-OX-01"
                                className="w-full border rounded px-3 py-2 text-sm bg-background"
                                value={form.code}
                                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                            />
                        </div>
                    </div>

                    {formError && (
                        <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{formError}</p>
                    )}

                    <div className="flex justify-end pt-1">
                        <button
                            type="submit"
                            disabled={isCreating || isCreatingProveedor}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded disabled:opacity-55"
                        >
                            {isCreating || isCreatingProveedor ? "Añadiendo..." : "Añadir proveedor"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
