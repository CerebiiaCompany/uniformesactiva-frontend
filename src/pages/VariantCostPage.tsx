import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus, Pencil, Trash2 } from "lucide-react";

// Hooks
import { useGetFabricCosts } from "@/hooks/useGetFabricCosts";
import { useGetLaborCosts } from "@/hooks/useGetLaborCosts";
import { useGetSizeConsumption } from "@/hooks/useGetSizeConsumption";
import { useGetSupplyCosts } from "@/hooks/useGetSupplyCosts";
import { useFabricCosts } from "@/hooks/useFabricCost";
import { useSupplyCosts } from "@/hooks/useSupplyCosts";
import { useLaborCosts } from "@/hooks/useLaborCosts";
import { useSizeConsumption } from "@/hooks/useSizeConsumption";

// Componentes
import { FabricCostsTable } from "@/components/variant-cost/FabricCostsTable";
import { SuppliesTable } from "@/components/variant-cost/SuppliesTable";
import { LaborCostsTable } from "@/components/variant-cost/LaborCostsTable";
import { SizeConsumptionTable } from "@/components/variant-cost/SizeConsumptionTable";
import { ModalForm, FieldDefinition } from "@/components/ui/ModalForm";

export default function VariantCostPage() {
    const { variantId } = useParams<{ variantId: string }>();
    const navigate = useNavigate();

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
            if (type === "fabric") {
                const payload = isEditing ? { ...initialData, ...data, variant_id: variantId! } : { ...data, variant_id: variantId! };
                isEditing ? await updateFabric(initialData.id, payload, variantId!) : await addFabric(payload as any);
            }
            if (type === "supply") {
                const payload = isEditing ? { ...initialData, ...data, variant_id: variantId! } : { ...data, variant_id: variantId! };
                isEditing ? await updateSupply(initialData.id, payload, variantId!) : await addSupply(payload as any);
            }
            if (type === "labor") {
                const payload = isEditing ? { ...initialData, ...data, variant_id: variantId! } : { ...data, variant_id: variantId! };
                isEditing ? await updateLabor(initialData.id, payload, variantId!) : await addLabor(payload as any);
            }
            if (type === "size") {
                const payload = isEditing ? { ...initialData, ...data, variant_id: variantId! } : { ...data, variant_id: variantId! };
                isEditing ? await updateSizeConsumption(initialData.id, payload, variantId!) : await addSizeConsumption(payload as any);
            }
            setModalConfig({ ...modalConfig, isOpen: false });
        } catch (error) {
            console.error("Error al guardar:", error);
        }
    };

    return (
        <AppLayout title="Líneas" subtitle="Configura variantes, tallas y estructura de costos del producto">
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate(-1)} className="pl-0"><ChevronLeft className="h-4 w-4 mr-1" /> Administrativa</Button>
                    <h2 className="text-xl font-bold">Blusa <span className="text-muted-foreground font-normal">· {variantId}</span></h2>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                        <CardTitle className="text-sm font-bold">🏷️ Variantes</CardTitle>
                        <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" /> Añadir variante</Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-2 px-6 py-2 border-b text-sm text-muted-foreground"><div>Código</div><div>Variante</div></div>
                        <div className="px-6 py-3 border-b flex items-center justify-between">
                            <span className="text-red-600 font-medium">{variantId}</span><span>Variante activa</span>
                            <div className="flex gap-2"><Pencil className="h-4 w-4 text-muted-foreground cursor-pointer" /><Trash2 className="h-4 w-4 text-red-500 cursor-pointer" /></div>
                        </div>
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