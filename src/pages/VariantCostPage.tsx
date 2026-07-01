import { useState, useMemo } from "react";
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

type ModalType = "new_variant" | "supply" | "labor" | "edit_labor" | "new_proveedor" | "";

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
    const { addFabric } = useFabricCosts();
    const { addSupply, deleteSupply } = useSupplyCosts();
    const { addLabor, updateLabor, deleteLabor } = useLaborCosts();

    const activeVariantId = variantId ?? "";
    const hasActiveVariant = !!variantId;

    const { data: fabrics } = useGetFabricCosts(activeVariantId);
    const { data: labor } = useGetLaborCosts(activeVariantId);
    const { data: sizeCons } = useGetSizeConsumption(activeVariantId);
    const { data: supplies } = useGetSupplyCosts(activeVariantId);

    const sumRecordTotals = (items: { total: string }[] | undefined) =>
        (items ?? []).reduce((acc, item) => acc + Number(item.total || 0), 0);

    const { totalTela, totalInsumos, totalManoObra, totalGeneral } = useMemo(() => {
        const tela = sumRecordTotals(fabrics);
        const insumos = sumRecordTotals(supplies);
        const manoObra = sumRecordTotals(labor);
        return {
            totalTela: tela,
            totalInsumos: insumos,
            totalManoObra: manoObra,
            totalGeneral: tela + insumos + manoObra,
        };
    }, [fabrics, supplies, labor]);

    const formatCurrency = (value: number) =>
        value.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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
                const ok = await updateLabor(
                    modalConfig.initialData.id,
                    {
                        fase_id: data.fase_id,
                        cantidad: data.cantidad,
                        unit_price: data.unit_price,
                    },
                    activeVariantId
                );
                if (ok) toast.success("Fase actualizada");
                else toast.error("No se pudo actualizar la fase");
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
                                        <p className="text-xs text-muted-foreground pb-1">
                                            Suma de los registros de tela, insumos y mano de obra.
                                        </p>
                                        <div className="flex justify-between">
                                            <span>Tela ({fabrics?.length ?? 0})</span>
                                            <span>${formatCurrency(totalTela)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Insumos ({supplies?.length ?? 0})</span>
                                            <span>${formatCurrency(totalInsumos)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Mano de obra ({labor?.length ?? 0})</span>
                                            <span>${formatCurrency(totalManoObra)}</span>
                                        </div>
                                        <div className="border-t pt-2 font-bold flex justify-between text-base">
                                            <span>Costo base</span>
                                            <span>${formatCurrency(totalGeneral)}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <FabricCostsTable
                            data={fabrics || []}
                            variantId={activeVariantId}
                            proveedores={proveedores}
                            onAdd={addFabric}
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
                                    { name: "quantity", label: "Cantidad", type: "number", placeholder: "2.000" },
                                    { name: "unit_price", label: "Precio unitario", type: "text", placeholder: "$3.500" },
                                ])
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
                                    { name: "cantidad", label: "Cantidad", type: "number", placeholder: "1.000" },
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
                                    }
                                )
                            }
                            onDelete={(id) => deleteLabor(id, activeVariantId)}
                        />
                    </>
                )}

                <ModalForm
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
