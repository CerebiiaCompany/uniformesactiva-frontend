import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { SizeFabric } from "@/types/variant";
import { useSizeConsumption } from "@/hooks/useSizeConsumption";

// Configuración estática de tallas y mapeo a UUIDs
const SIZE_SYSTEMS = {
    alfa: [
        { label: "XS", size_id: "a1fa0000-0000-0000-0000-000000000001" },
        { label: "S", size_id: "a1fa0000-0000-0000-0000-000000000002" },
        { label: "M", size_id: "a1fa0000-0000-0000-0000-000000000003" },
        { label: "L", size_id: "a1fa0000-0000-0000-0000-000000000004" },
        { label: "XL", size_id: "a1fa0000-0000-0000-0000-000000000005" },
        { label: "XXL", size_id: "a1fa0000-0000-0000-0000-000000000006" }
    ],
    numerica: [
        { label: "6", size_id: "d1910000-0000-0000-0000-000000000006" },
        { label: "8", size_id: "d1910000-0000-0000-0000-000000000008" },
        { label: "10", size_id: "d1910000-0000-0000-0000-000000000010" },
        { label: "12", size_id: "d1910000-0000-0000-0000-000000000012" },
        { label: "14", size_id: "d1910000-0000-0000-0000-000000000014" },
        { label: "16", size_id: "d1910000-0000-0000-0000-000000000016" }
    ],
    infantil: [
        { label: "2", size_id: "1fa80000-0000-0000-0000-000000000002" },
        { label: "4", size_id: "1fa80000-0000-0000-0000-000000000004" },
        { label: "6", size_id: "1fa80000-0000-0000-0000-000000000006" },
        { label: "8", size_id: "1fa80000-0000-0000-0000-000000000008" },
        { label: "10", size_id: "1fa80000-0000-0000-0000-000000000010" },
        { label: "12", size_id: "1fa80000-0000-0000-0000-000000000012" }
    ]
};

type SizeSystemType = "alfa" | "numerica" | "infantil";

interface SizeTableProps {
    data: SizeFabric[];
    variantId: string;
}

const detectActiveSystem = (savedRecords: SizeFabric[]): SizeSystemType => {
    if (!savedRecords || savedRecords.length === 0) return "alfa";
    let alfaCount = 0, numericaCount = 0, infantilCount = 0;
    savedRecords.forEach(rec => {
        if (SIZE_SYSTEMS.alfa.some(s => s.size_id === rec.size_id)) alfaCount++;
        if (SIZE_SYSTEMS.numerica.some(s => s.size_id === rec.size_id)) numericaCount++;
        if (SIZE_SYSTEMS.infantil.some(s => s.size_id === rec.size_id)) infantilCount++;
    });
    if (numericaCount > alfaCount && numericaCount > infantilCount) return "numerica";
    if (infantilCount > alfaCount && infantilCount > numericaCount) return "infantil";
    return "alfa";
};

