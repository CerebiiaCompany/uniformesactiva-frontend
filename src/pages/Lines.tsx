import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, Plus, Package, Pencil, Trash2 } from "lucide-react";
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
import { toast } from "sonner";
import { useGetProductLines } from "@/hooks/useGetProductLines";
import { useCreateLine } from "@/hooks/useCreateLine";
import { useUpdateLine } from "@/hooks/useUpdateLine";
import { useDeleteLine } from "@/hooks/useDeleteLine";

interface LineFormData {
    name: string;
    code: string;
}

interface LineItem {
    id: string;
    code: string;
    name: string;
    products_count?: number;
}

const emptyForm: LineFormData = { name: "", code: "" };

export default function Lines() {
    const navigate = useNavigate();
    const { lines, isLoading, error, refetch } = useGetProductLines();
    const { createLine, isLoading: isCreating } = useCreateLine();
    const { updateLine, isLoading: isUpdating } = useUpdateLine();
    const { deleteLine, isLoading: isDeleting } = useDeleteLine();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createFormData, setCreateFormData] = useState<LineFormData>(emptyForm);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLine, setEditingLine] = useState<LineItem | null>(null);
    const [editFormData, setEditFormData] = useState<LineFormData>(emptyForm);

    const [deletingLine, setDeletingLine] = useState<LineItem | null>(null);

    useEffect(() => {
        if (error) {
            toast.error("No se pudieron cargar las líneas de producto");
        }
    }, [error]);

    const isCreateFormValid =
        createFormData.name.trim().length > 0 && createFormData.code.trim().length > 0;

    const hasEditChanges = editingLine
        ? editFormData.name.trim() !== editingLine.name.trim() ||
          editFormData.code.trim().toUpperCase() !== editingLine.code.trim().toUpperCase()
        : false;

    const isEditFormValid =
        editFormData.name.trim().length > 0 &&
        editFormData.code.trim().length > 0 &&
        hasEditChanges;

    const openEditModal = (line: LineItem) => {
        setEditingLine(line);
        setEditFormData({ name: line.name, code: line.code });
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingLine(null);
        setEditFormData(emptyForm);
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isCreateFormValid) return;

        const result = await createLine({
            name: createFormData.name.trim(),
            code: createFormData.code.trim().toUpperCase(),
        });

        if (result.success) {
            toast.success("Línea creada correctamente");
            setIsCreateModalOpen(false);
            setCreateFormData(emptyForm);
            refetch();
        } else {
            toast.error(result.error || "Error al crear la línea. Verifique que el código no esté duplicado.");
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingLine || !isEditFormValid) return;

        const payload: { name?: string; code?: string } = {};
        const trimmedName = editFormData.name.trim();
        const trimmedCode = editFormData.code.trim().toUpperCase();

        if (trimmedName !== editingLine.name.trim()) {
            payload.name = trimmedName;
        }
        if (trimmedCode !== editingLine.code.trim().toUpperCase()) {
            payload.code = trimmedCode;
        }

        const result = await updateLine(editingLine.id, payload);

        if (result.success) {
            toast.success("Línea actualizada correctamente");
            closeEditModal();
            refetch();
        } else {
            toast.error(result.error || "Error al actualizar la línea.");
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deletingLine) return;

        const result = await deleteLine(deletingLine.id);

        if (result.success) {
            toast.success("Línea eliminada correctamente");
            setDeletingLine(null);
            refetch();
        } else {
            toast.error(result.error || "No se pudo eliminar la línea.");
        }
    };

    return (
        <AppLayout title="Líneas de Producto" subtitle="Selecciona una línea para gestionar sus productos">
            <div className="flex justify-end mb-6">
                <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Nueva Línea
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center pt-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lines.map((line: LineItem) => {
                        const initialLetter = line.name ? line.name.trim().charAt(0).toUpperCase() : "";

                        return (
                            <Card
                                key={line.id}
                                className="hover:shadow-md transition-shadow border border-muted hover:border-primary/50 flex flex-col justify-between"
                            >
                                <CardContent className="p-5 flex flex-col gap-6 h-full justify-between">
                                    <div
                                        className="flex items-center justify-between cursor-pointer"
                                        onClick={() => navigate(`/products?lineCode=${line.code}`)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                navigate(`/products?lineCode=${line.code}`);
                                            }
                                        }}
                                        aria-label={`Abrir línea ${line.name}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-lg shrink-0">
                                                {initialLetter}
                                            </div>
                                            <div className="flex flex-col">
                                                <h3 className="font-semibold text-sm text-foreground">
                                                    {line.name}
                                                </h3>
                                                <span className="text-xs text-muted-foreground mt-0.5">
                                                    Código {line.code}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-muted/40 mt-auto">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Package className="h-4 w-4" />
                                            <span>{line.products_count ?? 0} productos</span>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                title="Editar línea"
                                                onClick={() => openEditModal(line)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                title="Eliminar línea"
                                                onClick={() => setDeletingLine(line)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {lines.length === 0 && !error && (
                        <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
                            No se encontraron líneas de producto registradas.
                        </div>
                    )}
                </div>
            )}

            {/* Modal crear */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Registrar Nueva Línea</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="create-name">Nombre de la línea</Label>
                            <Input
                                id="create-name"
                                placeholder="Ej: Uniformes escolares"
                                value={createFormData.name}
                                onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-code">Código</Label>
                            <Input
                                id="create-code"
                                placeholder="Ej: UES"
                                value={createFormData.code}
                                onChange={(e) =>
                                    setCreateFormData({ ...createFormData, code: e.target.value.toUpperCase() })
                                }
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isCreating || !isCreateFormValid}>
                            {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Guardar Línea
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal editar */}
            <Dialog
                open={isEditModalOpen}
                onOpenChange={(open) => {
                    if (!open) closeEditModal();
                }}
            >
                <DialogContent className="max-w-md z-[100]">
                    <DialogHeader>
                        <DialogTitle>Editar Línea</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Nombre de la línea</Label>
                            <Input
                                id="edit-name"
                                placeholder="Nombre de la línea"
                                value={editFormData.name}
                                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-code">Código</Label>
                            <Input
                                id="edit-code"
                                placeholder="Código (ej: UES)"
                                value={editFormData.code}
                                onChange={(e) =>
                                    setEditFormData({ ...editFormData, code: e.target.value.toUpperCase() })
                                }
                                required
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={closeEditModal}
                                disabled={isUpdating}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" className="flex-1" disabled={isUpdating || !isEditFormValid}>
                                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Guardar cambios
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirmación eliminar */}
            <AlertDialog open={!!deletingLine} onOpenChange={(open) => !open && setDeletingLine(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar línea?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deletingLine && (deletingLine.products_count ?? 0) > 0 ? (
                                <>
                                    La línea <strong>{deletingLine.name}</strong> tiene{" "}
                                    {deletingLine.products_count} producto(s) asociado(s). No podrá eliminarse
                                    hasta que no tenga productos vinculados.
                                </>
                            ) : (
                                <>
                                    Esta acción eliminará permanentemente la línea{" "}
                                    <strong>{deletingLine?.name}</strong> (código {deletingLine?.code}).
                                    No se puede deshacer.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteConfirm();
                            }}
                            disabled={isDeleting || (deletingLine?.products_count ?? 0) > 0}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Eliminando...
                                </>
                            ) : (
                                "Eliminar"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
