import { useEffect, useMemo, useRef, useState } from "react";
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
import type { VariantSizeCostSummary, TallaGenero } from "@/types/variant";
import { formatCurrency } from "@/lib/format-number";
import { resolveTallaGenero } from "@/lib/talla-catalog";

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
    /** Ingreso proyectado por unidad de prenda */
    ingreso_proyectado_unitario: number;
    size_lines: {
        talla_id: string;
        talla_nombre: string;
        cantidad: number;
        costo_unitario: number;
    }[];
}

/** Agrupa tallas con el mismo costo unitario (redondeado) para la referencia. */
function groupSizesByUnitCost(sizes: VariantSizeCostSummary[]) {
    const groups = new Map<
        number,
        { cost: number; labels: string[]; sizeIds: string[] }
    >();

    for (const size of sizes) {
        const cost = Math.round(Number(size.overall_total) || 0);
        if (cost <= 0) continue;
        const label = (size.talla_nombre || "").trim() || "—";
        const existing = groups.get(cost);
        if (existing) {
            existing.labels.push(label);
            existing.sizeIds.push(size.talla_id);
        } else {
            groups.set(cost, { cost, labels: [label], sizeIds: [size.talla_id] });
        }
    }

    return [...groups.values()]
        .map((g) => ({
            ...g,
            rangeLabel: formatSizeRangeLabel(g.labels),
        }))
        .sort((a, b) => a.cost - b.cost);
}

function formatSizeRangeLabel(labels: string[]): string {
    const parsed = labels.map((raw) => {
        const trimmed = String(raw).trim();
        // Solo tallas numéricas (mujer). Letras (XS, S…) no deben convertirse a 0.
        const isPureNumber = /^\d+(\.\d+)?$/.test(trimmed);
        const n = isPureNumber ? Number(trimmed) : NaN;
        return { raw: trimmed || "—", n };
    });

    const allNumeric = parsed.length > 0 && parsed.every((p) => !Number.isNaN(p.n));
    if (!allNumeric) {
        return parsed.map((p) => p.raw).join(", ");
    }

    parsed.sort((a, b) => a.n - b.n);
    const nums = parsed.map((p) => p.n);
    if (nums.length === 1) return String(nums[0]);

    const step = nums[1] - nums[0];
    const consecutive =
        step > 0 && nums.every((n, i) => i === 0 || n - nums[i - 1] === step);

    if (consecutive) return `${nums[0]}–${nums[nums.length - 1]}`;
    return parsed.map((p) => p.raw).join(", ");
}

function sortSizeSummaries(sizes: VariantSizeCostSummary[]): VariantSizeCostSummary[] {
    const hombreOrder: Record<string, number> = { XS: 1, S: 2, M: 3, L: 4, XL: 5, XXL: 6 };
    return [...sizes].sort((a, b) => {
        const an = String(a.talla_nombre || "").trim();
        const bn = String(b.talla_nombre || "").trim();
        const aNum = Number(an);
        const bNum = Number(bn);
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
        const aKey = hombreOrder[an.toUpperCase()];
        const bKey = hombreOrder[bn.toUpperCase()];
        if (aKey != null && bKey != null) return aKey - bKey;
        if (aKey != null) return -1;
        if (bKey != null) return 1;
        return an.localeCompare(bn, "es");
    });
}

function filterSizesByGenero(
    sizes: VariantSizeCostSummary[],
    genero: TallaGenero
): VariantSizeCostSummary[] {
    return sortSizeSummaries(
        sizes.filter(
            (size) => resolveTallaGenero({ name: size.talla_nombre, label: size.talla_nombre }) === genero
        )
    );
}

