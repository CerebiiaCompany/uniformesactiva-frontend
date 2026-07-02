import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Package, Ruler } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { fetchVariantCostSummary } from "@/hooks/useGetCostSummary";
import type { ProductLine } from "@/hooks/useGetProductLines";
import type { LineProduct } from "@/hooks/useGetLineProducts";
import type { VariantSizeCostSummary } from "@/types/variant";
import { formatCurrency } from "@/lib/format-number";

interface VariantOption {
    id: string;
    name: string;
    code?: string;
    attributes?: { color?: string; material?: string; talla?: string };
}

export interface OrderProductEntry {
    key: string;
    line_id: string;
    line_label: string;
    producto_id: string;
    producto_label: string;
    variant_id: string;
    variant_label: string;
    color: string;
    estampado: string;
    comentario: string;
    unit_cost: number;
    size_lines: {
        talla_id: string;
        talla_nombre: string;
        cantidad: number;
        costo_unitario: number;
    }[];
}

interface AddOrderProductDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lines: ProductLine[];
    loadingLines: boolean;
    lockedProductId?: string;
    onAdd: (entry: OrderProductEntry) => void;
}

const ESTAMPADO_OPTIONS = ["Sin estampado", "Bordado", "Serigrafía", "Transfer", "Sublimado"];

const formatMoney = (value: number) => formatCurrency(value);