export function SizeConsumptionTable({ data, variantId }: SizeTableProps) {
    const { addSizeConsumption, updateSizeConsumption, deleteSizeConsumption, loading } = useSizeConsumption();
    const [sizeSystem, setSizeSystem] = useState<SizeSystemType>("alfa");
    const [localValues, setLocalValues] = useState<Record<string, { checked: boolean; consumption: string; dbId?: string }>>({});
    const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

    // Ref para evitar stale closures en el debounce
    const localValuesRef = useRef(localValues);
    useEffect(() => {
        localValuesRef.current = localValues;
    }, [localValues]);

    useEffect(() => {
        const detected = detectActiveSystem(data);
        setSizeSystem(detected);
        const newValues: Record<string, { checked: boolean; consumption: string; dbId?: string }> = {};

        Object.values(SIZE_SYSTEMS).flat().forEach((s) => {
            newValues[s.size_id] = { checked: false, consumption: "" };
        });

        data.forEach((rec) => {
            newValues[rec.size_id] = { checked: true, consumption: rec.consumption, dbId: rec.id };
        });
        setLocalValues(newValues);
    }, [data]);

    const executeSave = async (sizeId: string, val: string, dbId?: string) => {
        const numValue = parseFloat(val);
        if (isNaN(numValue) || numValue <= 0) return;

        if (dbId) {
            await updateSizeConsumption(dbId, { id: dbId, variant_id: variantId, size_id: sizeId, consumption: numValue.toString() }, variantId);
        } else {
            const created = await addSizeConsumption({ variant_id: variantId, size_id: sizeId, consumption: numValue.toString() });
            // Actualizar localmente con el nuevo dbId devuelto por el backend
            if (created && created.id) {
                setLocalValues(prev => ({
                    ...prev,
                    [sizeId]: { ...prev[sizeId], dbId: created.id }
                }));
            }
        }
    };

    const handleInputChange = (sizeId: string, rawVal: string) => {
        const val = rawVal.replace(",", ".");

        // Auto-check cuando el usuario escribe un valor
        setLocalValues(prev => ({
            ...prev,
            [sizeId]: {
                ...prev[sizeId],
                consumption: val,
                checked: val.length > 0 ? true : prev[sizeId]?.checked
            }
        }));

        if (debounceTimers.current[sizeId]) clearTimeout(debounceTimers.current[sizeId]);
        debounceTimers.current[sizeId] = setTimeout(() => {
            // Uso de la ref para obtener el estado actualizado
            const currentItem = localValuesRef.current[sizeId];
            if (currentItem?.checked) executeSave(sizeId, val, currentItem.dbId);
        }, 1000);
    };

    const handleCheckboxToggle = async (sizeId: string) => {
        const item = localValues[sizeId] || { checked: false, consumption: "", dbId: undefined };
        const isChecking = !item.checked;
        setLocalValues(prev => ({ ...prev, [sizeId]: { ...prev[sizeId], checked: isChecking } }));

        if (!isChecking && item.dbId) {
            await deleteSizeConsumption(item.dbId, variantId);
        } else if (isChecking && item.consumption) {
            executeSave(sizeId, item.consumption, item.dbId);
        }
    };

    const { activeCount, averageConsumption } = useMemo(() => {
        const activeSizes = Object.entries(localValues).filter(([sizeId, item]) => {
            const belongsToSystem = SIZE_SYSTEMS[sizeSystem].some(s => s.size_id === sizeId);
            const num = parseFloat(item.consumption);
            return belongsToSystem && item.checked && !isNaN(num) && num > 0;
        });
        const count = activeSizes.length;
        const sum = activeSizes.reduce((acc, [_, item]) => acc + parseFloat(item.consumption), 0);
        return { activeCount: count, averageConsumption: count > 0 ? (sum / count).toFixed(2) : "0.00" };
    }, [localValues, sizeSystem]);

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    📏 Tallas y consumo de tela {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </CardTitle>
                <select value={sizeSystem} onChange={(e) => setSizeSystem(e.target.value as SizeSystemType)}
                    className="border border-red-500 text-sm font-semibold rounded-md px-3 py-1.5 focus:outline-none ring-1 ring-red-500 bg-white cursor-pointer">
                    <option value="alfa">Tipo: Alfa</option>
                    <option value="numerica">Tipo: Numérica</option>
                    <option value="infantil">Tipo: Infantil</option>
                </select>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {SIZE_SYSTEMS[sizeSystem].map((size) => {
                        const item = localValues[size.size_id] || { checked: false, consumption: "", dbId: undefined };
                        return (
                            <div key={size.size_id} className={`flex items-center justify-between border rounded-lg p-3 transition-all ${item.checked ? "border-red-500 bg-red-50/5" : "border-gray-200 bg-white"}`}>
                                <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => handleCheckboxToggle(size.size_id)}>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${item.checked ? "border-red-500 bg-red-500 text-white" : "border-red-500 bg-white"}`}>
                                        {item.checked && <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>}
                                    </div>
                                    <span className="font-bold text-sm text-gray-800">{size.label}</span>
                                </div>
                                <input type="text" placeholder="m" value={item.consumption} onChange={(e) => handleInputChange(size.size_id, e.target.value)}
                                    className="w-16 bg-gray-50/50 border border-gray-200 rounded px-2 py-1 text-right text-sm focus:border-red-500 outline-none" />
                            </div>
                        );
                    })}
                </div>
                <div className="w-full flex items-center justify-between bg-gray-50 rounded-lg p-3.5 text-sm text-gray-500 font-medium">
                    <span>Consumo promedio ({activeCount} tallas)</span>
                    <span className="font-bold text-gray-900 text-base">{averageConsumption} m</span>
                </div>
            </CardContent>
        </Card>
    );
}