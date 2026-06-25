import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderOpen, ChevronRight, Plus } from "lucide-react";
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
                    {lines.map((line: any) => (
                        <Card
                            key={line.id}
                            className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary"
                            onClick={() => navigate(`/products?lineCode=${line.code}`)}
                            role="button"
                            aria-label={`Abrir línea ${line.name}`}
                        >
                            <CardContent className="p-5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <FolderOpen className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm flex items-center gap-2">
                                            {line.name}
                                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                                                {line.code}
                                            </Badge>
                                        </h3>
                                        <p className="text-xs text-muted-foreground">{line.description || "Sin descripción"}</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    ))}

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