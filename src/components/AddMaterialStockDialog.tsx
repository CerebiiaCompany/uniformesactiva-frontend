import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useMaterialSuppliers } from "@/hooks/useMaterialSuppliers";
import { useAddMaterialStock } from "@/hooks/useAddMaterialStock";
import { toast } from "sonner";

interface MaterialLike {
    id: string;
    name: string;
    unit: string;
    stock: number;
    color?: string;
    category?: string;
}

interface AddMaterialStockDialogProps {
    open: boolean;
    material: MaterialLike | null;
    onClose: () => void;
    onSuccess?: () => void;
}

function formatCurrency(value: number | string | undefined) {
    const num = typeof value === "string" ? parseFloat(value) : Number(value ?? 0);
    if (Number.isNaN(num)) return "0";
    return num.toLocaleString("es-CO", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

function formatStock(value: number | string | undefined) {
    const num = typeof value === "string" ? parseFloat(value) : Number(value ?? 0);
    if (Number.isNaN(num)) return "0.00";
    return num.toFixed(2);
}

export function AddMaterialStockDialog({
    open,
    material,
    onClose,
    onSuccess,
}: AddMaterialStockDialogProps) {
    const materialId = open && material ? material.id : null;
    const { data, isLoading } = useMaterialSuppliers(materialId);
    const { addStock, isPending } = useAddMaterialStock();

    const [offerId, setOfferId] = useState("");
    const [quantity, setQuantity] = useState("");
    const [unitCost, setUnitCost] = useState("");
    const [reference, setReference] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const offers = data?.offers ?? [];

    useEffect(() => {
        if (!open) {
            setOfferId("");
            setQuantity("");
            setUnitCost("");
            setReference("");
            setErrorMsg("");
            return;
        }
    }, [open, material?.id]);

    useEffect(() => {
        if (!open || !offers.length) return;
        if (offerId && offers.some((o) => o.id === offerId)) return;

        const first = offers[0];
        setOfferId(first.id);
        setUnitCost(String(first.unit_cost ?? ""));
        setReference((first.code || "").trim());
    }, [open, offers, offerId]);

    if (!open || !material) return null;

    const handleOfferChange = (id: string) => {
        setOfferId(id);
        const offer = offers.find((o) => o.id === id);
        if (!offer) return;
        setUnitCost(String(offer.unit_cost ?? ""));
        setReference((offer.code || "").trim());
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        if (!offerId) {
            setErrorMsg("Selecciona un proveedor.");
            return;
        }
        const qty = parseFloat(quantity);
        if (Number.isNaN(qty) || qty <= 0) {
            setErrorMsg("Ingresa una cantidad válida.");
            return;
        }
        const cost = parseFloat(unitCost);
        if (Number.isNaN(cost) || cost < 0) {
            setErrorMsg("Ingresa un costo unitario válido.");
            return;
        }

        try {
            await addStock({
                materialId: material.id,
                quantity: qty,
                reference: reference.trim(),
                supplier_offer_id: offerId,
                unit_cost: cost,
            });
            toast.success("Entrada de stock registrada");
            onSuccess?.();
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || "Error al registrar la entrada");
        }
    };

    const stockLabel = `${formatStock(material.stock)} ${material.unit || ""}`.trim();

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card text-card-foreground border rounded-lg shadow-lg w-full max-w-md p-6 relative">
                <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                        <h3 className="text-lg font-semibold">Añadir stock · {material.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {[material.category, material.color].filter(Boolean).join(" · ") || material.name}
                            {" — "}
                            Stock actual: {stockLabel}
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

                {isLoading ? (
                    <div className="py-10 flex justify-center text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : offers.length === 0 ? (
                    <div className="py-6 text-sm text-muted-foreground">
                        Este material no tiene proveedores configurados. Ábrelos desde la columna
                        Proveedores y añade al menos uno.
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                Proveedor
                            </label>
                            <select
                                required
                                className="w-full border rounded px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-red-600"
                                value={offerId}
                                onChange={(e) => handleOfferChange(e.target.value)}
                            >
                                {offers.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.supplier_name} (${formatCurrency(o.unit_cost)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                    Cantidad a ingresar
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    required
                                    placeholder="Ej. 50"
                                    className="w-full border rounded px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-red-600"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                    Costo unitario
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    className="w-full border rounded px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-red-600"
                                    value={unitCost}
                                    onChange={(e) => setUnitCost(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">
                                Referencia (opcional)
                            </label>
                            <input
                                type="text"
                                maxLength={255}
                                placeholder="Ej. OC-123, Factura 456..."
                                className="w-full border rounded px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-red-600"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                            />
                            <p className="mt-1 text-[10px] text-muted-foreground">
                                Se precarga con el código del proveedor; puedes cambiarla por factura u OC.
                            </p>
                        </div>

                        {errorMsg && (
                            <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded">
                                {errorMsg}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isPending}
                                className="px-4 py-2 border rounded text-sm hover:bg-accent transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isPending}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-sm transition-colors disabled:opacity-55"
                            >
                                {isPending ? "Registrando..." : "Registrar entrada"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
