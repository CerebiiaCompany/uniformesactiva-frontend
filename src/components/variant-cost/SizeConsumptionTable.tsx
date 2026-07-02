import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CatalogOption, SizeFabric } from "@/types/variant";
import { formatForInput } from "@/lib/format-number";
import { useSizeConsumption } from "@/hooks/useSizeConsumption";
import { cn } from "@/lib/utils";

interface SizeTableProps {
    data: SizeFabric[];
    variantId: string;
    sizes: CatalogOption[];
    selectedSizeId?: string | null;
    onSelectedSizeChange?: (sizeId: string) => void;
}

type LocalSizeState = {
    consumption: string;
    dbId?: string;
    dirty?: boolean;
};

export function SizeConsumptionTable({
    data,
    variantId,
    sizes,
    selectedSizeId: controlledSelectedSizeId,
    onSelectedSizeChange,
}: SizeTableProps) {
    const { addSizeConsumption, updateSizeConsumption, deleteSizeConsumption, loading } =
        useSizeConsumption();
    const [localValues, setLocalValues] = useState<Record<string, LocalSizeState>>({});
    const [internalSelectedSizeId, setInternalSelectedSizeId] = useState<string>("");

    const selectedSizeId = controlledSelectedSizeId ?? internalSelectedSizeId;

    const setSelectedSizeId = (sizeId: string) => {
        if (onSelectedSizeChange) {
            onSelectedSizeChange(sizeId);
        } else {
            setInternalSelectedSizeId(sizeId);
        }
    };

    useEffect(() => {
        const newValues: Record<string, LocalSizeState> = {};

        sizes.forEach((size) => {
            newValues[size.id] = { consumption: "", dirty: false };
        });

        data.forEach((rec) => {
            if (!rec.size_id) return;
            newValues[rec.size_id] = {
                consumption: rec.consumption ? formatForInput(rec.consumption) : "",
                dbId: rec.id,
                dirty: false,
            };
        });

        setLocalValues(newValues);

        const firstConfigured = data.find((rec) => rec.size_id)?.size_id;
        const fallback = firstConfigured ?? sizes[0]?.id ?? "";
        if (fallback && !selectedSizeId) {
            setSelectedSizeId(fallback);
        }
    }, [data, sizes]);

    useEffect(() => {
        if (selectedSizeId && sizes.some((s) => s.id === selectedSizeId)) return;
        const firstConfigured = data.find((rec) => rec.size_id)?.size_id;
        const fallback = firstConfigured ?? sizes[0]?.id;
        if (fallback) setSelectedSizeId(fallback);
    }, [selectedSizeId, sizes, data]);

    const executeSave = async (sizeId: string, item: LocalSizeState): Promise<boolean> => {
        const numValue = parseFloat(item.consumption.replace(",", "."));
        if (isNaN(numValue) || numValue <= 0) return false;

        if (item.dbId) {
            return updateSizeConsumption(item.dbId, { consumption: numValue.toString() }, variantId);
        }

        const created = await addSizeConsumption({
            variant_id: variantId,
            talla_id: sizeId,
            consumption: numValue.toString(),
        });

        if (created?.id) {
            setLocalValues((prev) => ({
                ...prev,
                [sizeId]: { ...prev[sizeId], dbId: created.id, dirty: false },
            }));
            return true;
        }

        return false;
    };

    const handleSaveSize = async (sizeId: string) => {
        const item = localValues[sizeId];
        if (!item?.consumption.trim()) {
            toast.error("Ingresa los metros de tela antes de guardar.");
            return;
        }

        const ok = await executeSave(sizeId, item);
        if (ok) {
            setLocalValues((prev) => ({
                ...prev,
                [sizeId]: { ...prev[sizeId], dirty: false },
            }));
            toast.success("Consumo de talla guardado");
        } else {
            toast.error("No se pudo guardar el consumo. Verifica los metros.");
        }
    };

    const handleRemoveSize = async (sizeId: string) => {
        const item = localValues[sizeId];
        if (!item?.dbId) {
            setLocalValues((prev) => ({
                ...prev,
                [sizeId]: { consumption: "", dirty: false, dbId: undefined },
            }));
            return;
        }

        const ok = await deleteSizeConsumption(item.dbId, variantId);
        if (!ok) {
            toast.error("No se pudo quitar el consumo de esta talla");
            return;
        }

        setLocalValues((prev) => ({
            ...prev,
            [sizeId]: { consumption: "", dirty: false, dbId: undefined },
        }));
        toast.success("Consumo eliminado");
    };

    const handleInputChange = (sizeId: string, rawVal: string) => {
        const val = rawVal.replace(".", ",");
        if (val !== "" && !/^[0-9]*,?[0-9]*$/.test(val)) return;

        setLocalValues((prev) => ({
            ...prev,
            [sizeId]: {
                ...prev[sizeId],
                consumption: val,
                dirty: true,
            },
        }));
    };

    const configuredCount = useMemo(
        () =>
            Object.entries(localValues).filter(([, item]) => {
                const num = parseFloat(item.consumption.replace(",", "."));
                return item.dbId && !isNaN(num) && num > 0;
            }).length,
        [localValues]
    );

    const selectedItem = selectedSizeId ? localValues[selectedSizeId] : undefined;
    const selectedSize = sizes.find((s) => s.id === selectedSizeId);
    const selectedLabel =
        selectedSize?.label || selectedSize?.name || selectedSize?.code || selectedSizeId;

    if (!sizes.length) {
        return (
            <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    No hay tallas disponibles en el catálogo.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between py-4 gap-3">
                <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        Tallas y consumo de tela
                        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Selecciona una talla a la vez y configura sus metros. Cada talla tiene su propio costo en
                        cotizaciones y órdenes.
                    </p>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {sizes.map((size) => {
                        const item = localValues[size.id] || { consumption: "", dirty: false };
                        const label = size.label || size.name || size.code || size.id;
                        const isSelected = selectedSizeId === size.id;
                        const isConfigured = Boolean(item.dbId && item.consumption);

                        return (
                            <button
                                key={size.id}
                                type="button"
                                onClick={() => setSelectedSizeId(size.id)}
                                className={cn(
                                    "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition-all",
                                    isSelected
                                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                                        : "border-border bg-card hover:bg-muted/40",
                                    isConfigured && !isSelected && "border-green-200/80"
                                )}
                            >
                                <div
                                    className={cn(
                                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                        isSelected ? "border-primary" : "border-muted-foreground/40"
                                    )}
                                >
                                    {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                                </div>
                                <span className="font-bold text-sm">{label}</span>
                                {isConfigured ? (
                                    <span className="text-[10px] text-muted-foreground">{item.consumption} m</span>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground/60">Sin config.</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {selectedSizeId && selectedItem && (
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">
                                Configurar talla <span className="text-primary">{selectedLabel}</span>
                            </p>
                            {selectedItem.dbId && !selectedItem.dirty && (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                    <Check className="h-3.5 w-3.5" /> Guardada
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground shrink-0">Metros de tela</label>
                            <input
                                type="text"
                                placeholder="Ej. 2,5"
                                value={selectedItem.consumption}
                                onChange={(e) => handleInputChange(selectedSizeId, e.target.value)}
                                className="flex-1 max-w-[120px] bg-background border border-input rounded-md px-3 py-2 text-sm text-right focus:border-primary outline-none"
                            />
                            <span className="text-sm text-muted-foreground">m</span>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveSize(selectedSizeId)}
                                disabled={loading || !selectedItem.consumption.trim()}
                            >
                                <Save className="h-3.5 w-3.5 mr-1" />
                                Guardar
                            </Button>
                            {(selectedItem.dbId || selectedItem.consumption) && (
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive shrink-0"
                                    onClick={() => handleRemoveSize(selectedSizeId)}
                                    disabled={loading}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                <div className="w-full flex items-center justify-between bg-muted/40 rounded-lg p-3.5 text-sm text-muted-foreground font-medium">
                    <span>Tallas configuradas</span>
                    <span className="font-bold text-foreground text-base">
                        {configuredCount} de {sizes.length}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
