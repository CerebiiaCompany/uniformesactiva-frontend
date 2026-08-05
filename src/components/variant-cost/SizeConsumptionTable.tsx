import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Save, Trash2, X, CircleDot, Square } from "lucide-react";
import { toast } from "sonner";
import type { CatalogOption, SizeFabric, TallaGenero } from "@/types/variant";
import { formatForInput } from "@/lib/format-number";
import { filterTallasByGenero, groupTallasForDisplay } from "@/lib/talla-catalog";
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
    const {
        addSizeConsumption,
        updateSizeConsumption,
        deleteSizeConsumption,
        refreshCosts,
        loading,
    } = useSizeConsumption();
    const [localValues, setLocalValues] = useState<Record<string, LocalSizeState>>({});
    const [internalSelectedSizeId, setInternalSelectedSizeId] = useState<string>("");
    const [genero, setGenero] = useState<TallaGenero>("hombre");
    /** false = individual (cuadrito + X roja); true = varias (círculos, multi-selección) */
    const [multiSelectMode, setMultiSelectMode] = useState(false);
    const [selectedSizeIds, setSelectedSizeIds] = useState<string[]>([]);
    const [bulkMeters, setBulkMeters] = useState("");
    const [savingBulk, setSavingBulk] = useState(false);

    const selectedSizeId = controlledSelectedSizeId ?? internalSelectedSizeId;
    const visibleSizes = useMemo(() => filterTallasByGenero(sizes, genero), [sizes, genero]);
    const sizeSections = useMemo(
        () => groupTallasForDisplay(visibleSizes, genero),
        [visibleSizes, genero]
    );

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

        setLocalValues((prev) => {
            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(newValues);
            if (prevKeys.length === nextKeys.length) {
                const same = nextKeys.every((key) => {
                    const a = prev[key];
                    const b = newValues[key];
                    return (
                        a &&
                        b &&
                        a.consumption === b.consumption &&
                        a.dbId === b.dbId &&
                        Boolean(a.dirty) === Boolean(b.dirty)
                    );
                });
                if (same) return prev;
            }
            return newValues;
        });
    }, [data, sizes]);

    useEffect(() => {
        const visibleIds = new Set(visibleSizes.map((s) => s.id));

        setSelectedSizeIds((prev) => {
            const next = prev.filter((id) => visibleIds.has(id));
            if (next.length === prev.length && next.every((id, i) => id === prev[i])) {
                return prev;
            }
            return next;
        });

        const selectedStillVisible = Boolean(
            selectedSizeId && visibleSizes.some((s) => s.id === selectedSizeId)
        );
        if (selectedStillVisible) return;

        const firstConfigured = visibleSizes.find((size) => {
            const item = localValues[size.id];
            return Boolean(item?.dbId && item.consumption);
        })?.id;
        const fallback = firstConfigured ?? visibleSizes[0]?.id ?? "";
        if (fallback && fallback !== selectedSizeId) {
            setSelectedSizeId(fallback);
        }
    }, [genero, visibleSizes, selectedSizeId, localValues]);

    const executeSave = async (
        sizeId: string,
        item: LocalSizeState,
        options?: { skipCacheUpdate?: boolean }
    ): Promise<{
        ok: boolean;
        dbId?: string;
        response?: { variant_estimated_cost?: number | string };
    }> => {
        const numValue = parseFloat(item.consumption.replace(",", "."));
        if (isNaN(numValue) || numValue <= 0) return { ok: false };

        if (item.dbId) {
            const result = await updateSizeConsumption(
                item.dbId,
                { consumption: numValue.toString() },
                variantId,
                options
            );
            if (result === false) return { ok: false };
            return {
                ok: true,
                dbId: item.dbId,
                response: result,
            };
        }

        const created = await addSizeConsumption(
            {
                variant_id: variantId,
                talla_id: sizeId,
                consumption: numValue.toString(),
            },
            options
        );

        if (created?.id) {
            return { ok: true, dbId: created.id, response: created };
        }

        return { ok: false };
    };

    const normalizeMetersInput = (rawVal: string) => {
        const val = rawVal.replace(".", ",");
        if (val !== "" && !/^[0-9]*,?[0-9]*$/.test(val)) return null;
        return val;
    };

    const handleSaveSize = async (sizeId: string) => {
        const item = localValues[sizeId];
        if (!item?.consumption.trim()) {
            toast.error("Ingresa los metros de tela antes de guardar.");
            return;
        }

        const result = await executeSave(sizeId, item);
        if (result.ok) {
            setLocalValues((prev) => ({
                ...prev,
                [sizeId]: {
                    ...prev[sizeId],
                    dbId: result.dbId ?? prev[sizeId]?.dbId,
                    dirty: false,
                },
            }));
            toast.success("Consumo de talla guardado");
        } else {
            toast.error("No se pudo guardar el consumo. Verifica los metros.");
        }
    };

    const handleSaveMultiple = async () => {
        if (selectedSizeIds.length === 0) {
            toast.error("Selecciona al menos una talla.");
            return;
        }
        if (!bulkMeters.trim()) {
            toast.error("Ingresa los metros de tela antes de guardar.");
            return;
        }

        const numValue = parseFloat(bulkMeters.replace(",", "."));
        if (isNaN(numValue) || numValue <= 0) {
            toast.error("Los metros deben ser un número mayor a 0.");
            return;
        }

        const metersFormatted = formatForInput(numValue);
        // Snapshot de dbId antes de mutar (evita perder estado por refetch intermedio)
        const targets = selectedSizeIds.map((sizeId) => ({
            sizeId,
            dbId: localValues[sizeId]?.dbId,
        }));

        setSavingBulk(true);
        let okCount = 0;
        const okIds = new Set<string>();
        const createdIds: Record<string, string> = {};
        let lastResponse: { variant_estimated_cost?: number | string } | undefined;

        try {
            for (const { sizeId, dbId } of targets) {
                const result = await executeSave(
                    sizeId,
                    { consumption: metersFormatted, dbId, dirty: true },
                    { skipCacheUpdate: true }
                );
                if (result.ok) {
                    okCount += 1;
                    okIds.add(sizeId);
                    if (result.dbId) createdIds[sizeId] = result.dbId;
                    if (result.response) lastResponse = result.response;
                }
            }

            refreshCosts(variantId, lastResponse);

            setLocalValues((prev) => {
                const next = { ...prev };
                for (const sizeId of okIds) {
                    next[sizeId] = {
                        consumption: metersFormatted,
                        dbId: createdIds[sizeId] ?? prev[sizeId]?.dbId,
                        dirty: false,
                    };
                }
                return next;
            });

            if (okCount === targets.length) {
                toast.success(
                    targets.length === 1
                        ? "Consumo de talla guardado"
                        : `Consumo guardado en ${okCount} tallas`
                );
            } else if (okCount > 0) {
                toast.warning(`Se guardaron ${okCount} de ${targets.length} tallas. Revisa las que fallaron.`);
            } else {
                toast.error("No se pudo guardar el consumo en las tallas seleccionadas.");
            }
        } finally {
            setSavingBulk(false);
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

    const handleRemoveSelected = async () => {
        if (selectedSizeIds.length === 0) return;
        setSavingBulk(true);
        let okCount = 0;
        try {
            for (const sizeId of selectedSizeIds) {
                const item = localValues[sizeId];
                if (!item?.dbId) {
                    setLocalValues((prev) => ({
                        ...prev,
                        [sizeId]: { consumption: "", dirty: false, dbId: undefined },
                    }));
                    okCount += 1;
                    continue;
                }
                const ok = await deleteSizeConsumption(item.dbId, variantId);
                if (ok) {
                    okCount += 1;
                    setLocalValues((prev) => ({
                        ...prev,
                        [sizeId]: { consumption: "", dirty: false, dbId: undefined },
                    }));
                }
            }
            if (okCount === selectedSizeIds.length) {
                toast.success(
                    selectedSizeIds.length === 1
                        ? "Consumo eliminado"
                        : `Consumo eliminado en ${okCount} tallas`
                );
            } else if (okCount > 0) {
                toast.warning(`Se eliminaron ${okCount} de ${selectedSizeIds.length} tallas.`);
            } else {
                toast.error("No se pudo eliminar el consumo.");
            }
        } finally {
            setSavingBulk(false);
        }
    };

    const handleInputChange = (sizeId: string, rawVal: string) => {
        const val = normalizeMetersInput(rawVal);
        if (val === null) return;

        setLocalValues((prev) => ({
            ...prev,
            [sizeId]: {
                ...prev[sizeId],
                consumption: val,
                dirty: true,
            },
        }));
    };

    const handleBulkMetersChange = (rawVal: string) => {
        const val = normalizeMetersInput(rawVal);
        if (val === null) return;
        setBulkMeters(val);
    };

    const toggleMultiSelectMode = () => {
        setMultiSelectMode((prev) => {
            const next = !prev;
            if (next) {
                // Entrar a multi: partir de la talla activa
                const seed = selectedSizeId ? [selectedSizeId] : [];
                setSelectedSizeIds(seed);
                const item = selectedSizeId ? localValues[selectedSizeId] : undefined;
                setBulkMeters(item?.consumption || "");
            } else {
                // Volver a individual: conservar una talla
                const keep = selectedSizeIds[0] || selectedSizeId;
                if (keep) setSelectedSizeId(keep);
                setSelectedSizeIds([]);
                setBulkMeters("");
            }
            return next;
        });
    };

    const handleSizeCardClick = (sizeId: string) => {
        if (!multiSelectMode) {
            setSelectedSizeId(sizeId);
            return;
        }

        setSelectedSizeIds((prev) => {
            const exists = prev.includes(sizeId);
            const next = exists ? prev.filter((id) => id !== sizeId) : [...prev, sizeId];
            // Mantener sincronizada la talla “activa” del panel de costos
            if (next.length > 0) {
                setSelectedSizeId(exists ? next[next.length - 1] : sizeId);
            }
            // Prefill metros si todas las seleccionadas tienen el mismo valor
            if (next.length > 0) {
                const values = next.map((id) => localValues[id]?.consumption || "");
                const same = values.every((v) => v === values[0]);
                setBulkMeters(same ? values[0] : "");
            } else {
                setBulkMeters("");
            }
            return next;
        });
    };

    const configuredCount = useMemo(
        () =>
            visibleSizes.filter((size) => {
                const item = localValues[size.id];
                if (!item) return false;
                const num = parseFloat(item.consumption.replace(",", "."));
                return item.dbId && !isNaN(num) && num > 0;
            }).length,
        [localValues, visibleSizes]
    );

    const selectedItem = selectedSizeId ? localValues[selectedSizeId] : undefined;
    const selectedSize = visibleSizes.find((s) => s.id === selectedSizeId);
    const selectedLabel =
        selectedSize?.label || selectedSize?.name || selectedSize?.code || selectedSizeId;

    const multiLabels = selectedSizeIds
        .map((id) => {
            const size = visibleSizes.find((s) => s.id === id);
            return size?.label || size?.name || size?.code || id;
        })
        .filter(Boolean);

    const busy = loading || savingBulk;

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
            <CardHeader className="flex flex-row items-start justify-between py-4 gap-3">
                <div className="min-w-0">
                    <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                        Tallas y consumo de tela
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        {multiSelectMode
                            ? "Selecciona varias tallas (círculos) y configura los mismos metros para todas."
                            : "Selecciona una talla (cuadrito con X) y configura sus metros. Cada talla tiene su propio costo en cotizaciones y órdenes."}
                    </p>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant={multiSelectMode ? "default" : "outline"}
                    className="shrink-0 gap-1.5"
                    onClick={toggleMultiSelectMode}
                >
                    {multiSelectMode ? (
                        <>
                            <Square className="h-3.5 w-3.5" />
                            Una talla
                        </>
                    ) : (
                        <>
                            <CircleDot className="h-3.5 w-3.5" />
                            Seleccionar varias
                        </>
                    )}
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
                    <button
                        type="button"
                        onClick={() => setGenero("hombre")}
                        className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                            genero === "hombre"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Hombre
                    </button>
                    <button
                        type="button"
                        onClick={() => setGenero("mujer")}
                        className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                            genero === "mujer"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Mujer
                    </button>
                </div>

                {visibleSizes.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        No hay tallas de {genero} en el catálogo. Ejecuta la migración del backend para cargarlas.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sizeSections.map((section) => (
                            <div key={section.key} className="space-y-2">
                                {section.title ? (
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
                                        {section.title}
                                    </p>
                                ) : null}
                                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                    {section.sizes.map((size) => {
                                        const item = localValues[size.id] || {
                                            consumption: "",
                                            dirty: false,
                                        };
                                        const label =
                                            size.label || size.name || size.code || size.id;
                                        const isSelected = multiSelectMode
                                            ? selectedSizeIds.includes(size.id)
                                            : selectedSizeId === size.id;
                                        const isConfigured = Boolean(
                                            item.dbId && item.consumption
                                        );

                                        return (
                                            <button
                                                key={size.id}
                                                type="button"
                                                onClick={() => handleSizeCardClick(size.id)}
                                                className={cn(
                                                    "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition-all",
                                                    isSelected
                                                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                                                        : "border-border bg-card hover:bg-muted/40",
                                                    isConfigured &&
                                                        !isSelected &&
                                                        "border-green-200/80"
                                                )}
                                            >
                                                {multiSelectMode ? (
                                                    <div
                                                        className={cn(
                                                            "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                                            isSelected
                                                                ? "border-primary"
                                                                : "border-muted-foreground/40"
                                                        )}
                                                    >
                                                        {isSelected && (
                                                            <div className="w-2 h-2 rounded-full bg-primary" />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={cn(
                                                            "w-4 h-4 rounded-[3px] border-2 flex items-center justify-center",
                                                            isSelected
                                                                ? "border-red-500 bg-red-50"
                                                                : "border-muted-foreground/40 bg-background"
                                                        )}
                                                    >
                                                        {isSelected && (
                                                            <X
                                                                className="h-2.5 w-2.5 text-red-600"
                                                                strokeWidth={3}
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                                <span className="font-bold text-sm">{label}</span>
                                                {isConfigured ? (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {item.consumption} m
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground/60">
                                                        Sin config.
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Formulario individual */}
                {!multiSelectMode && selectedSizeId && selectedItem && selectedSize && (
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

                        <div className="flex items-center gap-2 flex-wrap">
                            <label className="text-xs text-muted-foreground shrink-0">Metros de tela</label>
                            <input
                                type="text"
                                placeholder="Ej. 2,5"
                                value={selectedItem.consumption}
                                onChange={(e) => handleInputChange(selectedSizeId, e.target.value)}
                                className="flex-1 min-w-[100px] max-w-[120px] bg-background border border-input rounded-md px-3 py-2 text-sm text-right focus:border-primary outline-none"
                            />
                            <span className="text-sm text-muted-foreground">m</span>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveSize(selectedSizeId)}
                                disabled={busy || !selectedItem.consumption.trim()}
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
                                    disabled={busy}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Formulario múltiple */}
                {multiSelectMode && (
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">
                                {selectedSizeIds.length === 0 ? (
                                    "Selecciona una o más tallas"
                                ) : (
                                    <>
                                        Configurar{" "}
                                        <span className="text-primary">
                                            {selectedSizeIds.length}{" "}
                                            {selectedSizeIds.length === 1 ? "talla" : "tallas"}
                                        </span>
                                        {multiLabels.length > 0 && (
                                            <span className="text-muted-foreground font-normal">
                                                {" "}
                                                ({multiLabels.join(", ")})
                                            </span>
                                        )}
                                    </>
                                )}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <label className="text-xs text-muted-foreground shrink-0">Metros de tela</label>
                            <input
                                type="text"
                                placeholder="Ej. 2,5"
                                value={bulkMeters}
                                onChange={(e) => handleBulkMetersChange(e.target.value)}
                                disabled={selectedSizeIds.length === 0}
                                className="flex-1 min-w-[100px] max-w-[120px] bg-background border border-input rounded-md px-3 py-2 text-sm text-right focus:border-primary outline-none disabled:opacity-50"
                            />
                            <span className="text-sm text-muted-foreground">m</span>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => void handleSaveMultiple()}
                                disabled={
                                    busy || selectedSizeIds.length === 0 || !bulkMeters.trim()
                                }
                            >
                                {savingBulk ? (
                                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                    <Save className="h-3.5 w-3.5 mr-1" />
                                )}
                                Guardar en {selectedSizeIds.length || "…"}
                            </Button>
                            {selectedSizeIds.length > 0 && (
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive shrink-0"
                                    onClick={() => void handleRemoveSelected()}
                                    disabled={busy}
                                    title="Quitar consumo de las tallas seleccionadas"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        {selectedSizeIds.length > 1 && (
                            <p className="text-[11px] text-muted-foreground">
                                El mismo consumo se aplicará a todas las tallas seleccionadas.
                            </p>
                        )}
                    </div>
                )}

                <div className="w-full flex items-center justify-between bg-muted/40 rounded-lg p-3.5 text-sm text-muted-foreground font-medium">
                    <span>Tallas configuradas ({genero})</span>
                    <span className="font-bold text-foreground text-base">
                        {configuredCount} de {visibleSizes.length}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