interface AddOrderProductDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lines: ProductLine[];
    loadingLines: boolean;
    lockedProductId?: string;
    /** Si se pasa, el diálogo hidrata el producto para editarlo */
    editEntry?: OrderProductEntry | null;
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
    editEntry = null,
    onAdd,
}: AddOrderProductDialogProps) {
    const isEdit = Boolean(editEntry);
    const [selectedLineId, setSelectedLineId] = useState("");
    const [products, setProducts] = useState<LineProduct[]>([]);
    const [variants, setVariants] = useState<VariantOption[]>([]);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [selectedVariantId, setSelectedVariantId] = useState("");
    const [selectedGenero, setSelectedGenero] = useState<TallaGenero>("mujer");
    const [selectedColor, setSelectedColor] = useState("");
    const [selectedEstampado, setSelectedEstampado] = useState("Sin estampado");
    const [unitCostRaw, setUnitCostRaw] = useState("");
    const [ingresoProyectadoRaw, setIngresoProyectadoRaw] = useState("");
    const [comentario, setComentario] = useState("");
    const [sizeQuantities, setSizeQuantities] = useState<Record<string, string>>({});
    const [availableSizes, setAvailableSizes] = useState<VariantSizeCostSummary[]>([]);

    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingVariants, setLoadingVariants] = useState(false);
    const [loadingSummary, setLoadingSummary] = useState(false);
    /** Evita que los efectos en cascada limpien la hidratación de edición */
    const editHydrateRef = useRef<OrderProductEntry | null>(null);
    const skipVariantResetRef = useRef(false);
    const skipSizeResetRef = useRef(false);
    const skipGeneroAutoRef = useRef(false);

    const resetForm = () => {
        setSelectedLineId("");
        setProducts([]);
        setVariants([]);
        setSelectedProductId("");
        setSelectedVariantId("");
        setSelectedGenero("mujer");
        setSelectedColor("");
        setSelectedEstampado("Sin estampado");
        setUnitCostRaw("");
        setIngresoProyectadoRaw("");
        setComentario("");
        setSizeQuantities({});
        setAvailableSizes([]);
        editHydrateRef.current = null;
        skipVariantResetRef.current = false;
        skipSizeResetRef.current = false;
        skipGeneroAutoRef.current = false;
    };

    useEffect(() => {
        if (!open) {
            resetForm();
            return;
        }

        if (editEntry) {
            editHydrateRef.current = editEntry;
            skipVariantResetRef.current = true;
            skipSizeResetRef.current = true;
            skipGeneroAutoRef.current = true;
            setSelectedColor(editEntry.color || "");
            const firstSizeName = editEntry.size_lines?.[0]?.talla_nombre;
            if (firstSizeName) {
                setSelectedGenero(
                    resolveTallaGenero({ name: firstSizeName, label: firstSizeName })
                );
            }
            setSelectedEstampado(
                editEntry.estampado?.trim()
                    ? ESTAMPADO_OPTIONS.includes(editEntry.estampado)
                        ? editEntry.estampado
                        : editEntry.estampado
                    : "Sin estampado"
            );
            setComentario(editEntry.comentario || "");
            setIngresoProyectadoRaw(
                editEntry.ingreso_proyectado_unitario > 0
                    ? String(editEntry.ingreso_proyectado_unitario)
                    : ""
            );
            setUnitCostRaw(
                editEntry.unit_cost > 0 ? String(Math.round(editEntry.unit_cost)) : ""
            );

            const resolveAndSetLine = async () => {
                if (editEntry.line_id && lines.some((l) => l.id === editEntry.line_id)) {
                    setSelectedLineId(editEntry.line_id);
                    return;
                }
                if (!editEntry.producto_id || !lines.length) {
                    if (editEntry.line_id) setSelectedLineId(editEntry.line_id);
                    return;
                }
                for (const line of lines) {
                    try {
                        const lineProducts = await http<LineProduct[]>(
                            endpoints.lineas.productos(line.id)
                        );
                        if (lineProducts.some((p) => p.id === editEntry.producto_id)) {
                            setSelectedLineId(line.id);
                            setProducts(lineProducts);
                            setSelectedProductId(editEntry.producto_id);
                            return;
                        }
                    } catch {
                        /* try next */
                    }
                }
                if (editEntry.line_id) setSelectedLineId(editEntry.line_id);
            };

            void resolveAndSetLine();
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
    }, [open, editEntry?.key, lockedProductId, lines]);

    useEffect(() => {
        if (!open || !selectedLineId) {
            if (!lockedProductId && !editHydrateRef.current) {
                setProducts([]);
                setSelectedProductId("");
            }
            return;
        }

        const hydrate = editHydrateRef.current;
        const loadProducts = async () => {
            setLoadingProducts(true);
            try {
                const data = await http<LineProduct[]>(endpoints.lineas.productos(selectedLineId));
                setProducts(data || []);
                if (hydrate?.producto_id) {
                    setSelectedProductId(hydrate.producto_id);
                } else if (!lockedProductId) {
                    setSelectedProductId("");
                }
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
            if (!editHydrateRef.current) {
                setVariants([]);
                setSelectedVariantId("");
            }
            return;
        }

        const hydrate = editHydrateRef.current;
        const loadVariants = async () => {
            setLoadingVariants(true);
            try {
                const data = await http<VariantOption[]>(endpoints.productos.variantes(selectedProductId));
                setVariants(data || []);
                if (hydrate?.variant_id && hydrate.producto_id === selectedProductId) {
                    skipVariantResetRef.current = true;
                    setSelectedVariantId(hydrate.variant_id);
                } else if (skipVariantResetRef.current) {
                    skipVariantResetRef.current = false;
                } else {
                    setSelectedVariantId("");
                }
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
            if (!editHydrateRef.current) {
                setAvailableSizes([]);
                setSizeQuantities({});
                setUnitCostRaw("");
                setIngresoProyectadoRaw("");
            }
            return;
        }

        const hydrate = editHydrateRef.current;
        const loadSummary = async () => {
            setLoadingSummary(true);
            try {
                const summary = await fetchVariantCostSummary(selectedVariantId);
                const sizes = summary.sizes ?? [];
                setAvailableSizes(sizes);

                const qtyMap = Object.fromEntries(sizes.map((s) => [s.talla_id, ""]));
                if (hydrate?.variant_id === selectedVariantId && hydrate.size_lines?.length) {
                    for (const line of hydrate.size_lines) {
                        if (line.talla_id in qtyMap || sizes.some((s) => s.talla_id === line.talla_id)) {
                            qtyMap[line.talla_id] = String(line.cantidad || "");
                        }
                    }
                    setSizeQuantities(qtyMap);
                    if (hydrate.ingreso_proyectado_unitario > 0) {
                        setIngresoProyectadoRaw(String(hydrate.ingreso_proyectado_unitario));
                    }
                    // unit_cost se recalcula desde las tallas reales (ver useMemo)
                    setUnitCostRaw("");
                    editHydrateRef.current = null;
                    skipSizeResetRef.current = false;
                } else {
                    setSizeQuantities(qtyMap);
                    setUnitCostRaw("");
                    if (!skipSizeResetRef.current) {
                        setIngresoProyectadoRaw("");
                    }
                    skipSizeResetRef.current = false;
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

    // Si la variante solo tiene tallas de un género, o al cargar, alinear el select
    useEffect(() => {
        if (!availableSizes.length) return;
        if (skipGeneroAutoRef.current) {
            skipGeneroAutoRef.current = false;
            return;
        }
        const mujer = filterSizesByGenero(availableSizes, "mujer");
        const hombre = filterSizesByGenero(availableSizes, "hombre");
        if (mujer.length > 0 && hombre.length === 0) {
            setSelectedGenero("mujer");
        } else if (hombre.length > 0 && mujer.length === 0) {
            setSelectedGenero("hombre");
        }
    }, [availableSizes]);

    useEffect(() => {
        if (!selectedVariantId || selectedColor) return;
        const variant = variants.find((v) => v.id === selectedVariantId);
        const fromVariant = variant?.attributes?.color?.trim();
        if (fromVariant) setSelectedColor(fromVariant);
    }, [selectedVariantId, selectedColor, variants]);

    const selectedLine = lines.find((l) => l.id === selectedLineId);
    const selectedProduct = products.find((p) => p.id === selectedProductId);
    const selectedVariant = variants.find((v) => v.id === selectedVariantId);

    const mujerSizes = useMemo(
        () => filterSizesByGenero(availableSizes, "mujer"),
        [availableSizes]
    );
    const hombreSizes = useMemo(
        () => filterSizesByGenero(availableSizes, "hombre"),
        [availableSizes]
    );
    const visibleSizes = selectedGenero === "mujer" ? mujerSizes : hombreSizes;

    const unitsByGenero = useMemo(() => {
        const count = (sizes: VariantSizeCostSummary[]) =>
            sizes.reduce((sum, size) => sum + (Number(sizeQuantities[size.talla_id] || 0) || 0), 0);
        return {
            mujer: count(mujerSizes),
            hombre: count(hombreSizes),
        };
    }, [mujerSizes, hombreSizes, sizeQuantities]);

    // Costos del tallaje activo (pestaña)
    const costGroups = useMemo(() => groupSizesByUnitCost(visibleSizes), [visibleSizes]);

    // Totales de TODAS las tallas (hombre + mujer) para no perder datos al editar
    const { totalUnits, subtotal, weightedUnitCost, activeCostGroups } = useMemo(() => {
        let units = 0;
        let total = 0;
        const activeSizeIds = new Set<string>();

        for (const size of availableSizes) {
            const qty = Number(sizeQuantities[size.talla_id] || 0);
            if (qty <= 0) continue;
            units += qty;
            const unitCost = Math.round(Number(size.overall_total) || 0);
            total += unitCost * qty;
            activeSizeIds.add(size.talla_id);
        }

        const weighted = units > 0 ? Math.round(total / units) : 0;
        const tabActiveIds = new Set(
            visibleSizes.filter((s) => Number(sizeQuantities[s.talla_id] || 0) > 0).map((s) => s.talla_id)
        );
        const activeGroups = costGroups
            .map((g) => ({
                ...g,
                inRequest: g.sizeIds.some((id) => tabActiveIds.has(id)),
            }))
            .filter((g) => (tabActiveIds.size > 0 ? g.inRequest : true));

        return {
            totalUnits: units,
            subtotal: total,
            weightedUnitCost: weighted,
            activeCostGroups: activeGroups,
        };
    }, [availableSizes, sizeQuantities, costGroups, visibleSizes]);

    // Mantener unitCostRaw alineado al costo real de lo pedido (o del primer grupo si aún no hay qty)
    useEffect(() => {
        if (weightedUnitCost > 0) {
            setUnitCostRaw(String(weightedUnitCost));
            return;
        }
        if (costGroups.length === 1) {
            setUnitCostRaw(String(costGroups[0].cost));
            return;
        }
        setUnitCostRaw("");
    }, [weightedUnitCost, costGroups]);

    // Tras editar/cargar cantidades, abrir la pestaña que tenga unidades
    useEffect(() => {
        if (!availableSizes.length) return;
        if (unitsByGenero.mujer > 0 && unitsByGenero.hombre === 0) {
            setSelectedGenero("mujer");
        } else if (unitsByGenero.hombre > 0 && unitsByGenero.mujer === 0) {
            setSelectedGenero("hombre");
        } else if (unitsByGenero.hombre > unitsByGenero.mujer) {
            setSelectedGenero("hombre");
        } else if (unitsByGenero.mujer > 0) {
            setSelectedGenero("mujer");
        }
        // Solo al hidratar / cambiar catálogo, no en cada tecleo: dependemos de availableSizes + open
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availableSizes, open]);

    const ingresoProyectadoUnitario = Number(ingresoProyectadoRaw) || 0;
    const ingresoProyectadoTotal =
        Math.round(ingresoProyectadoUnitario * totalUnits * 100) / 100;

    const handleSubmit = () => {
        if (!selectedLine || !selectedProduct || !selectedVariant) {
            toast.error("Completa línea, producto y variante.");
            return;
        }

        if (lockedProductId && selectedProduct.id !== lockedProductId) {
            toast.error("Todos los productos deben ser del mismo artículo en esta orden.");
            return;
        }

        const fallbackUnit = weightedUnitCost || Number(unitCostRaw) || 0;
        // Incluir tallas de ambos géneros (no solo la pestaña activa)
        const sizeLines = availableSizes
            .map((size) => {
                const cantidad = Number(sizeQuantities[size.talla_id] || 0);
                if (cantidad <= 0) return null;
                return {
                    talla_id: size.talla_id,
                    talla_nombre: size.talla_nombre,
                    cantidad,
                    costo_unitario: Math.round(Number(size.overall_total) || 0) || fallbackUnit,
                };
            })
            .filter((line): line is NonNullable<typeof line> => line !== null);

        if (sizeLines.length === 0) {
            toast.error("Ingresa cantidad en al menos una talla.");
            return;
        }

        if (!ingresoProyectadoUnitario || ingresoProyectadoUnitario <= 0) {
            toast.error("Ingresa el ingreso proyectado por unidad.");
            return;
        }

        onAdd({
            key: editEntry?.key || `${selectedVariant.id}-${Date.now()}`,
            line_id: selectedLine.id,
            line_label: `${selectedLine.code} — ${selectedLine.name}`,
            producto_id: selectedProduct.id,
            producto_label: `${selectedProduct.code} — ${selectedProduct.name}`,
            variant_id: selectedVariant.id,
            variant_label: selectedVariant.name,
            color: selectedColor,
            estampado: selectedEstampado,
            comentario: comentario.trim(),
            unit_cost: weightedUnitCost || fallbackUnit,
            ingreso_proyectado_unitario: ingresoProyectadoUnitario,
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
                            <h2 className="text-base font-bold">
                                {isEdit ? "Editar producto" : "Agregar producto"}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {isEdit
                                    ? "Modifica tallas, color, estampado o ingreso proyectado."
                                    : "Selecciona desde el catálogo de Líneas."}
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
                                            editHydrateRef.current = null;
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
                                            editHydrateRef.current = null;
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label className="text-xs font-medium">Variante</Label>
                                    <Select
                                        value={selectedVariantId}
                                        onValueChange={(v) => {
                                            editHydrateRef.current = null;
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
                                    <Input
                                        value={selectedColor}
                                        onChange={(e) => setSelectedColor(e.target.value)}
                                        placeholder="Ej. Blanco, Azul marino..."
                                        disabled={!selectedVariantId}
                                        className="h-10"
                                    />
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

                            {selectedVariantId && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium">Tallaje por género</Label>
                                    <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedGenero("mujer")}
                                            disabled={loadingSummary || mujerSizes.length === 0}
                                            className={cn(
                                                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5",
                                                selectedGenero === "mujer"
                                                    ? "bg-background text-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground",
                                                mujerSizes.length === 0 && "opacity-40 cursor-not-allowed"
                                            )}
                                        >
                                            Mujer
                                            {unitsByGenero.mujer > 0 && (
                                                <span className="rounded-full bg-primary/15 text-primary px-1.5 py-0 text-[10px] font-bold tabular-nums">
                                                    {unitsByGenero.mujer}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedGenero("hombre")}
                                            disabled={loadingSummary || hombreSizes.length === 0}
                                            className={cn(
                                                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5",
                                                selectedGenero === "hombre"
                                                    ? "bg-background text-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground",
                                                hombreSizes.length === 0 && "opacity-40 cursor-not-allowed"
                                            )}
                                        >
                                            Hombre
                                            {unitsByGenero.hombre > 0 && (
                                                <span className="rounded-full bg-primary/15 text-primary px-1.5 py-0 text-[10px] font-bold tabular-nums">
                                                    {unitsByGenero.hombre}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        {selectedGenero === "mujer"
                                            ? "Tallas numéricas (mujer). Cambia a Hombre para ver XS–XXL."
                                            : "Tallas en letra (hombre). Cambia a Mujer para ver 6–20."}
                                        {(unitsByGenero.mujer > 0 || unitsByGenero.hombre > 0) &&
                                            unitsByGenero.mujer + unitsByGenero.hombre !==
                                                (selectedGenero === "mujer"
                                                    ? unitsByGenero.mujer
                                                    : unitsByGenero.hombre) && (
                                            <span className="block mt-0.5 text-foreground/80">
                                                Pedido total: {totalUnits} uds (mujer {unitsByGenero.mujer} · hombre{" "}
                                                {unitsByGenero.hombre}). Al guardar se conservan ambos.
                                            </span>
                                        )}
                                    </p>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">
                                    Costo unitario (referencia) —{" "}
                                    {selectedGenero === "mujer" ? "mujer" : "hombre"}
                                </Label>
                                {!selectedVariantId ? (
                                    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                                        Selecciona una variante para ver costos por talla
                                    </div>
                                ) : loadingSummary ? (
                                    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Calculando costos por talla...
                                    </div>
                                ) : costGroups.length === 0 ? (
                                    <div className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                                        Sin costos configurados para esta variante.
                                    </div>
                                ) : (
                                    <div className="rounded-lg border bg-muted/20 overflow-hidden">
                                        <div className="px-3 py-2 border-b bg-muted/30">
                                            <p className="text-[11px] text-muted-foreground">
                                                Costo real por talla (tela + insumos + mano de obra). Úsalo para
                                                definir el ingreso proyectado.
                                            </p>
                                        </div>
                                        <ul className="divide-y">
                                            {(totalUnits > 0 ? activeCostGroups : costGroups).map((group) => (
                                                <li
                                                    key={group.cost}
                                                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                                                >
                                                    <span className="text-muted-foreground">
                                                        {group.labels.length > 1 ? "Tallas" : "Talla"}{" "}
                                                        <span className="font-semibold text-foreground">
                                                            {group.rangeLabel}
                                                        </span>
                                                    </span>
                                                    <span className="font-bold tabular-nums text-foreground">
                                                        ${formatMoney(group.cost)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        {totalUnits > 0 && weightedUnitCost > 0 && costGroups.length > 1 && (
                                            <div className="flex items-center justify-between gap-3 px-3 py-2 border-t bg-primary/5 text-sm">
                                                <span className="text-xs text-muted-foreground">
                                                    Promedio ponderado de lo pedido
                                                </span>
                                                <span className="font-bold tabular-nums">
                                                    ${formatMoney(weightedUnitCost)}
                                                </span>
                                            </div>
                                        )}
                                        {totalUnits === 0 && costGroups.length > 1 && (
                                            <p className="px-3 py-2 text-[11px] text-muted-foreground border-t">
                                                Ingresa cantidades para ver solo los costos de las tallas
                                                solicitadas.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Ruler className="h-4 w-4 text-primary" />
                                    <Label className="text-sm font-semibold">Cantidades por talla</Label>
                                </div>
                                {visibleSizes.length === 0 ? (
                                    <div className="rounded-xl border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
                                        {selectedVariantId
                                            ? loadingSummary
                                                ? "Cargando tallas..."
                                                : availableSizes.length === 0
                                                  ? "Esta variante no tiene tallas con consumo configurado."
                                                  : `No hay tallas de ${selectedGenero} configuradas en esta variante.`
                                            : "Selecciona una variante para ver las tallas."}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                                        {visibleSizes.map((size) => {
                                            const qty = sizeQuantities[size.talla_id] ?? "";
                                            const hasQty = Number(qty) > 0;
                                            const sizeCost = Math.round(Number(size.overall_total) || 0);
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
                                                    {sizeCost > 0 && (
                                                        <span className="block text-[10px] text-center text-muted-foreground tabular-nums">
                                                            ${formatMoney(sizeCost)}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Resumen</span>
                                        <span className="font-semibold tabular-nums">
                                            {totalUnits} uds
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Costo subtotal</span>
                                        <span className="font-semibold tabular-nums">
                                            ${formatMoney(subtotal)}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        Suma del costo real de cada talla × su cantidad
                                    </p>
                                    <div className="space-y-1.5 pt-1 border-t">
                                        <Label className="text-xs font-medium">
                                            Ingreso proyectado (por unidad){" "}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={ingresoProyectadoRaw}
                                            onChange={(e) => setIngresoProyectadoRaw(e.target.value)}
                                            placeholder="Lo que proyectas recibir por prenda"
                                            className="h-10 font-semibold tabular-nums"
                                        />
                                        {totalUnits > 0 && ingresoProyectadoUnitario > 0 && (
                                            <p className="text-[11px] text-muted-foreground">
                                                Ingreso proyectado de este producto:{" "}
                                                <span className="font-semibold text-foreground tabular-nums">
                                                    ${formatMoney(ingresoProyectadoTotal)}
                                                </span>
                                                {" "}({totalUnits} × ${formatMoney(ingresoProyectadoUnitario)})
                                            </p>
                                        )}
                                    </div>
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
                                {isEdit ? "Guardar producto" : "Agregar"}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

