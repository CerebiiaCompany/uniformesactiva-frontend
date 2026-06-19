import { useState } from "react";
import CurrencyInput from "react-currency-input-field";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, X, Loader2, ChevronLeft, ChevronRight, Package, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useGetProducts } from "@/hooks/useGetProducts";
import { useCreateProduct } from "@/hooks/useCreateProduct";

// 1. Definimos las interfaces para el tipado del formulario
interface VariantForm {
    name: string;
    attributes: {
        talla: string;
        color: string;
        material: string;
    };
    estimated_cost: string;
}

interface ProductForm {
    name: string;
    description: string;
    variants: VariantForm[];
}

export default function Products() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    // Estados para el modal de detalle
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const { products, isLoading, refetch, pagination, filters } = useGetProducts();
    const { createProduct, isLoading: isCreating, error: apiError } = useCreateProduct();

    const [searchInputs, setSearchInputs] = useState({ name: "" });

    // 2. Actualizamos el estado inicial para soportar el arreglo de variantes
    const [formData, setFormData] = useState<ProductForm>({
        name: "",
        description: "",
        variants: []
    });

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInputs({ name: e.target.value });
    };

    const handleApplyFilters = (e: React.FormEvent) => {
        e.preventDefault();
        filters.update(searchInputs);
    };

    const handleClearFilters = () => {
        setSearchInputs({ name: "" });
        filters.update({ name: "" });
    };

    // 3. Funciones de control para las variantes dinámicas
    const addVariant = () => {
        setFormData({
            ...formData,
            variants: [
                ...formData.variants,
                {
                    name: formData.name ? `${formData.name} - Variante` : "",
                    attributes: { talla: "", color: "", material: "" },
                    estimated_cost: ""
                }
            ]
        });
    };

    const removeVariant = (index: number) => {
        const updatedVariants = [...formData.variants];
        updatedVariants.splice(index, 1);
        setFormData({ ...formData, variants: updatedVariants });
    };

    const handleVariantChange = (index: number, field: string, value: string, isAttribute = false) => {
        const updatedVariants = [...formData.variants];
        if (isAttribute) {
            updatedVariants[index].attributes = {
                ...updatedVariants[index].attributes,
                [field]: value
            };
        } else {
            updatedVariants[index] = {
                ...updatedVariants[index],
                [field]: value
            };
        }
        setFormData({ ...formData, variants: updatedVariants });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.variants.length === 0) {
            toast.error("Debes agregar al menos una variante al producto");
            return;
        }

        const payload = {
            ...formData,
            variants: formData.variants.map(v => ({
                ...v,
                estimated_cost: Number(v.estimated_cost) || 0
            }))
        };

        const result = await createProduct(payload);

        if (result.success) {
            toast.success("Producto creado exitosamente");
            setIsModalOpen(false);
            setFormData({ name: "", description: "", variants: [] });
            refetch();
        } else {
            toast.error(apiError || "Error al crear el producto");
        }
    };

    const hasActiveFilters = searchInputs.name !== "";

    return (
        <AppLayout title="Productos" subtitle="Catálogo comercial de referencias">
            <div className="space-y-4">
                <div className="flex justify-end">
                    <Button size="sm" onClick={() => setIsModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Nuevo Producto
                    </Button>
                </div>

                <form onSubmit={handleApplyFilters} className="bg-card border rounded-xl p-4 shadow-sm flex gap-3 items-end">
                    <div className="flex-1 max-w-sm">
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Buscar por Nombre</label>
                        <Input name="name" className="h-9 text-xs" value={searchInputs.name} onChange={handleSearchChange} placeholder="Ej. Camiseta Polo..." />
                    </div>
                    <div className="flex gap-1.5">
                        <Button type="submit" size="sm" className="h-9 px-3">
                            <Search className="h-3.5 w-3.5" />
                        </Button>
                        {hasActiveFilters && (
                            <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={handleClearFilters}>
                                <X className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                        )}
                    </div>
                </form>

                {isLoading ? (
                    <div className="flex justify-center pt-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {products.map((prod: any) => (
                            <Card
                                key={prod.id}
                                className="hover:shadow-md transition-shadow cursor-pointer"
                                aria-label={`Abrir detalle de ${prod.name}`}
                                onClick={() => {
                                    setSelectedProduct(prod);
                                    setIsDetailOpen(true);
                                }}
                            >
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-lg"><Package className="h-5 w-5 text-primary" /></div>
                                            <p className="font-semibold text-sm">{prod.name}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                                        {prod.description || "Sin descripción"}
                                    </p>
                                    <div className="flex items-center justify-between text-xs border-t pt-3">
                                        <span className="flex items-center gap-1 font-medium">
                                            <Tag className="h-3 w-3" /> {prod.variants?.length || 0} Variantes
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {products.length === 0 && !isLoading && (
                            <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
                                No se encontraron productos.
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between border-t pt-4 px-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                        <span>Total: {pagination.totalCount}</span>
                        <div className="flex items-center gap-2 border-l pl-4">
                            <span>Mostrar:</span>
                            <select
                                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                value={pagination.pageSize}
                                onChange={(e) => pagination.setPageSize(Number(e.target.value))}
                            >
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={25}>25</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={pagination.prevPage} disabled={!pagination.hasPrevious}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs px-2">Pág. {pagination.page}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={pagination.nextPage} disabled={!pagination.hasNext}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Modal de Registro */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Registrar Nuevo Producto</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Nombre Base del Producto</label>
                                <Input placeholder="Ej. Camiseta Polo Activa" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Descripción</label>
                                <Input placeholder="Ej. Camiseta polo de alta resistencia." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Tag className="h-3.5 w-3.5 text-primary" /> Configuración de Variantes
                                </h3>
                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={addVariant}>
                                    <Plus className="h-3 w-3 mr-1" /> Añadir Variante
                                </Button>
                            </div>

                            {formData.variants.length === 0 ? (
                                <div className="text-center py-6 border rounded-xl border-dashed text-xs text-muted-foreground">
                                    Presiona "Añadir Variante" para configurar tallas, colores y costos.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {formData.variants.map((variant, index) => (
                                        <div key={index} className="p-4 bg-muted/40 border rounded-xl relative space-y-3">
                                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeVariant(index)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>

                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="col-span-2">
                                                    <label className="text-[10px] font-medium text-muted-foreground">Nombre de Referencia</label>
                                                    <Input className="h-8 text-xs" placeholder="Ej. Camiseta Polo - Talla S - Azul" value={variant.name} onChange={(e) => handleVariantChange(index, "name", e.target.value)} required />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-muted-foreground">Costo Estimado</label>
                                                    <CurrencyInput customInput={Input} className="h-8 text-xs" placeholder="18500" prefix="$ " groupSeparator="." decimalSeparator="," decimalsLimit={2} value={variant.estimated_cost} onValueChange={(value) => handleVariantChange(index, "estimated_cost", value ?? "")} required />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-medium text-muted-foreground">Talla</label>
                                                    <Input className="h-8 text-xs" placeholder="S, M, L..." value={variant.attributes.talla} onChange={(e) => handleVariantChange(index, "talla", e.target.value, true)} required />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-muted-foreground">Color</label>
                                                    <Input className="h-8 text-xs" placeholder="Azul, Negro..." value={variant.attributes.color} onChange={(e) => handleVariantChange(index, "color", e.target.value, true)} required />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-muted-foreground">Material</label>
                                                    <Input className="h-8 text-xs" placeholder="Algodón..." value={variant.attributes.material} onChange={(e) => handleVariantChange(index, "material", e.target.value, true)} required />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Button type="submit" className="w-full" disabled={isCreating}>
                            {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Guardar Producto Completo
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal de Detalle del Producto */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedProduct?.name ?? "Detalle del producto"}</DialogTitle>
                    </DialogHeader>

                    <p className="text-sm text-muted-foreground mb-4">
                        {selectedProduct?.description || "Sin descripción"}
                    </p>

                    {selectedProduct?.variants?.length > 0 ? (
                        <div className="space-y-3">
                            {selectedProduct.variants.map((variant: any, idx: number) => (
                                <div key={variant.id ?? idx} className="p-4 bg-muted/20 border rounded-lg">
                                    <h4 className="font-medium mb-2">{variant.name}</h4>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div><strong>Talla:</strong> {variant.attributes?.talla ?? "-"}</div>
                                        <div><strong>Color:</strong> {variant.attributes?.color ?? "-"}</div>
                                        <div><strong>Material:</strong> {variant.attributes?.material ?? "-"}</div>
                                        <div><strong>Costo estimado:</strong> ${Number(variant.estimated_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">Sin variantes.</p>
                    )}

                    <div className="flex justify-end mt-4">
                        <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                            Cerrar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}