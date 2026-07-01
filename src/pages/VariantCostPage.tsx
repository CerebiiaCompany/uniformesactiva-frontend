import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useCreateProveedor } from "@/hooks/useCreateProveedor";
import { useCreateVariant } from "@/hooks/useCreateVariant";

import { FabricCostsTable } from "@/components/variant-cost/FabricCostsTable";
import { SuppliesTable } from "@/components/variant-cost/SuppliesTable";
import { LaborCostsTable } from "@/components/variant-cost/LaborCostsTable";
import { SizeConsumptionTable } from "@/components/variant-cost/SizeConsumptionTable";
import { ModalForm, FieldDefinition } from "@/components/ui/ModalForm";
import { normalizeDecimalInput } from "@/lib/decimal-input";
import { formatCurrency, formatDecimal, formatForInput } from "@/lib/format-number";

type ModalType =
    | "new_variant"
    | "supply"
    | "edit_supply"
    | "edit_fabric"
    | "labor"
    | "edit_labor"
    | "new_proveedor"
    | "";

export default function VariantCostPage() {
    const { productId, variantId } = useParams<{ productId: string; variantId?: string }>();
    const [searchParams] = useSearchParams();
    const lineCode = searchParams.get("lineCode");
    const navigate = useNavigate();

    const { product, isLoading: isProductLoading } = useGetProductDetail(productId);
    const { variants, isLoading: isVariantsLoading, refetch: refetchVariants } = useGetVariants(productId);
    const { sizes, supplyTypes, laborPhases, proveedores, refetchProveedores } = useGetCostCatalogs();
    const { createProveedor } = useCreateProveedor();

    const { createVariant } = useCreateVariant();
    const { addFabric, updateFabric, deleteFabric, setFabricPrincipal, loading: isFabricLoading } =
        useFabricCosts();
    const { addSupply, updateSupply, deleteSupply } = useSupplyCosts();
    const { addLabor, updateLabor, deleteLabor } = useLaborCosts();

    const activeVariantId = variantId ?? "";
    const hasActiveVariant = !!variantId;

    const { data: fabrics } = useGetFabricCosts(activeVariantId);
    const { data: labor } = useGetLaborCosts(activeVariantId);
    const { data: sizeCons } = useGetSizeConsumption(activeVariantId);
    const { data: supplies } = useGetSupplyCosts(activeVariantId);
    const { data: summary, isLoading: isSummaryLoading } = useGetCostSummary(activeVariantId);

    const formatMeters = (value: number) => formatDecimal(value);

    const fabricTotal = Number(summary?.fabric_total ?? 0);
    const suppliesTotal = Number(summary?.supplies_total ?? 0);
    const laborTotal = Number(summary?.labor_total ?? 0);
    const overallTotal = Number(summary?.overall_total ?? 0);
    const avgConsumption = Number(summary?.average_consumption ?? 0);
    const fabricPricePerMeter = Number(summary?.fabric_price_per_meter ?? 0);
    const showFabricBreakdown = avgConsumption > 0 && fabricPricePerMeter > 0;

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
                    quantity: data.quantity,
                    unit_price: data.unit_price,
                });
                if (ok) toast.success("Insumo agregado");
                else toast.error("No se pudo agregar el insumo");
            } else if (modalConfig.type === "edit_supply" && modalConfig.initialData?.id && hasActiveVariant) {
                const initial = modalConfig.initialData;
                const payload: Record<string, string> = {};
                const initialTipoId = initial.tipo_id || initial.tipo;

                if (data.tipo_id !== initialTipoId) payload.tipo_id = data.tipo_id;
                if (data.quantity !== initial.quantity) payload.quantity = data.quantity;
                if (data.unit_price !== initial.unit_price) payload.unit_price = data.unit_price;

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
                    cantidad: data.cantidad || "1",
                    unit_price: data.unit_price,
                });
                if (ok) toast.success("Fase de mano de obra agregada");
                else toast.error("No se pudo agregar la fase");
            } else if (modalConfig.type === "edit_labor" && modalConfig.initialData?.id) {
                const initial = modalConfig.initialData;
                const payload: Record<string, string> = {};
                const initialFaseId = initial.fase_id || initial.fase;

                if (data.fase_id !== initialFaseId) payload.fase_id = data.fase_id;
                if (data.cantidad !== initial.cantidad) payload.cantidad = data.cantidad;
                if (data.unit_price !== initial.unit_price) payload.unit_price = data.unit_price;

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
            }
        } finally {
            setModalConfig((prev) => ({ ...prev, isOpen: false }));
        }
    };

    const supplyTypeOptions = supplyTypes.map((t) => ({
        value: t.id,
        label: t.label || t.name,
    }));

    const laborPhaseOptions = laborPhases.map((f) => ({
        value: f.id,
        label: f.label || f.name,
    }));

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
                                        <div className="col-span-2 flex items-center justify-between">
                                            <span>
                                                {v.name}
                                                {isActive && (
                                                    <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                        Activa
                                                    </span>
                                                )}
                                            </span>
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
                                />
                            </div>
                            <div className="lg:col-span-1">
                                <Card className="h-full">
                                    <CardHeader>
                                        <CardTitle className="text-sm font-bold">Resumen de costos</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm">
                                        {isSummaryLoading && !summary ? (
                                            <div className="flex items-center gap-2 text-muted-foreground py-4">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Calculando resumen...
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between items-start gap-3">
                                                    <div>
                                                        <span>Tela</span>
                                                        {showFabricBreakdown && (
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {formatMeters(avgConsumption)} m × $
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
                                                <div className="border-t pt-2 font-bold flex justify-between text-base">
                                                    <span>Costo base</span>
                                                    <span>${formatCurrency(overallTotal)}</span>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

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
                            onCreateProveedor={() =>
                                handleOpenModal("new_proveedor", "Nuevo proveedor", [
                                    { name: "name", label: "Nombre del proveedor", type: "text", placeholder: "Textil del Norte" },
                                ])
                            }
                        />

                        <SuppliesTable
                            data={supplies || []}
                            onAdd={() =>
                                handleOpenModal("supply", "Nuevo insumo", [
                                    {
                                        name: "tipo_id",
                                        label: "Tipo de insumo",
                                        type: "select",
                                        options: supplyTypeOptions,
                                    },
                                    { name: "quantity", label: "Cantidad", type: "number", placeholder: "8" },
                                    { name: "unit_price", label: "Precio unitario", type: "number", placeholder: "3500" },
                                ])
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
                                        { name: "quantity", label: "Cantidad", type: "number" },
                                        { name: "unit_price", label: "Precio unitario", type: "number" },
                                    ],
                                    {
                                        ...item,
                                        tipo_id: item.tipo_id || item.tipo,
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
                                handleOpenModal("labor", "Nueva fase de mano de obra", [
                                    {
                                        name: "fase_id",
                                        label: "Fase",
                                        type: "select",
                                        options: laborPhaseOptions,
                                    },
                                    { name: "cantidad", label: "Cantidad", type: "number", placeholder: "1" },
                                    { name: "unit_price", label: "Precio unitario", type: "number", placeholder: "25000" },
                                ])
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
                                        { name: "cantidad", label: "Cantidad", type: "number" },
                                        { name: "unit_price", label: "Precio unitario", type: "number" },
                                    ],
                                    {
                                        ...item,
                                        fase_id: item.fase_id || item.fase,
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
