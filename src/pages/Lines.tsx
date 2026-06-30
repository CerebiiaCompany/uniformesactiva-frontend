import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, Plus, Package, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useGetProductLines } from "@/hooks/useGetProductLines";
import { useCreateLine } from "@/hooks/useCreateLine";

export default function Lines() {
    const navigate = useNavigate();
    const { lines, isLoading, error, refetch } = useGetProductLines();
    const { createLine, isLoading: isCreating } = useCreateLine();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: "", code: "" });

    useEffect(() => {
        if (error) {
            toast.error("No se pudieron cargar las líneas de producto");
        }
    }, [error]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await createLine(formData);
        if (result.success) {
            toast.success("Línea creada correctamente");
            setIsModalOpen(false);
            refetch();
            setFormData({ name: "", code: "" });
        } else {
            toast.error("Error al crear la línea. Verifique que el código no esté duplicado.");
        }
    };

    return (
        <AppLayout title="Líneas de Producto" subtitle="Selecciona una línea para gestionar sus productos">
            <div className="flex justify-end mb-6">
                <Button size="sm" onClick={() => setIsModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Nueva Línea
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center pt-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lines.map((line: any) => {
                        // Obtenemos la inicial del nombre de la línea
                        const initialLetter = line.name ? line.name.trim().charAt(0).toUpperCase() : "";

                        return (
                            <Card
                                key={line.id}
                                className="hover:shadow-md transition-shadow cursor-pointer border border-muted hover:border-primary/50 flex flex-col justify-between"
                                onClick={() => navigate(`/products?lineCode=${line.code}`)}
                                role="button"
                                aria-label={`Abrir línea ${line.name}`}
                            >
                                <CardContent className="p-5 flex flex-col gap-6 h-full justify-between">
                                    {/* FILA SUPERIOR: Inicial, Nombre, Código y Flecha */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {/* Contenedor de la Letra Inicial */}
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-lg shrink-0">
                                                {initialLetter}
                                            </div>
                                            {/* Información de la Línea */}
                                            <div className="flex flex-col">
                                                <h3 className="font-semibold text-sm text-foreground">
                                                    {line.name}
                                                </h3>
                                                <span className="text-xs text-muted-foreground mt-0.5">
                                                    Código {line.code}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Flecha de navegación */}
                                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                                    </div>

                                    {/* FILA INFERIOR: Conteo de productos y Acciones */}
                                    <div className="flex items-center justify-between pt-3 border-t border-muted/40 mt-auto">
                                        {/* Conteo de Productos */}
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Package className="h-4 w-4" />
                                            <span>{line.products_count ?? 0} productos</span>
                                        </div>

                                        {/* Botones de Acción (Editar y Eliminar) */}
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log("Editar línea", line.id);
                                                }}
                                                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                                title="Editar línea"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log("Eliminar línea", line.id);
                                                }}
                                                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                                title="Eliminar línea"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
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

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Registrar Nueva Línea</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <Input
                            placeholder="Nombre de la línea"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                        <Input
                            placeholder="Código (ej: A1)"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            required
                        />
                        <Button type="submit" className="w-full" disabled={isCreating}>
                            {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Guardar Línea
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}