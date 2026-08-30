import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus, Trash2, HelpCircle, Layers } from "lucide-react";
import type { CIFCost, ExtraCost } from "@/types/variant";
import { formatCurrency, formatForInput } from "@/lib/format-number";
import { sanitizeDecimalTyping, normalizeDecimalInput } from "@/lib/decimal-input";

interface CIFCardProps {
    data: (CIFCost | ExtraCost)[];
    sizes: Array<{ id: string; name?: string; label?: string; code?: string }>;
    onSave: (cifData: { id?: string; unit_price: string; talla_id: string | null }) => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
}

const formatTalla = (item: Pick<CIFCost | ExtraCost, "talla_nombre" | "talla_id">) => {
    if (item.talla_id && item.talla_nombre) return item.talla_nombre;
    if (item.talla_id) return item.talla_id;
    return "Todas las tallas (compartido)";
};

export function CIFCard({ data, sizes, onSave, onDelete }: CIFCardProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CIFCost | ExtraCost | null>(null);
    const [amountInput, setAmountInput] = useState("");
    const [selectedTallaId, setSelectedTallaId] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const totalCIF = useMemo(() => {
        return data.reduce((sum, it) => sum + (Number(it.total) || Number(it.unit_price) || 0), 0);
    }, [data]);

    const handleOpenAdd = () => {
        setEditingItem(null);
        setAmountInput("");
        setSelectedTallaId(""); // Por defecto "Todas las tallas"
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (item: ExtraCost) => {
        setEditingItem(item);
        setAmountInput(formatForInput(item.unit_price));
        setSelectedTallaId(item.talla_id || "");
        setIsDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanAmount = normalizeDecimalInput(amountInput);
        if (!cleanAmount || Number(cleanAmount) <= 0) return;

        setIsSubmitting(true);
        try {
            const ok = await onSave({
                id: editingItem?.id,
                unit_price: cleanAmount,
                talla_id: selectedTallaId || null,
            });
            if (ok) {
                setIsDialogOpen(false);
                setEditingItem(null);
                setAmountInput("");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Card className="w-full border-dashed border-2 border-border/80 hover:border-primary/40 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between py-4 gap-3 bg-muted/10">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                            <Layers className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-base font-bold tracking-tight">
                                    CIF (Costos Indirectos de Fabricación)
                                </CardTitle>
                                {data.length > 0 && (
                                    <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full font-mono">
                                        ${formatCurrency(Math.round(totalCIF))}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                Gastos operativos, planta y servicios prorrateados por prenda
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {data.length === 0 ? (
                            <Button variant="outline" size="sm" onClick={handleOpenAdd} className="h-8 gap-1">
                                <Plus className="h-3.5 w-3.5" /> Configurar CIF
                            </Button>
                        ) : (
                            <Button variant="outline" size="sm" onClick={handleOpenAdd} className="h-8 gap-1">
                                <Plus className="h-3.5 w-3.5" /> Añadir CIF por talla
                            </Button>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="p-4">
                    {data.length > 0 ? (
                        <div className="space-y-2">
                            <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-muted-foreground border-b pb-2 px-1">
                                <div>Concepto</div>
                                <div>Alcance por talla</div>
                                <div className="text-right">Valor CIF</div>
                                <div className="w-16 text-center">Acciones</div>
                            </div>
                            {data.map((item) => (
                                <div
                                    key={item.id}
                                    className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 text-sm items-center border-b border-border/50 py-2.5 px-1 hover:bg-muted/20 rounded-md transition-colors"
                                >
                                    <div className="font-medium truncate text-foreground flex items-center gap-2">
                                        <span>Costos Indirectos de Fabricación (CIF)</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate font-medium">
                                        {formatTalla(item)}
                                    </div>
                                    <div className="text-right font-bold text-foreground font-mono">
                                        ${formatCurrency(item.unit_price)}
                                    </div>
                                    <div className="flex items-center justify-center gap-1.5 w-16">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                                            onClick={() => handleOpenEdit(item)}
                                            title="Editar valor CIF"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-red-600"
                                            onClick={() => onDelete(item.id)}
                                            title="Eliminar CIF"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-6 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                            <p className="text-sm">No se ha asignado valor de CIF para esta prenda.</p>
                            <Button variant="outline" size="sm" onClick={handleOpenAdd} className="h-8 gap-1.5 text-xs">
                                <Pencil className="h-3.5 w-3.5" /> Asignar CIF a la prenda
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal de Personalización de CIF */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold">
                            {editingItem ? "Editar CIF (Costos Indirectos)" : "Personalizar CIF (Costos Indirectos)"}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Define el valor de CIF a sumar en el costeo total de la prenda.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        {/* Alcance por talla */}
                        <div className="space-y-1.5">
                            <Label htmlFor="cif_talla" className="text-xs font-semibold text-foreground">
                                Alcance por talla
                            </Label>
                            <Select
                                value={selectedTallaId || "__ALL__"}
                                onValueChange={(val) => setSelectedTallaId(val === "__ALL__" ? "" : val)}
                            >
                                <SelectTrigger id="cif_talla" className="h-9 text-xs">
                                    <SelectValue placeholder="Todas las tallas (compartido)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__ALL__">Todas las tallas (compartido)</SelectItem>
                                    {sizes.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.label || s.name || s.code || s.id} (solo esta talla)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground">
                                Por defecto aplica a todas las tallas de la variante.
                            </p>
                        </div>

                        {/* Input de Personalización de Valor CIF */}
                        <div className="space-y-1.5">
                            <Label htmlFor="cif_amount" className="text-xs font-semibold text-foreground">
                                Valor CIF por prenda ($)
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                                    $
                                </span>
                                <Input
                                    id="cif_amount"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="Ej. 16243"
                                    value={amountInput}
                                    onChange={(e) => setAmountInput(sanitizeDecimalTyping(e.target.value))}
                                    className="pl-7 h-9 text-sm font-mono font-medium"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2 gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsDialogOpen(false)}
                                disabled={isSubmitting}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                disabled={isSubmitting || !amountInput}
                            >
                                {isSubmitting ? "Guardando..." : "Guardar CIF"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
