import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { CatalogOption, SizeFabric } from "@/types/variant";
import { useSizeConsumption } from "@/hooks/useSizeConsumption";

interface SizeTableProps {
    data: SizeFabric[];
    variantId: string;
    sizes: CatalogOption[];
}

type LocalSizeState = {
    checked: boolean;
    consumption: string;
    dbId?: string;
    dirty?: boolean;
};

export function SizeConsumptionTable({ data, variantId, sizes }: SizeTableProps) {
    const { addSizeConsumption, updateSizeConsumption, deleteSizeConsumption, loading } =
        useSizeConsumption();
    const [localValues, setLocalValues] = useState<Record<string, LocalSizeState>>({});
    const [savedSizeIds, setSavedSizeIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const newValues: Record<string, LocalSizeState> = {};

        sizes.forEach((size) => {
            newValues[size.id] = { checked: false, consumption: "", dirty: false };
        });

        data.forEach((rec) => {
            if (!rec.size_id) return;

            // Convertimos a número para limpiar ceros (ej: "40.000" -> "40") y usamos coma
            const cleanConsumption = rec.consumption
                ? parseFloat(rec.consumption).toString().replace(".", ",")
                : "";

            newValues[rec.size_id] = {
                checked: true,
                consumption: cleanConsumption,
                dbId: rec.id,
                dirty: false,
            };
        });

        setLocalValues(newValues);
        setSavedSizeIds(new Set(data.map((rec) => rec.size_id).filter(Boolean)));
    }, [data, sizes]);

    const executeSave = async (sizeId: string, item: LocalSizeState): Promise<boolean> => {
        const numValue = parseFloat(item.consumption.replace(",", "."));
        if (isNaN(numValue) || numValue <= 0) return false;

        if (item.dbId) {
            const ok = await updateSizeConsumption(item.dbId, { consumption: numValue.toString() }, variantId);
            return ok;
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
        if (!item?.checked || !item.consumption.trim()) {
            toast.error("Activa la talla e ingresa los metros antes de guardar.");
            return;
        }

        const ok = await executeSave(sizeId, item);
        if (ok) {
            setSavedSizeIds((prev) => new Set(prev).add(sizeId));
            setLocalValues((prev) => ({
                ...prev,
                [sizeId]: { ...prev[sizeId], dirty: false },
            }));
            toast.success("Consumo de talla guardado");
        } else {
            toast.error("No se pudo guardar el consumo. Verifica talla y metros.");
        }
    };

    const handleSaveAll = async () => {
        const pending = Object.entries(localValues).filter(([, item]) => {
            const num = parseFloat(item.consumption.replace(",", "."));
            return item.checked && !isNaN(num) && num > 0;
        });

        if (!pending.length) {
            toast.error("No hay tallas activas con consumo para guardar.");
            return;
        }

        let saved = 0;
        for (const [sizeId, item] of pending) {
            const ok = await executeSave(sizeId, item);
            if (ok) {
                saved++;
                setSavedSizeIds((prev) => new Set(prev).add(sizeId));
            }
        }

        setLocalValues((prev) => {
            const next = { ...prev };
            pending.forEach(([sizeId]) => {
                if (next[sizeId]) next[sizeId] = { ...next[sizeId], dirty: false };
            });
            return next;
        });

        if (saved === pending.length) {
            toast.success(`Consumos guardados (${saved} talla${saved > 1 ? "s" : ""})`);
        } else if (saved > 0) {
            toast.warning(`Se guardaron ${saved} de ${pending.length} tallas`);
        } else {
            toast.error("No se pudo guardar ningún consumo");
        }
    };

    const handleInputChange = (sizeId: string, rawVal: string) => {
        // Convertimos el punto a coma automáticamente
        const val = rawVal.replace(".", ",");

        // Validación para permitir solo números y una única coma (evita letras)
        if (val !== "" && !/^[0-9]*,?[0-9]*$/.test(val)) return;

        setLocalValues((prev) => ({
            ...prev,
            [sizeId]: {
                ...prev[sizeId],
                consumption: val,
                checked: val.length > 0 ? true : prev[sizeId]?.checked ?? false,
                dirty: true,
            },
        }));
    };

    const handleCheckboxToggle = async (sizeId: string) => {
        const item = localValues[sizeId] || { checked: false, consumption: "", dbId: undefined };
        const isChecking = !item.checked;

        if (!isChecking && item.dbId) {
            const ok = await deleteSizeConsumption(item.dbId, variantId);
            if (!ok) {
                toast.error("No se pudo quitar la talla");
                return;
            }
            setSavedSizeIds((prev) => {
                const next = new Set(prev);
                next.delete(sizeId);
                return next;
            });
        }

        setLocalValues((prev) => ({
            ...prev,
            [sizeId]: {
                ...prev[sizeId],
                checked: isChecking,
                consumption: isChecking ? prev[sizeId]?.consumption ?? "" : "",
                dbId: isChecking ? prev[sizeId]?.dbId : undefined,
                dirty: isChecking,
            },
        }));
    };

    const hasPendingChanges = useMemo(
        () => Object.values(localValues).some((item) => item.dirty && item.checked && item.consumption),
        [localValues]
    );

    const { activeCount, averageConsumption } = useMemo(() => {
        const activeSizes = Object.entries(localValues).filter(([sizeId, item]) => {
            const belongsToCatalog = sizes.some((s) => s.id === sizeId);
            const num = parseFloat(item.consumption.replace(",", "."));
            return belongsToCatalog && item.checked && !isNaN(num) && num > 0;
        });
        const count = activeSizes.length;
        const sum = activeSizes.reduce(
            (acc, [, item]) => acc + parseFloat(item.consumption.replace(",", ".")),
            0
        );

        // Redondeamos a máximo 2 decimales y aplicamos la coma
        const avg = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;

        return {
            activeCount: count,
            averageConsumption: avg.toString().replace(".", ","),
        };
    }, [localValues, sizes]);

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
                        Activa la talla, escribe los metros y pulsa Guardar (o Guardar todo).
                    </p>
                </div>
                <Button
                    size="sm"
                    onClick={handleSaveAll}
                    disabled={loading || !hasPendingChanges}
                >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    Guardar todo
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {sizes.map((size) => {
                        const item = localValues[size.id] || {
                            checked: false,
                            consumption: "",
                            dbId: undefined,
                            dirty: false,
                        };
                        const label = size.label || size.name || size.code || size.id;
                        const isSaved = savedSizeIds.has(size.id) && item.dbId && !item.dirty;

                        return (
                            <div
                                key={size.id}
                                className={`flex items-center justify-between border rounded-lg p-3 transition-all ${item.checked
                                        ? "border-primary bg-primary/5"
                                        : "border-border bg-card"
                                    }`}
                            >
                                <div
                                    className="flex items-center gap-2.5 cursor-pointer select-none min-w-0"
                                    onClick={() => handleCheckboxToggle(size.id)}
                                >
                                    <div
                                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${item.checked
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-muted-foreground bg-background"
                                            }`}
                                    >
                                        {item.checked && (
                                            <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                                                <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className="font-bold text-sm truncate">{label}</span>
                                    {isSaved && (
                                        <Check className="h-3.5 w-3.5 text-green-600 shrink-0" aria-label="Guardado" />
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <input
                                        type="text"
                                        placeholder="m"
                                        value={item.consumption}
                                        onChange={(e) => handleInputChange(size.id, e.target.value)}
                                        onBlur={() => item.checked && item.consumption && handleSaveSize(size.id)}
                                        className="w-16 bg-muted/50 border border-input rounded px-2 py-1 text-right text-sm focus:border-primary outline-none"
                                    />
                                    {item.dirty && item.checked && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => handleSaveSize(size.id)}
                                            disabled={loading}
                                        >
                                            <Save className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="w-full flex items-center justify-between bg-muted/40 rounded-lg p-3.5 text-sm text-muted-foreground font-medium">
                    <span>Consumo promedio ({activeCount} tallas)</span>
                    <span className="font-bold text-foreground text-base">{averageConsumption} m</span>
                </div>
            </CardContent>
        </Card>
    );
}