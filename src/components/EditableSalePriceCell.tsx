import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/format-number";
import { cn } from "@/lib/utils";

interface EditableSalePriceCellProps {
    orderId: string;
    value: string | number;
    isSaving?: boolean;
    onSave: (orderId: string, value: number) => Promise<boolean>;
    onDraftChange?: (orderId: string, raw: string | null) => void;
}

const parseRawValue = (input: string) => input.replace(/[^\d]/g, "");

const formatInputDisplay = (raw: string) => {
    const num = Number(raw);
    return raw && !Number.isNaN(num) ? formatCurrency(num) : "";
};

export function EditableSalePriceCell({
    orderId,
    value,
    isSaving = false,
    onSave,
    onDraftChange,
}: EditableSalePriceCellProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const initialRaw = parseRawValue(String(value));
    const [isEditing, setIsEditing] = useState(false);
    const [rawValue, setRawValue] = useState(initialRaw);
    const [displayValue, setDisplayValue] = useState(formatInputDisplay(initialRaw));

    useEffect(() => {
        const nextRaw = parseRawValue(String(value));
        if (!isEditing) {
            setRawValue(nextRaw);
            setDisplayValue(formatInputDisplay(nextRaw));
        }
    }, [value, isEditing]);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const startEditing = () => {
        if (isSaving) return;
        const currentRaw = parseRawValue(String(value));
        setRawValue(currentRaw);
        setDisplayValue(formatInputDisplay(currentRaw));
        onDraftChange?.(orderId, currentRaw);
        setIsEditing(true);
    };

    const cancelEditing = () => {
        const resetRaw = parseRawValue(String(value));
        setRawValue(resetRaw);
        setDisplayValue(formatInputDisplay(resetRaw));
        onDraftChange?.(orderId, null);
        setIsEditing(false);
    };

    const commit = async () => {
        const numericValue = Number(rawValue);
        const currentValue = Number(parseRawValue(String(value)));

        if (!rawValue || Number.isNaN(numericValue) || numericValue <= 0) {
            cancelEditing();
            return false;
        }

        if (numericValue === currentValue) {
            setIsEditing(false);
            return true;
        }

        const ok = await onSave(orderId, numericValue);
        if (ok) {
            onDraftChange?.(orderId, null);
            setIsEditing(false);
        } else {
            cancelEditing();
        }
        return ok;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextRaw = parseRawValue(e.target.value);
        setRawValue(nextRaw);
        setDisplayValue(nextRaw ? formatInputDisplay(nextRaw) : "");
        onDraftChange?.(orderId, nextRaw || null);
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            await commit();
        }
        if (e.key === "Escape") {
            e.preventDefault();
            cancelEditing();
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center justify-end gap-1 min-w-0">
                <Input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    value={displayValue}
                    onChange={handleChange}
                    onBlur={() => void commit()}
                    onKeyDown={(e) => void handleKeyDown(e)}
                    disabled={isSaving}
                    className="h-8 w-[110px] text-right text-sm tabular-nums"
                />
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={startEditing}
            disabled={isSaving}
            title="Clic para editar valor de venta"
            className={cn(
                "group inline-flex items-center justify-end gap-1.5 text-sm text-foreground tabular-nums",
                "hover:text-primary transition-colors disabled:opacity-60 w-full"
            )}
        >
            <span>${formatCurrency(value)}</span>
            {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
                <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
            )}
        </button>
    );
}

/** Vista previa local de ganancia/margen mientras se edita el precio. */
export function getOrderProfitPreview(
    order: { costo_total: string | number; valor_venta_proyectado: string | number },
    draftRawValue?: string
) {
    const costoTotal = Number(order.costo_total);
    const venta =
        draftRawValue != null && draftRawValue !== ""
            ? Number(draftRawValue)
            : Number(order.valor_venta_proyectado);

    if (Number.isNaN(venta) || venta <= 0) {
        return { ganancia: 0, margenPorcentaje: 0, isPreview: false };
    }

    const ganancia = venta - costoTotal;
    const margenPorcentaje = (ganancia / venta) * 100;

    return {
        ganancia,
        margenPorcentaje,
        isPreview: draftRawValue != null && draftRawValue !== "" && draftRawValue !== parseRawValue(String(order.valor_venta_proyectado)),
    };
}
