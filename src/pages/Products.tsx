import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, X, Loader2, Package, Tag, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

import { useGetLineProducts, type LineProduct } from "@/hooks/useGetLineProducts";
import { useCreateLineProduct } from "@/hooks/useCreateLineProduct";
import { useUpdateProduct } from "@/hooks/useUpdateProduct";
import { useDeleteProduct } from "@/hooks/useDeleteProduct";
import { useGetProductLines } from "@/hooks/useGetProductLines";
import type { ProductVariant } from "@/types/variant";

interface ProductFormData {
    name: string;
    code: string;
}

const emptyForm: ProductFormData = { name: "", code: "" };

export default function Products() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const lineCode = searchParams.get("lineCode") || undefined;

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createFormData, setCreateFormData] = useState<ProductFormData>(emptyForm);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<LineProduct | null>(null);
    const [editFormData, setEditFormData] = useState<ProductFormData>(emptyForm);
    const [deletingProduct, setDeletingProduct] = useState<LineProduct | null>(null);
    const [openingProductId, setOpeningProductId] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState("");

    const { lines, isLoading: isLinesLoading } = useGetProductLines();
    const currentLine = lines.find((line) => line.code === lineCode);
    const lineId = currentLine?.id;

    const { products, isLoading, error, refetch } = useGetLineProducts(lineId);
    const { createLineProduct, isLoading: isCreating } = useCreateLineProduct();
    const { updateProduct, isLoading: isUpdating } = useUpdateProduct();
    const { deleteProduct, isLoading: isDeleting } = useDeleteProduct();

    useEffect(() => {
        if (!lineCode) navigate("/lines");
    }, [lineCode, navigate]);

    useEffect(() => {
        if (error) toast.error("No se pudieron cargar los productos de la línea.");
    }, [error]);

    const filteredProducts = useMemo(() => {
        const term = searchInput.trim().toLowerCase();
        if (!term) return products;
        return products.filter(
            (p) => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)
        );
    }, [products, searchInput]);

    const isCreateFormValid =
        createFormData.name.trim().length > 0 && createFormData.code.trim().length > 0;

    const hasEditChanges = editingProduct
        ? editFormData.name.trim() !== editingProduct.name.trim() ||
          editFormData.code.trim().toUpperCase() !== editingProduct.code.trim().toUpperCase()
        : false;

    const isEditFormValid =
        editFormData.name.trim().length > 0 && editFormData.code.trim().length > 0 && hasEditChanges;

    const openEditModal = (product: LineProduct) => {
        setEditingProduct(product);
        setEditFormData({ name: product.name, code: product.code });
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingProduct(null);
        setEditFormData(emptyForm);
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lineId || !isCreateFormValid) return;

        const result = await createLineProduct(lineId, {
            name: createFormData.name.trim(),
            code: createFormData.code.trim(),
        });

        if (result.success) {
            toast.success("Producto creado correctamente");
            setIsCreateModalOpen(false);
            setCreateFormData(emptyForm);
            refetch();
        } else {
            toast.error(result.error || "Error al crear el producto");
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lineId || !editingProduct || !isEditFormValid) return;

        const payload: { name?: string; code?: string } = {};
        const name = editFormData.name.trim();
        const code = editFormData.code.trim().toUpperCase();

        if (name !== editingProduct.name.trim()) payload.name = name;
        if (code !== editingProduct.code.trim().toUpperCase()) payload.code = code;

        const result = await updateProduct(editingProduct.id, lineId, payload);

        if (result.success) {
            toast.success("Producto actualizado correctamente");
            closeEditModal();
            refetch();
        } else {
            toast.error(result.error || "Error al actualizar el producto");
        }
    };

    const handleDeleteConfirm = async () => {
        if (!lineId || !deletingProduct) return;

        const result = await deleteProduct(deletingProduct.id, lineId);

        if (result.success) {
            toast.success("Producto eliminado correctamente");
            setDeletingProduct(null);
            refetch();
        } else {
            toast.error(result.error || "No se pudo eliminar el producto");
        }
    };

    const handleOpenProduct = async (product: LineProduct) => {
        setOpeningProductId(product.id);
        try {
            const variants = await http<ProductVariant[]>(
                endpoints.productos.variantes(product.id)
            );
            const query = lineCode ? `?lineCode=${encodeURIComponent(lineCode)}` : "";
            const firstVariant = variants?.[0];

            if (firstVariant) {
                navigate(`/products/${product.id}/variants/${firstVariant.id}/costing${query}`);
            } else {
                navigate(`/products/${product.id}${query}`);
            }
        } catch {
            toast.error("No se pudo cargar las variantes del producto");
        } finally {
            setOpeningProductId(null);
        }
    };

    const isPageLoading = isLinesLoading || isLoading;

    return (
        <AppLayout
            title={currentLine ? `Productos de ${currentLine.name}` : "Productos"}
            subtitle={currentLine ? `Línea: ${currentLine.code}` : "Catálogo comercial de referencias"}
        >
            <div className="space-y-4">
                <div className="flex justify-end">
                    <Button size="sm" onClick={() => setIsCreateModalOpen(true)} disabled={!lineId}>
                        <Plus className="h-4 w-4 mr-1" /> Nuevo Producto
                    </Button>
                </div>

                <div className="bg-card border rounded-xl p-4 shadow-sm flex gap-3 items-end">
                    <div className="flex-1 max-w-sm">
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                            Buscar por nombre o código
                        </label>
                        <Input
                            className="h-9 text-xs"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Ej. Camisa ejecutiva o CAM001"
                        />
                    </div>
                    {searchInput && (
                        <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={() => setSearchInput("")}>
                            <X className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                    )}
                </div>

                {isPageLoading ? (
                    <div className="flex justify-center pt-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : !currentLine ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                        No se encontró la línea con código &quot;{lineCode}&quot;.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProducts.map((product) => (
                            <Card key={product.id} className="hover:shadow-md transition-shadow border border-muted flex flex-col">
                                <CardContent className="p-5 flex flex-col gap-4 h-full">
                                    <div
                                        className="flex items-start gap-3 cursor-pointer"
                                        onClick={() => handleOpenProduct(product)}
                                    >
                                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                            {openingProductId === product.id ? (
                                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                            ) : (
                                                <Package className="h-5 w-5 text-primary" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm truncate">{product.name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Código {product.code}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between border-t pt-3 mt-auto">
                                        <span
                                            className="flex items-center gap-1 text-xs font-medium text-foreground cursor-pointer"
                                            onClick={() => handleOpenProduct(product)}
                                        >
                                            <Tag className="h-3 w-3" /> Variantes y tallas
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => openEditModal(product)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => setDeletingProduct(product)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {filteredProducts.length === 0 && (
                            <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
                                {searchInput
                                    ? "No se encontraron productos con ese criterio."
                                    : "No hay productos registrados en esta línea."}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between border-t pt-4 px-1 text-sm text-muted-foreground">
                    <span>Total: {filteredProducts.length}</span>
                </div>
            </div>

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Registrar Nuevo Producto</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
                        {currentLine && (
                            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                Línea: <span className="font-medium text-foreground">{currentLine.name}</span> ({currentLine.code})
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="create-product-name">Nombre del producto</Label>
                            <Input
                                id="create-product-name"
                                value={createFormData.name}
                                onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-product-code">Código interno</Label>
                            <Input
                                id="create-product-code"
                                value={createFormData.code}
                                onChange={(e) =>
                                    setCreateFormData({ ...createFormData, code: e.target.value.toUpperCase() })
                                }
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isCreating || !isCreateFormValid || !lineId}>
                            {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Guardar producto
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditModalOpen} onOpenChange={(open) => !open && closeEditModal()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar Producto</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit-product-name">Nombre</Label>
                            <Input
                                id="edit-product-name"
                                value={editFormData.name}
                                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-product-code">Código</Label>
                            <Input
                                id="edit-product-code"
                                value={editFormData.code}
                                onChange={(e) =>
                                    setEditFormData({ ...editFormData, code: e.target.value.toUpperCase() })
                                }
                                required
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" className="flex-1" onClick={closeEditModal}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="flex-1" disabled={isUpdating || !isEditFormValid}>
                                Guardar cambios
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará <strong>{deletingProduct?.name}</strong> (código {deletingProduct?.code}).
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteConfirm();
                            }}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Eliminando..." : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
