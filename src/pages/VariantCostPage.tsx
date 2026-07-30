import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Plus, Loader2 } from "lucide-react";

import { useGetProductDetail } from "@/hooks/useGetProductDetail";
import { useGetVariants } from "@/hooks/useGetVariants";
import { useGetFabricCosts } from "@/hooks/useGetFabricCosts";
import { useGetLaborCosts } from "@/hooks/useGetLaborCosts";
import { useGetSizeConsumption } from "@/hooks/useGetSizeConsumption";
import { useGetSupplyCosts } from "@/hooks/useGetSupplyCosts";
import { useGetCostCatalogs } from "@/hooks/useGetCostCatalogs";
import { useGetCostSummary } from "@/hooks/useGetCostSummary";
import { useFabricCosts } from "@/hooks/useFabricCost";
import { useSupplyCosts } from "@/hooks/useSupplyCosts";
import { useLaborCosts } from "@/hooks/useLaborCosts";
import { useSizeConsumption } from "@/hooks/useSizeConsumption";
import { useCreateProveedor } from "@/hooks/useCreateProveedor";
import { useCreateInsumoTipo } from "@/hooks/useCreateInsumoTipo";
import { useCreateVariant } from "@/hooks/useCreateVariant";

import { FabricCostsTable } from "@/components/variant-cost/FabricCostsTable";
import { SuppliesTable } from "@/components/variant-cost/SuppliesTable";
import { LaborCostsTable } from "@/components/variant-cost/LaborCostsTable";
import { SizeConsumptionTable } from "@/components/variant-cost/SizeConsumptionTable";
import { VariantSizeCostBreakdownTable } from "@/components/variant-cost/VariantSizeCostBreakdownTable";
import { ModalForm, FieldDefinition } from "@/components/ui/ModalForm";
import { getNewInsumoTipoFields } from "@/lib/insumo-tipo-form";
import { normalizeDecimalInput } from "@/lib/decimal-input";
import { formatCurrency, formatDecimal, formatForInput } from "@/lib/format-number";
import type { UpdateLaborPayload, UpdateSupplyPayload } from "@/types/variant";
import { cn } from "@/lib/utils";

const resolveTallaId = (value: string) => (value ? value : null);

type ModalType =
    | "new_variant"
    | "supply"
    | "edit_supply"
    | "edit_fabric"
    | "labor"
    | "edit_labor"
    | "new_proveedor"
    | "new_insumo_tipo"
    | "";

