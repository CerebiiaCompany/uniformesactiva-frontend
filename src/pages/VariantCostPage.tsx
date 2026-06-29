import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

// Hooks
import { useGetProductDetail } from "@/hooks/useGetProductDetail";
import { useGetFabricCosts } from "@/hooks/useGetFabricCosts";
import { useGetLaborCosts } from "@/hooks/useGetLaborCosts";
import { useGetSizeConsumption } from "@/hooks/useGetSizeConsumption";
import { useGetSupplyCosts } from "@/hooks/useGetSupplyCosts";
import { useFabricCosts } from "@/hooks/useFabricCost";
import { useSupplyCosts } from "@/hooks/useSupplyCosts";
import { useLaborCosts } from "@/hooks/useLaborCosts";
import { useSizeConsumption } from "@/hooks/useSizeConsumption";
import { useCreateVariant } from "@/hooks/useCreateVariant";
import { useEditVariant } from "@/hooks/useEditVariant";
import { useDeleteVariant } from "@/hooks/useDeleteVariant";

// Componentes
import { FabricCostsTable } from "@/components/variant-cost/FabricCostsTable";
import { SuppliesTable } from "@/components/variant-cost/SuppliesTable";
import { LaborCostsTable } from "@/components/variant-cost/LaborCostsTable";
import { SizeConsumptionTable } from "@/components/variant-cost/SizeConsumptionTable";
import { ModalForm, FieldDefinition } from "@/components/ui/ModalForm";