export function AddOrderProductDialog({
    open,
    onOpenChange,
    lines,
    loadingLines,
    lockedProductId,
    onAdd,
}: AddOrderProductDialogProps) {
    const [selectedLineId, setSelectedLineId] = useState("");
    const [products, setProducts] = useState<LineProduct[]>([]);
    const [variants, setVariants] = useState<VariantOption[]>([]);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [selectedVariantId, setSelectedVariantId] = useState("");
    const [selectedColor, setSelectedColor] = useState("");
    const [selectedEstampado, setSelectedEstampado] = useState("Sin estampado");
    const [unitCostRaw, setUnitCostRaw] = useState("");
    const [comentario, setComentario] = useState("");
    const [sizeQuantities, setSizeQuantities] = useState<Record<string, string>>({});
    const [availableSizes, setAvailableSizes] = useState<VariantSizeCostSummary[]>([]);

    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingVariants, setLoadingVariants] = useState(false);
    const [loadingSummary, setLoadingSummary] = useState(false);

    const resetForm = () => {
        setSelectedLineId("");
        setProducts([]);
        setVariants([]);
        setSelectedProductId("");
        setSelectedVariantId("");
        setSelectedColor("");
        setSelectedEstampado("Sin estampado");
        setUnitCostRaw("");
        setComentario("");
        setSizeQuantities({});
        setAvailableSizes([]);
    };

    useEffect(() => {
        if (!open) {
            resetForm();
            return;
        }
        if (lockedProductId && lines.length) {
            const loadLockedProduct = async () => {
                for (const line of lines) {
                    try {
                        const lineProducts = await http<LineProduct[]>(endpoints.lineas.productos(line.id));
                        const match = lineProducts.find((p) => p.id === lockedProductId);
                        if (match) {
                            setSelectedLineId(line.id);
                            setProducts(lineProducts);
                            setSelectedProductId(match.id);
                            break;
                        }
                    } catch {
                        /* try next line */
                    }
                }
            };
            loadLockedProduct();
        }
    }, [open, lockedProductId, lines]);

    useEffect(() => {
        if (!open || !selectedLineId) {
            if (!lockedProductId) {
                setProducts([]);
                setSelectedProductId("");
            }
            return;
        }

        const loadProducts = async () => {
            setLoadingProducts(true);
            try {
                const data = await http<LineProduct[]>(endpoints.lineas.productos(selectedLineId));
                setProducts(data || []);
                if (!lockedProductId) setSelectedProductId("");
            } catch {
                toast.error("No se pudieron cargar los productos de la línea.");
                setProducts([]);
            } finally {
                setLoadingProducts(false);
            }
        };

        loadProducts();
    }, [open, selectedLineId, lockedProductId]);

    useEffect(() => {
        if (!open || !selectedProductId) {
            setVariants([]);
            setSelectedVariantId("");
            return;
        }

        const loadVariants = async () => {
            setLoadingVariants(true);
            try {
                const data = await http<VariantOption[]>(endpoints.productos.variantes(selectedProductId));
                setVariants(data || []);
                setSelectedVariantId("");
            } catch {
                toast.error("No se pudieron cargar las variantes.");
                setVariants([]);
            } finally {
                setLoadingVariants(false);
            }
        };

        loadVariants();
    }, [open, selectedProductId]);

    useEffect(() => {
        if (!open || !selectedVariantId) {
            setAvailableSizes([]);
            setSizeQuantities({});
            setUnitCostRaw("");
            return;
        }

        const loadSummary = async () => {
            setLoadingSummary(true);
            try {
                const summary = await fetchVariantCostSummary(selectedVariantId);
                const sizes = summary.sizes ?? [];
                setAvailableSizes(sizes);
                setSizeQuantities(Object.fromEntries(sizes.map((s) => [s.talla_id, ""])));

                if (sizes.length > 0) {
                    const avg =
                        sizes.reduce((acc, s) => acc + Number(s.overall_total), 0) / sizes.length;
                    setUnitCostRaw(String(Math.round(avg)));
                } else if (summary.overall_total) {
                    setUnitCostRaw(String(Math.round(Number(summary.overall_total))));
                }
            } catch {
                toast.error("No se pudo cargar el costo por talla.");
                setAvailableSizes([]);
            } finally {
                setLoadingSummary(false);
            }
        };

        loadSummary();
    }, [open, selectedVariantId]);

    const colorOptions = useMemo(() => {
        const fromVariants = variants
            .map((v) => v.attributes?.color?.trim())
            .filter((c): c is string => Boolean(c));
        const unique = [...new Set(fromVariants)];
        if (unique.length) return unique;
        return ["Blanco", "Negro", "Azul marino", "Gris", "Beige"];
    }, [variants]);

    useEffect(() => {
        if (selectedVariantId && colorOptions.length && !selectedColor) {
            const variant = variants.find((v) => v.id === selectedVariantId);
            setSelectedColor(variant?.attributes?.color || colorOptions[0]);
        }
    }, [selectedVariantId, colorOptions, selectedColor, variants]);

    const selectedLine = lines.find((l) => l.id === selectedLineId);
    const selectedProduct = products.find((p) => p.id === selectedProductId);
    const selectedVariant = variants.find((v) => v.id === selectedVariantId);

    const { totalUnits, subtotal } = useMemo(() => {
        let units = 0;
        let total = 0;
        const fallbackUnit = Number(unitCostRaw) || 0;

        for (const size of availableSizes) {
            const qty = Number(sizeQuantities[size.talla_id] || 0);
            if (qty <= 0) continue;
            units += qty;
            const unitCost = Number(size.overall_total) || fallbackUnit;
            total += unitCost * qty;
        }

        return { totalUnits: units, subtotal: total };
    }, [availableSizes, sizeQuantities, unitCostRaw]);

    const handleSubmit = () => {
        if (!selectedLine || !selectedProduct || !selectedVariant) {
            toast.error("Completa línea, producto y variante.");
            return;
        }

        if (lockedProductId && selectedProduct.id !== lockedProductId) {
            toast.error("Todos los productos deben ser del mismo artículo en esta orden.");
            return;
        }

        const fallbackUnit = Number(unitCostRaw) || 0;
        const sizeLines = availableSizes
            .map((size) => {
                const cantidad = Number(sizeQuantities[size.talla_id] || 0);
                if (cantidad <= 0) return null;
                return {
                    talla_id: size.talla_id,
                    talla_nombre: size.talla_nombre,
                    cantidad,
                    costo_unitario: Number(size.overall_total) || fallbackUnit,
                };
            })
            .filter((line): line is NonNullable<typeof line> => line !== null);

        if (sizeLines.length === 0) {
            toast.error("Ingresa cantidad en al menos una talla.");
            return;
        }

        onAdd({
            key: `${selectedVariant.id}-${Date.now()}`,
            line_id: selectedLine.id,
            line_label: `${selectedLine.code} — ${selectedLine.name}`,
            producto_id: selectedProduct.id,
            producto_label: `${selectedProduct.code} — ${selectedProduct.name}`,
            variant_id: selectedVariant.id,
            variant_label: selectedVariant.name,
            color: selectedColor,
            estampado: selectedEstampado,
            comentario: comentario.trim(),
            unit_cost: fallbackUnit,
            size_lines: sizeLines,
        });

        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[640px] p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden">
                <div className="shrink-0 px-6 pt-6 pb-4 border-b">
                    <div className="flex items-start gap-3 pr-8">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Package className="h-4 w-4" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold">Agregar producto</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Selecciona desde el catálogo de Líneas.
                            </p>
                        </div>
                    </div>
                </div>

                {loadingLines ? (
                    <div className="flex justify-center py-14">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Línea</Label>
                                    <Select
                                        value={selectedLineId}
                                        onValueChange={(v) => {
                                            setSelectedLineId(v);
                                            setSelectedProductId("");
                                            setSelectedVariantId("");
                                        }}
                                        disabled={Boolean(lockedProductId)}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Selecciona línea..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {lines.map((line) => (
                                                <SelectItem key={line.id} value={line.id}>
                                                    {line.code} — {line.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Producto</Label>
                                    <Select
                                        value={selectedProductId}
                                        onValueChange={(v) => {
                                            setSelectedProductId(v);
                                            setSelectedVariantId("");
                                        }}
                                        disabled={!selectedLineId || loadingProducts || Boolean(lockedProductId)}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue
                                                placeholder={loadingProducts ? "Cargando..." : "Selecciona producto..."}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {products.map((product) => (
                                                <SelectItem key={product.id} value={product.id}>
                                                    {product.code} — {product.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Variante</Label>
                                    <Select
                                        value={selectedVariantId}
                                        onValueChange={(v) => {
                                            setSelectedVariantId(v);
                                            setSelectedColor("");
                                        }}
                                        disabled={!selectedProductId || loadingVariants}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue
                                                placeholder={loadingVariants ? "Cargando..." : "Selecciona variante..."}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {variants.map((variant) => (
                                                <SelectItem key={variant.id} value={variant.id}>
                                                    {variant.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Color</Label>
                                    <Select
                                        value={selectedColor}
                                        onValueChange={setSelectedColor}
                                        disabled={!selectedVariantId}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Selecciona color..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {colorOptions.map((color) => (
                                                <SelectItem key={color} value={color}>
                                                    {color}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Estampado</Label>
                                    <Select value={selectedEstampado} onValueChange={setSelectedEstampado}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ESTAMPADO_OPTIONS.map((opt) => (
                                                <SelectItem key={opt} value={opt}>
                                                    {opt}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Costo unitario (referencia)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="Se calcula al elegir variante"
                                    value={unitCostRaw}
                                    onChange={(e) => setUnitCostRaw(e.target.value)}
                                    disabled={!selectedVariantId}
                                    className="h-10 font-semibold tabular-nums"
                                />
                                {loadingSummary && (
                                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Calculando costos por talla...
                                    </p>
                                )}
                            </div>

                            <Separator />

                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Ruler className="h-4 w-4 text-primary" />
                                    <Label className="text-sm font-semibold">Cantidades por talla</Label>
                                </div>
                                {availableSizes.length === 0 ? (
                                    <div className="rounded-xl border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
                                        {selectedVariantId
                                            ? "Esta variante no tiene tallas con consumo configurado."
                                            : "Selecciona una variante para ver las tallas."}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                                        {availableSizes.map((size) => {
                                            const qty = sizeQuantities[size.talla_id] ?? "";
                                            const hasQty = Number(qty) > 0;
                                            return (
                                                <div
                                                    key={size.talla_id}
                                                    className={cn(
                                                        "rounded-xl border p-2.5 space-y-1.5 transition-colors",
                                                        hasQty
                                                            ? "border-primary/40 bg-primary/5"
                                                            : "border-border bg-muted/20"
                                                    )}
                                                >
                                                    <span className="block text-xs font-bold text-center">
                                                        {size.talla_nombre}
                                                    </span>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        className="h-9 text-center font-semibold tabular-nums"
                                                        value={qty}
                                                        onChange={(e) =>
                                                            setSizeQuantities((prev) => ({
                                                                ...prev,
                                                                [size.talla_id]: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="0"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
                                    <span className="text-muted-foreground">Resumen</span>
                                    <span className="font-semibold tabular-nums">
                                        {totalUnits} uds · Subtotal: ${formatMoney(subtotal)}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Comentarios del producto</Label>
                                <Textarea
                                    placeholder="Indicaciones específicas para este artículo..."
                                    value={comentario}
                                    onChange={(e) => setComentario(e.target.value)}
                                    className="min-h-[72px] resize-y"
                                />
                            </div>
                        </div>

                        <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="button" onClick={handleSubmit} disabled={loadingSummary} className="min-w-[100px]">
                                Agregar
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