export default function VariantCostPage() {
    const { productId, variantId } = useParams<{ productId: string; variantId?: string }>();
    const [searchParams] = useSearchParams();
    const lineCode = searchParams.get("lineCode");
    const navigate = useNavigate();

    const { product, isLoading: isProductLoading } = useGetProductDetail(productId);
    const { variants, isLoading: isVariantsLoading, refetch: refetchVariants } = useGetVariants(productId);
    const { sizes, supplyTypes, laborPhases, proveedores, refetchProveedores, refetchSupplyTypes } =
        useGetCostCatalogs();
    const { createProveedor } = useCreateProveedor();
    const { createInsumoTipo } = useCreateInsumoTipo();

    const { createVariant } = useCreateVariant();
    const { addFabric, updateFabric, deleteFabric, setFabricPrincipal, loading: isFabricLoading } =
        useFabricCosts();
    const { addSupply, updateSupply, deleteSupply } = useSupplyCosts();
    const { addLabor, updateLabor, deleteLabor } = useLaborCosts();
    const { updateSizeConsumption, loading: isSalePriceSaving } = useSizeConsumption();

    const activeVariantId = variantId ?? "";
    const hasActiveVariant = !!variantId;

    const { data: fabrics } = useGetFabricCosts(activeVariantId);
    const { data: labor } = useGetLaborCosts(activeVariantId);
    const { data: sizeCons } = useGetSizeConsumption(activeVariantId);
    const { data: supplies } = useGetSupplyCosts(activeVariantId);
    const { data: summary, isLoading: isSummaryLoading } = useGetCostSummary(activeVariantId);
    const [selectedCostSizeId, setSelectedCostSizeId] = useState<string>("");
    const [salePriceInput, setSalePriceInput] = useState("");

    useEffect(() => {
        setSelectedCostSizeId("");
    }, [activeVariantId]);

    useEffect(() => {
        if (selectedCostSizeId) return;
        const firstSize = summary?.sizes?.[0]?.talla_id;
        if (firstSize) setSelectedCostSizeId(firstSize);
    }, [summary?.sizes, selectedCostSizeId]);

    const selectedSizeCost = useMemo(
        () => summary?.sizes?.find((s) => s.talla_id === selectedCostSizeId),
        [summary?.sizes, selectedCostSizeId]
    );

    const formatMeters = (value: number) => formatDecimal(value);

    const fabricTotal = Number(selectedSizeCost?.fabric_total ?? summary?.fabric_total ?? 0);
    const suppliesTotal = Number(selectedSizeCost?.supplies_total ?? summary?.supplies_total ?? 0);
    const laborTotal = Number(selectedSizeCost?.labor_total ?? summary?.labor_total ?? 0);
    const overallTotal = Number(selectedSizeCost?.overall_total ?? summary?.overall_total ?? 0);
    const sizeConsumption = Number(selectedSizeCost?.consumption ?? summary?.average_consumption ?? 0);
    const fabricPricePerMeter = Number(summary?.fabric_price_per_meter ?? 0);
    const showFabricBreakdown = sizeConsumption > 0 && fabricPricePerMeter > 0;
    const selectedSizeName =
        selectedSizeCost?.talla_nombre ||
        sizes.find((s) => s.id === selectedCostSizeId)?.label ||
        sizes.find((s) => s.id === selectedCostSizeId)?.name;

    const selectedSizeConsumptionId = useMemo(
        () => sizeCons?.find((rec) => rec.size_id === selectedCostSizeId)?.id,
        [sizeCons, selectedCostSizeId]
    );

    const parsedSalePrice = useMemo(() => {
        const normalized = salePriceInput.replace(/\./g, "").replace(",", ".").trim();
        if (!normalized) return null;
        const value = Number(normalized);
        return Number.isFinite(value) && value > 0 ? value : null;
    }, [salePriceInput]);

    const gananciaPreview = useMemo(() => {
        if (parsedSalePrice == null) return null;
        return parsedSalePrice - overallTotal;
    }, [parsedSalePrice, overallTotal]);

    useEffect(() => {
        const stored = selectedSizeCost?.precio_venta;
        if (stored == null || stored === "") {
            setSalePriceInput("");
            return;
        }
        setSalePriceInput(formatForInput(stored));
    }, [selectedCostSizeId, selectedSizeCost?.precio_venta]);

    const handleSaveSalePrice = async () => {
        if (!activeVariantId || !selectedSizeConsumptionId) {
            if (salePriceInput.trim()) {
                toast.error("Configura el consumo de la talla antes de guardar el precio de venta.");
            }
            return;
        }

        const stored = selectedSizeCost?.precio_venta;
        const storedNum =
            stored == null || stored === "" ? null : Number(String(stored).replace(",", "."));
        const nextValue = parsedSalePrice;

        if (nextValue == null && !salePriceInput.trim()) {
            if (storedNum == null) return;
            const ok = await updateSizeConsumption(
                selectedSizeConsumptionId,
                { precio_venta: null },
                activeVariantId
            );
            if (ok) toast.success("Precio de venta eliminado");
            else toast.error("No se pudo actualizar el precio de venta");
            return;
        }

        if (nextValue == null) {
            toast.error("Ingresa un precio de venta válido.");
            return;
        }

        if (storedNum != null && Math.abs(storedNum - nextValue) < 0.001) return;

        const ok = await updateSizeConsumption(
            selectedSizeConsumptionId,
            { precio_venta: nextValue },
            activeVariantId
        );
        if (ok) toast.success("Precio de venta guardado");
        else toast.error("No se pudo guardar el precio de venta");
    };

    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        type: ModalType;
        title: string;
        fields: FieldDefinition[];
        initialData?: any;
    }>({
        isOpen: false,
        type: "",
        title: "",
        fields: [],
    });

    const backToProducts = () => {
        if (lineCode) {
            navigate(`/products?lineCode=${encodeURIComponent(lineCode)}`);
            return;
        }
        navigate("/lines");
    };

    const variantCostingUrl = (id: string) => {
        const query = lineCode ? `?lineCode=${encodeURIComponent(lineCode)}` : "";
        return `/products/${productId}/variants/${id}/costing${query}`;
    };

    const handleOpenModal = (
        type: ModalType,
        title: string,
        fields: FieldDefinition[],
        initialData?: any
    ) => {
        setModalConfig({ isOpen: true, type, title, fields, initialData });
    };

    const handleSubmit = async (data: Record<string, string>) => {
        if (!productId) return;

        try {
            if (modalConfig.type === "new_variant") {
                const result = await createVariant(productId, {
                    name: data.name,
                    code: data.code,
                });

                if (result.success) {
                    toast.success("Variante creada correctamente");
                    await refetchVariants();
                    const newVariantId = (result.data as { id: string })?.id;
                    if (newVariantId) {
                        navigate(variantCostingUrl(newVariantId));
                    }
                } else {
                    toast.error(result.error || "No se pudo crear la variante");
                }
            } else if (modalConfig.type === "supply" && hasActiveVariant) {
                const ok = await addSupply({
                    variant_id: activeVariantId,
                    tipo_id: data.tipo_id,
                    talla_id: resolveTallaId(data.talla_id),
                    quantity: data.quantity,
                    unit_price: data.unit_price,
                });
                if (ok) toast.success("Insumo agregado");
                else toast.error("No se pudo agregar el insumo");
            } else if (modalConfig.type === "edit_supply" && modalConfig.initialData?.id && hasActiveVariant) {
                const initial = modalConfig.initialData;
                const payload: Record<string, string | null> = {};
                const initialTipoId = initial.tipo_id || initial.tipo;
                const initialTallaId = initial.talla_id || "";

                if (data.tipo_id !== initialTipoId) payload.tipo_id = data.tipo_id;
                if (data.quantity !== initial.quantity) payload.quantity = data.quantity;
                if (data.unit_price !== initial.unit_price) payload.unit_price = data.unit_price;
                if ((data.talla_id || "") !== initialTallaId) {
                    payload.talla_id = resolveTallaId(data.talla_id);
                }

                if (Object.keys(payload).length === 0) {
                    toast.info("No hay cambios para guardar");
                } else {
                    const ok = await updateSupply(initial.id, payload, activeVariantId);
                    if (ok) toast.success("Insumo actualizado");
                    else toast.error("No se pudo actualizar el insumo");
                }
            } else if (modalConfig.type === "edit_fabric" && modalConfig.initialData?.id && hasActiveVariant) {
                const initial = modalConfig.initialData;
                const payload: Record<string, string | boolean> = {};
                const tieneIva = data.tiene_iva === "true";
                const initialTieneIva = Boolean(initial.tiene_iva);
                const meters = normalizeDecimalInput(data.meters);
                const pricePerMeter = normalizeDecimalInput(data.price_per_meter);

                if (data.proveedor_id !== initial.proveedor_id) payload.proveedor_id = data.proveedor_id;
                if (data.reference !== initial.reference) payload.reference = data.reference;
                if (meters !== normalizeDecimalInput(String(initial.meters))) payload.meters = meters;
                if (pricePerMeter !== normalizeDecimalInput(String(initial.price_per_meter))) {
                    payload.price_per_meter = pricePerMeter;
                }
                if (tieneIva !== initialTieneIva) payload.tiene_iva = tieneIva;

                if (Object.keys(payload).length === 0) {
                    toast.info("No hay cambios para guardar");
                } else {
                    const ok = await updateFabric(initial.id, payload, activeVariantId);
                    if (ok) toast.success("Costo de tela actualizado");
                    else toast.error("No se pudo actualizar el costo de tela");
                }
            } else if (modalConfig.type === "labor" && hasActiveVariant) {
                const ok = await addLabor({
                    variant_id: activeVariantId,
                    fase_id: data.fase_id,
                    talla_id: resolveTallaId(data.talla_id),
                    cantidad: data.cantidad || "1",
                    unit_price: data.unit_price,
                });
                if (ok) toast.success("Fase de mano de obra agregada");
                else toast.error("No se pudo agregar la fase");
            } else if (modalConfig.type === "edit_labor" && modalConfig.initialData?.id) {
                const initial = modalConfig.initialData;
                const payload: Record<string, string | null> = {};
                const initialFaseId = initial.fase_id || initial.fase;
                const initialTallaId = initial.talla_id || "";

                if (data.fase_id !== initialFaseId) payload.fase_id = data.fase_id;
                if (data.cantidad !== initial.cantidad) payload.cantidad = data.cantidad;
                if (data.unit_price !== initial.unit_price) payload.unit_price = data.unit_price;
                if ((data.talla_id || "") !== initialTallaId) {
                    payload.talla_id = resolveTallaId(data.talla_id);
                }

                if (Object.keys(payload).length === 0) {
                    toast.info("No hay cambios para guardar");
                } else {
                    const ok = await updateLabor(initial.id, payload, activeVariantId);
                    if (ok) toast.success("Fase actualizada");
                    else toast.error("No se pudo actualizar la fase");
                }
            } else if (modalConfig.type === "new_proveedor") {
                const result = await createProveedor(data.name);
                if (result.success) {
                    toast.success("Proveedor creado");
                    await refetchProveedores();
                } else {
                    toast.error(result.error || "No se pudo crear el proveedor");
                }
            } else if (modalConfig.type === "new_insumo_tipo") {
                const result = await createInsumoTipo({
                    name: data.name,
                    categoria: data.categoria,
                    unidad_medida: data.unidad_medida,
                    precio_unitario_default: data.precio_unitario_default
                        ? Number(data.precio_unitario_default)
                        : null,
                    codigo_sku: data.codigo_sku,
                    proveedor_marca: data.proveedor_marca,
                    color: data.color,
                    stock_minimo: data.stock_minimo ? Number(data.stock_minimo) : null,
                    stock_inicial: data.stock_inicial ? Number(data.stock_inicial) : null,
                });
                if (result.success) {
                    toast.success("Tipo de insumo creado");
                    await refetchSupplyTypes();
                } else {
                    toast.error(result.error || "No se pudo crear el tipo de insumo");
                }
            }
        } finally {
            setModalConfig((prev) => ({ ...prev, isOpen: false }));
        }
    };

    const supplyTypeOptions = supplyTypes.map((t) => ({
        value: t.id,
        label: t.label || t.name,
        defaultUnitPrice: t.precio_unitario_default ?? null,
    }));

    const newInsumoTipoFields: FieldDefinition[] = getNewInsumoTipoFields();

    const laborPhaseOptions = laborPhases.map((f) => ({
        value: f.id,
        label: f.label || f.name,
    }));

    const sizeScopeOptions = [
        { value: "", label: "Todas las tallas (compartido)" },
        ...sizes.map((s) => ({
            value: s.id,
            label: `${s.label || s.name || s.code || s.id} (solo esta talla)`,
        })),
    ];

    const supplyTallaField = {
        name: "talla_id",
        label: "Alcance por talla",
        type: "select" as const,
        required: false,
        options: sizeScopeOptions,
    };

    const laborTallaField = {
        name: "talla_id",
        label: "Alcance por talla",
        type: "select" as const,
        required: false,
        options: sizeScopeOptions,
    };

    const proveedorOptions = proveedores.map((p) => ({
        value: p.id,
        label: p.name,
    }));

    const ivaOptions = [
        { value: "false", label: "No" },
        { value: "true", label: "Sí" },
    ];

    const fabricEditFields: FieldDefinition[] = [
        { name: "proveedor_id", label: "Proveedor", type: "select", options: proveedorOptions },
        { name: "reference", label: "Referencia", type: "text", placeholder: "REF-001" },
        {
            name: "meters",
            label: "Metros",
            type: "decimal",
            placeholder: "2,500",
        },
        {
            name: "price_per_meter",
            label: "Precio por metro",
            type: "decimal",
            placeholder: "5000,00",
        },
        { name: "tiene_iva", label: "IVA", type: "select", options: ivaOptions },
    ];

    return (
        <AppLayout
            title={product?.name || "Producto"}
            subtitle="Variantes, tallas y estructura de costos"
        >
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={backToProducts} className="pl-0">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Volver a productos
                    </Button>
                    <h2 className="text-xl font-bold">
                        {isProductLoading ? (
                            <span className="text-muted-foreground font-normal inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                            </span>
                        ) : (
                            product?.name || "Producto"
                        )}
                    </h2>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                        <CardTitle className="text-sm font-bold">Variantes</CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                handleOpenModal("new_variant", "Añadir variante", [
                                    { name: "name", label: "Nombre", placeholder: "Talla especial", type: "text" },
                                    { name: "code", label: "Código", placeholder: "CAM001-V1", type: "text" },
                                ])
                            }
                        >
                            <Plus className="h-4 w-4 mr-2" /> Añadir variante
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isVariantsLoading ? (
                            <div className="px-6 py-8 flex justify-center">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : variants.length ? (
                            variants.map((v) => {
                                const isActive = v.id === variantId;
                                return (
                                    <div
                                        key={v.id}
                                        className={`grid grid-cols-3 px-6 py-3 border-b items-center text-sm cursor-pointer hover:bg-muted/10 ${isActive ? "bg-muted/5 font-semibold" : ""
                                            }`}
                                        onClick={() => !isActive && navigate(variantCostingUrl(v.id))}
                                    >
                                        <div className={isActive ? "text-primary font-bold" : "text-foreground"}>
                                            {v.code}
                                        </div>
                                        <div className="col-span-2 flex items-center justify-between gap-2">
                                            <span>
                                                {v.name}
                                                {isActive && (
                                                    <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                        Activa
                                                    </span>
                                                )}
                                            </span>
                                            {v.estimated_cost != null && Number(v.estimated_cost) > 0 && (
                                                <span className="text-xs text-muted-foreground shrink-0">
                                                    ${formatCurrency(v.estimated_cost)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                                Añade una variante para configurar tallas y costos.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {!hasActiveVariant ? (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            Selecciona una variante para ver tallas, consumos y costos.
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <SizeConsumptionTable
                                    data={sizeCons || []}
                                    variantId={activeVariantId}
                                    sizes={sizes}
                                    selectedSizeId={selectedCostSizeId}
                                    onSelectedSizeChange={setSelectedCostSizeId}
                                />
                            </div>
                            <div className="lg:col-span-1">
                                <Card className="h-full">
                                    <CardHeader className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="costo-venta" className="text-xs text-muted-foreground">
                                                Precio de venta (opcional)
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                                    $
                                                </span>
                                                <Input
                                                    id="costo-venta"
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="Ej. 65000"
                                                    value={salePriceInput}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/[^\d.,]/g, "");
                                                        setSalePriceInput(raw);
                                                    }}
                                                    onBlur={handleSaveSalePrice}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    disabled={
                                                        isSalePriceSaving ||
                                                        !selectedSizeCost ||
                                                        !selectedSizeConsumptionId
                                                    }
                                                    className="pl-7"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-bold">Resumen de costos</CardTitle>
                                            {selectedSizeName && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Talla {selectedSizeName}
                                                    {!selectedSizeCost && " — sin consumo configurado"}
                                                </p>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm">
                                        {isSummaryLoading && !summary ? (
                                            <div className="flex items-center gap-2 text-muted-foreground py-4">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Calculando resumen...
                                            </div>
                                        ) : selectedCostSizeId && !selectedSizeCost ? (
                                            <p className="text-sm text-muted-foreground py-4">
                                                Guarda el consumo de tela de esta talla para ver su costo de
                                                fabricación.
                                            </p>
                                        ) : (
                                            <>
                                                <div className="flex justify-between items-start gap-3">
                                                    <div>
                                                        <span>Tela</span>
                                                        {showFabricBreakdown && (
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {formatMeters(sizeConsumption)} m × $
                                                                {formatCurrency(fabricPricePerMeter)}/m
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span>${formatCurrency(fabricTotal)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Insumos</span>
                                                    <span>${formatCurrency(suppliesTotal)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Mano de obra</span>
                                                    <span>${formatCurrency(laborTotal)}</span>
                                                </div>
                                                {selectedSizeCost &&
                                                    (supplies?.length || labor?.length) &&
                                                    suppliesTotal === 0 &&
                                                    laborTotal === 0 && (
                                                        <p className="text-[11px] text-muted-foreground leading-snug">
                                                            Hay líneas de insumos/mano de obra, pero ninguna aplica a
                                                            esta talla. Usa &quot;Todas las tallas&quot; o la misma
                                                            talla del resumen.
                                                        </p>
                                                    )}
                                                {gananciaPreview != null && (
                                                    <div className="flex justify-between font-medium text-green-600">
                                                        <span>Ganancias</span>
                                                        <span
                                                            className={cn(
                                                                gananciaPreview < 0 && "text-red-600"
                                                            )}
                                                        >
                                                            ${formatCurrency(gananciaPreview)}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="border-t pt-2 font-bold flex justify-between text-base">
                                                    <span>
                                                        {selectedSizeCost ? "Costo talla" : "Costo base (promedio)"}
                                                    </span>
                                                    <span>${formatCurrency(overallTotal)}</span>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <VariantSizeCostBreakdownTable
                            sizes={summary?.sizes ?? []}
                            selectedSizeId={selectedCostSizeId}
                            onSelectSize={setSelectedCostSizeId}
                        />

                        <FabricCostsTable
                            data={fabrics || []}
                            variantId={activeVariantId}
                            proveedores={proveedores}
                            isSettingPrincipal={isFabricLoading}
                            onAdd={addFabric}
                            onSetPrincipal={async (id) => {
                                const ok = await setFabricPrincipal(id, activeVariantId);
                                if (ok) toast.success("Tela marcada como principal para el costeo");
                                else toast.error("No se pudo marcar la tela como principal");
                                return ok;
                            }}
                            onEdit={(item) =>
                                handleOpenModal("edit_fabric", "Editar costo de tela", fabricEditFields, {
                                    ...item,
                                    meters: formatForInput(item.meters),
                                    price_per_meter: formatForInput(item.price_per_meter),
                                    tiene_iva: item.tiene_iva ? "true" : "false",
                                })
                            }
                            onDelete={async (id) => {
                                const ok = await deleteFabric(id, activeVariantId);
                                if (ok) toast.success("Costo de tela eliminado");
                                else toast.error("No se pudo eliminar el costo de tela");
                            }}
                        />

                        <SuppliesTable
                            data={supplies || []}
                            onCreateTipo={() =>
                                handleOpenModal(
                                    "new_insumo_tipo",
                                    "Crear tipo de insumo",
                                    newInsumoTipoFields
                                )
                            }
                            onAdd={() =>
                                handleOpenModal(
                                    "supply",
                                    "Nuevo insumo",
                                    [
                                        {
                                            name: "tipo_id",
                                            label: "Tipo de insumo",
                                            type: "select",
                                            options: supplyTypeOptions,
                                        },
                                        supplyTallaField,
                                        { name: "quantity", label: "Cantidad", type: "number", placeholder: "8" },
                                        {
                                            name: "unit_price",
                                            label: "Precio unitario",
                                            type: "number",
                                            placeholder: "Ej. 3500 o 12,50",
                                        },
                                    ],
                                    {
                                        // Por defecto: talla del resumen activo, o compartido.
                                        talla_id: selectedCostSizeId || "",
                                    }
                                )
                            }
                            onEdit={(item) =>
                                handleOpenModal(
                                    "edit_supply",
                                    "Editar insumo",
                                    [
                                        {
                                            name: "tipo_id",
                                            label: "Tipo de insumo",
                                            type: "select",
                                            options: supplyTypeOptions,
                                        },
                                        supplyTallaField,
                                        { name: "quantity", label: "Cantidad", type: "number" },
                                        { name: "unit_price", label: "Precio unitario", type: "number" },
                                    ],
                                    {
                                        ...item,
                                        tipo_id: item.tipo_id || item.tipo,
                                        talla_id: item.talla_id || "",
                                        quantity: formatForInput(item.quantity),
                                        unit_price: formatForInput(item.unit_price),
                                    }
                                )
                            }
                            onDelete={(id) => deleteSupply(id, activeVariantId)}
                        />

                        <LaborCostsTable
                            data={labor || []}
                            onAdd={() =>
                                handleOpenModal(
                                    "labor",
                                    "Nueva fase de mano de obra",
                                    [
                                        {
                                            name: "fase_id",
                                            label: "Fase",
                                            type: "select",
                                            options: laborPhaseOptions,
                                        },
                                        laborTallaField,
                                        { name: "cantidad", label: "Cantidad", type: "number", placeholder: "1" },
                                        {
                                            name: "unit_price",
                                            label: "Precio unitario",
                                            type: "number",
                                            placeholder: "25000",
                                        },
                                    ],
                                    {
                                        talla_id: selectedCostSizeId || "",
                                    }
                                )
                            }
                            onEdit={(item) =>
                                handleOpenModal(
                                    "edit_labor",
                                    "Editar fase de mano de obra",
                                    [
                                        {
                                            name: "fase_id",
                                            label: "Fase",
                                            type: "select",
                                            options: laborPhaseOptions,
                                        },
                                        laborTallaField,
                                        { name: "cantidad", label: "Cantidad", type: "number" },
                                        { name: "unit_price", label: "Precio unitario", type: "number" },
                                    ],
                                    {
                                        ...item,
                                        fase_id: item.fase_id || item.fase,
                                        talla_id: item.talla_id || "",
                                        cantidad: formatForInput(item.cantidad),
                                        unit_price: formatForInput(item.unit_price),
                                    }
                                )
                            }
                            onDelete={(id) => deleteLabor(id, activeVariantId)}
                        />
                    </>
                )}

                <ModalForm
                    key={`${modalConfig.type}-${modalConfig.initialData?.id ?? "new"}-${modalConfig.isOpen}`}
                    isOpen={modalConfig.isOpen}
                    title={modalConfig.title}
                    fields={modalConfig.fields}
                    initialData={modalConfig.initialData}
                    onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
                    onSubmit={handleSubmit}
                />
            </div>
        </AppLayout>
    );
}
