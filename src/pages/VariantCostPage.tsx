import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus, Pencil, Trash2 } from "lucide-react";

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

    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; title: string; fields: FieldDefinition[]; initialData?: any }>({
        isOpen: false,
        title: "",
        fields: []
    });

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
        setModalConfig({ isOpen: true, title, fields, initialData });
    };

    const handleSubmit = async (data: Record<string, string>) => {
        setModalConfig({ ...modalConfig, isOpen: false });
    };

    return (
        <AppLayout title="Líneas" subtitle="Configura variantes, tallas y estructura de costos del producto">
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate(-1)} className="pl-0"><ChevronLeft className="h-4 w-4 mr-1" /> Administrativa</Button>
                    <h2 className="text-xl font-bold">
                        {isProductLoading ? <span className="text-muted-foreground font-normal">Cargando producto...</span> : product?.name || "Producto"}
                    </h2>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                        <CardTitle className="text-sm font-bold">🏷️ Variantes</CardTitle>
                        <Button variant="outline" size="sm" onClick={() => handleOpenModal("new_variant", "Añadir Nueva Variante", [
                            { name: "name", label: "Nombre de Referencia", placeholder: "Ej. Variante Manga Larga", type: "text" },
                            { name: "estimated_cost", label: "Costo Estimado", placeholder: "18500", type: "number" },
                            { name: "talla", label: "Talla", placeholder: "S, M, L...", type: "text" },
                            { name: "color", label: "Color", placeholder: "Azul, Blanco...", type: "text" },
                            { name: "material", label: "Material", placeholder: "Algodón...", type: "text" },
                        ])}>
                            <Plus className="h-4 w-4 mr-2" /> Añadir variante
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {product?.variants?.map((v: any) => {
                            const isActive = v.id === variantId;
                            return (
                                <div key={v.id} className={`grid grid-cols-3 px-6 py-3 border-b items-center text-sm cursor-pointer hover:bg-muted/10 ${isActive ? "bg-muted/5 font-semibold" : ""}`} onClick={() => !isActive && navigate(`/products/${productId}/variants/${v.id}/costing`)}>
                                    <div className={isActive ? "text-primary font-bold" : "text-foreground"}>{v.code}</div>
                                    <div className="col-span-2 flex items-center justify-between">
                                        <span>{v.name} {isActive && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Activa</span>}</span>
                                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => handleOpenModal("edit_variant", "Editar Variante", [{ name: "name", label: "Nombre", type: "text" }, { name: "estimated_cost", label: "Costo", type: "number" }, { name: "talla", label: "Talla", type: "text" }, { name: "color", label: "Color", type: "text" }, { name: "material", label: "Material", type: "text" }], v)}><Pencil className="h-4 w-4" /></button>
                                            <button onClick={async () => { if (confirm("¿Eliminar?")) { await deleteVariant(productId!, v.id); refetchProduct?.(); } }}><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2"><SizeConsumptionTable data={sizeCons || []} variantId={variantId!} /></div>
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

                <FabricCostsTable
                    data={fabrics || []}
                    variantId={variantId!}
                    onAdd={async (payload) => { await addFabric(payload); return true; }}
                    onUpdate={async (id, data, vId) => { await updateFabric(id, data, vId); return true; }}
                    onDelete={async (id) => { await deleteFabric(id, variantId!); }}
                />

                <SuppliesTable
                    data={supplies || []}
                    variantId={variantId!}
                    onAdd={() => handleOpenModal("supply", "Nuevo Insumo", [
                        { name: "description", label: "Desc", type: "text" },
                        { name: "quantity", label: "Cant", type: "number" },
                        { name: "unit_price", label: "Precio", type: "number" }
                    ])}
                    onEdit={(d) => handleOpenModal("supply", "Editar Insumo", [
                        { name: "description", label: "Desc", type: "text" },
                        { name: "quantity", label: "Cant", type: "number" },
                        { name: "unit_price", label: "Precio", type: "number" }
                    ], d)}
                    onUpdate={async (id, data, vId) => { await updateSupply(id, data, vId); return true; }}
                    onDelete={(id) => deleteSupply(id, variantId!)}
                />

                <LaborCostsTable
                    data={labor || []}
                    variantId={variantId!}
                    onAdd={() => handleOpenModal("labor", "Nueva Fase", [
                        { name: "activity_name", label: "Actividad", type: "text" },
                        { name: "total", label: "Total", type: "number" }
                    ])}
                    onEdit={(d) => handleOpenModal("labor", "Editar Fase", [
                        { name: "activity_name", label: "Actividad", type: "text" },
                        { name: "total", label: "Total", type: "number" }
                    ], d)}
                    onUpdate={async (id, data, vId) => { await updateLabor(id, data, vId); return true; }}
                    onDelete={async (id) => { await deleteLabor(id, variantId!); }}
                />

                <ModalForm
                    isOpen={modalConfig.isOpen}
                    title={modalConfig.title}
                    fields={modalConfig.fields}
                    initialData={modalConfig.initialData}
                    onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                    onSubmit={handleSubmit}
                />
            </div>
        </AppLayout>
    );
}