export default function VariantCostPage() {
    const { productId, variantId } = useParams<{ productId: string; variantId: string }>();
    const navigate = useNavigate();

    const { product, isLoading: isProductLoading, refetch: refetchProduct } = useGetProductDetail(productId);

    const { createVariant } = useCreateVariant();
    const { editVariant } = useEditVariant();
    const { deleteVariant } = useDeleteVariant();

    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; type: string; title: string; fields: FieldDefinition[]; initialData?: any }>({ isOpen: false, type: "", title: "", fields: [] });

    const { data: fabrics } = useGetFabricCosts(variantId!);
    const { data: labor } = useGetLaborCosts(variantId!);
    const { data: sizeCons } = useGetSizeConsumption(variantId!);
    const { data: supplies } = useGetSupplyCosts(variantId!);

    const { addFabric, updateFabric, deleteFabric } = useFabricCosts();
    const { addSupply, updateSupply, deleteSupply } = useSupplyCosts();
    const { addLabor, updateLabor, deleteLabor } = useLaborCosts();
    const { addSizeConsumption, updateSizeConsumption, deleteSizeConsumption } = useSizeConsumption();

    const { totalFabric, totalSupplies, totalLabor, grandTotal } = useMemo(() => {
        const tf = fabrics?.reduce((acc: number, f: any) => acc + (Number(f.total) || 0), 0) || 0;
        const ts = supplies?.reduce((acc: number, s: any) => acc + (Number(s.total) || 0), 0) || 0;
        const tl = labor?.reduce((acc: number, l: any) => acc + (Number(l.total) || 0), 0) || 0;
        return { totalFabric: tf, totalSupplies: ts, totalLabor: tl, grandTotal: tf + ts + tl };
    }, [fabrics, supplies, labor]);

    const handleOpenModal = (type: string, title: string, fields: FieldDefinition[], initialData?: any) => {
        setModalConfig({ isOpen: true, type, title, fields, initialData });
    };

    const handleSubmit = async (data: Record<string, string>) => {
        const { type, initialData } = modalConfig;
        const isEditing = !!initialData;

        try {
            if (type === "new_variant") {
                const payload = {
                    name: data.name,
                    estimated_cost: Number(data.estimated_cost) || 0,
                    attributes: {
                        talla: data.talla,
                        color: data.color,
                        material: data.material
                    }
                };

                const result = await createVariant(productId!, payload);
                if (result.success) {
                    toast.success("Variante añadida correctamente");
                    refetchProduct?.();
                } else {
                    toast.error("Error al añadir la variante");
                }
            } else if (type === "edit_variant") {
                const payload = {
                    name: data.name,
                    estimated_cost: Number(data.estimated_cost) || 0,
                    attributes: {
                        talla: data.talla,
                        color: data.color,
                        material: data.material
                    }
                };

                const result = await editVariant(productId!, initialData.id, payload);
                if (result.success) {
                    toast.success("Variante modificada correctamente");
                    refetchProduct?.();
                } else {
                    toast.error(result.error || "Error al modificar la variante");
                }
            } else if (type === "fabric") {
                const payload = isEditing ? { ...initialData, ...data, variant_id: variantId! } : { ...data, variant_id: variantId! };
                isEditing ? await updateFabric(initialData.id, payload, variantId!) : await addFabric(payload as any);
            } else if (type === "supply") {
                const payload = isEditing ? { ...initialData, ...data, variant_id: variantId! } : { ...data, variant_id: variantId! };
                isEditing ? await updateSupply(initialData.id, payload, variantId!) : await addSupply(payload as any);
            } else if (type === "labor") {
                const payload = isEditing ? { ...initialData, ...data, variant_id: variantId! } : { ...data, variant_id: variantId! };
                isEditing ? await updateLabor(initialData.id, payload, variantId!) : await addLabor(payload as any);
            } else if (type === "size") {
                const payload = isEditing ? { ...initialData, ...data, variant_id: variantId! } : { ...data, variant_id: variantId! };
                isEditing ? await updateSizeConsumption(initialData.id, payload, variantId!) : await addSizeConsumption(payload as any);
            }
            setModalConfig({ ...modalConfig, isOpen: false });
        } catch (error) {
            console.error("Error al guardar:", error);
            toast.error("Ocurrió un error inesperado.");
        }
    };

    return (
        <AppLayout title="Líneas" subtitle="Configura variantes, tallas y estructura de costos del producto">
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate(-1)} className="pl-0"><ChevronLeft className="h-4 w-4 mr-1" /> Administrativa</Button>
                    <h2 className="text-xl font-bold">
                        {isProductLoading ? (
                            <span className="text-muted-foreground font-normal">Cargando producto...</span>
                        ) : (
                            product?.name || "Producto"
                        )}
                    </h2>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                        <CardTitle className="text-sm font-bold">🏷️ Variantes</CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenModal(
                                "new_variant",
                                "Añadir Nueva Variante",
                                [
                                    { name: "name", label: "Nombre de Referencia", placeholder: "Ej. Variante Manga Larga", type: "text" },
                                    { name: "estimated_cost", label: "Costo Estimado", placeholder: "18500", type: "number" },
                                    { name: "talla", label: "Talla", placeholder: "S, M, L...", type: "text" },
                                    { name: "color", label: "Color", placeholder: "Azul, Blanco...", type: "text" },
                                    { name: "material", label: "Material", placeholder: "Algodón...", type: "text" },
                                ]
                            )}
                        >
                            <Plus className="h-4 w-4 mr-2" /> Añadir variante
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-3 px-6 py-2 border-b text-sm text-muted-foreground">
                            <div>Código</div>
                            <div className="col-span-2">Variante</div>
                        </div>

                        {isProductLoading ? (
                            <div className="flex justify-center py-6">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            </div>
                        ) : product?.variants?.length === 0 ? (
                            <div className="text-center py-6 text-xs text-muted-foreground">Sin variantes registradas.</div>
                        ) : (
                            product?.variants?.map((v: any) => {
                                const isActive = v.id === variantId;
                                return (
                                    <div key={v.id} className={`grid grid-cols-3 px-6 py-3 border-b items-center text-sm cursor-pointer hover:bg-muted/10 transition-colors ${isActive ? "bg-muted/5 font-semibold" : ""}`} onClick={() => !isActive && navigate(`/products/${productId}/variants/${v.id}/costing`)}>
                                        <div className={isActive ? "text-primary font-bold" : "text-foreground"}>{v.code}</div>
                                        <div className="col-span-2 flex items-center justify-between">
                                            <span className={isActive ? "text-foreground" : "text-muted-foreground"}>{v.name} {isActive && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-normal">Activa</span>}</span>
                                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleOpenModal(
                                                        "edit_variant",
                                                        "Editar Variante",
                                                        [
                                                            { name: "name", label: "Nombre de Referencia", placeholder: "Ej. Variante Manga Larga", type: "text" },
                                                            { name: "estimated_cost", label: "Costo Estimado", placeholder: "18500", type: "number" },
                                                            { name: "talla", label: "Talla", placeholder: "S, M, L...", type: "text" },
                                                            { name: "color", label: "Color", placeholder: "Azul, Blanco...", type: "text" },
                                                            { name: "material", label: "Material", placeholder: "Algodón...", type: "text" },
                                                        ],
                                                        {
                                                            id: v.id,
                                                            name: v.name,
                                                            estimated_cost: v.estimated_cost,
                                                            talla: v.attributes?.talla || "",
                                                            color: v.attributes?.color || "",
                                                            material: v.attributes?.material || "",
                                                        }
                                                    )}
                                                    className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                                    title="Editar variante"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`¿Estás seguro de que deseas eliminar la variante "${v.name}"?`)) {
                                                            const result = await deleteVariant(productId!, v.id);
                                                            if (result.success) {
                                                                toast.success("Variante eliminada correctamente");
                                                                if (isActive) {
                                                                    const remaining = product?.variants?.filter((x: any) => x.id !== v.id);
                                                                    if (remaining && remaining.length > 0) {
                                                                        navigate(`/products/${productId}/variants/${remaining[0].id}/costing`);
                                                                    } else {
                                                                        navigate(-1);
                                                                    }
                                                                } else {
                                                                    refetchProduct?.();
                                                                }
                                                            } else {
                                                                toast.error(result.error || "No se pudo eliminar la variante");
                                                            }
                                                        }
                                                    }}
                                                    className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                                                    title="Eliminar variante"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <SizeConsumptionTable data={sizeCons || []} variantId={variantId!}
                            onAdd={() => handleOpenModal("size", "Nueva Talla", [{ name: "size_id", label: "ID Talla", type: "text" }, { name: "consumption", label: "Consumo", type: "number" }])}
                            onEdit={(d) => handleOpenModal("size", "Editar Talla", [{ name: "size_id", label: "ID Talla", type: "text" }, { name: "consumption", label: "Consumo", type: "number" }], d)}
                            onDelete={(id) => deleteSizeConsumption(id, variantId!)}
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <Card className="h-full">
                            <CardHeader><CardTitle className="text-sm font-bold">🧮 Costo y precio</CardTitle></CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div className="flex justify-between"><span>Tela</span><span>${totalFabric.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span>Insumos</span><span>${totalSupplies.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span>Mano de obra</span><span>${totalLabor.toFixed(2)}</span></div>
                                <div className="border-t pt-2 font-bold flex justify-between"><span>Costo base</span><span>${grandTotal.toFixed(2)}</span></div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
                <div className="space-y-6">
                    <FabricCostsTable data={fabrics || []} variantId={variantId!}
                        onAdd={() => handleOpenModal("fabric", "Nueva Tela", [{ name: "provider", label: "Proveedor", type: "text" }, { name: "reference", label: "Ref", type: "text" }, { name: "meters", label: "Metros", type: "number" }, { name: "price_per_meter", label: "Precio/M", type: "number" }])}
                        onEdit={(d) => handleOpenModal("fabric", "Editar Tela", [{ name: "provider", label: "Proveedor", type: "text" }, { name: "reference", label: "Ref", type: "text" }, { name: "meters", label: "Metros", type: "number" }, { name: "price_per_meter", label: "Precio/M", type: "number" }], d)}
                        onDelete={(id) => deleteFabric(id, variantId!)}
                    />
                    <SuppliesTable data={supplies || []} variantId={variantId!}
                        onAdd={() => handleOpenModal("supply", "Nuevo Insumo", [{ name: "description", label: "Desc", type: "text" }, { name: "quantity", label: "Cant", type: "number" }, { name: "unit_price", label: "Precio", type: "number" }])}
                        onEdit={(d) => handleOpenModal("supply", "Editar Insumo", [{ name: "description", label: "Desc", type: "text" }, { name: "quantity", label: "Cant", type: "number" }, { name: "unit_price", label: "Precio", type: "number" }], d)}
                        onDelete={(id) => deleteSupply(id, variantId!)}
                    />
                    <LaborCostsTable data={labor || []} variantId={variantId!}
                        onAdd={() => handleOpenModal("labor", "Nueva Fase", [{ name: "activity_name", label: "Actividad", type: "text" }, { name: "unit_price", label: "Precio", type: "number" }])}
                        onEdit={(d) => handleOpenModal("labor", "Editar Fase", [{ name: "activity_name", label: "Actividad", type: "text" }, { name: "unit_price", label: "Precio", type: "number" }], d)}
                        onDelete={(id) => deleteLabor(id, variantId!)}
                    />
                </div>
                <ModalForm {...modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} onSubmit={handleSubmit} />
            </div>
        </AppLayout>
    );
}