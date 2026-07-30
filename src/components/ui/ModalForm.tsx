import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatForInput } from "@/lib/format-number";
import { normalizeDecimalInput } from "@/lib/decimal-input";

export interface FieldDefinition {
    name: string;
    label: string;
    type: string;
    placeholder?: string;
    defaultValue?: string | number;
    step?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    options?: { value: string; label: string; defaultUnitPrice?: string | number | null }[];
    required?: boolean;
}

interface ModalFormProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    fields: FieldDefinition[];
    onSubmit: (data: Record<string, string>) => void;
    isLoading?: boolean;
    initialData?: Record<string, any>;
}

const DECIMAL_PRICE_FIELDS = new Set([
    "unit_price",
    "precio_unitario_default",
    "stock_minimo",
    "quantity",
    "cantidad",
    "price_per_meter",
    "meters",
]);

const sanitizeDecimalTyping = (value: string) => {
    // Permite dígitos y un solo separador decimal (, o .)
    let cleaned = value.replace(/[^\d.,]/g, "");
    const sepIndex = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
    if (sepIndex >= 0) {
        const intPart = cleaned.slice(0, sepIndex).replace(/[.,]/g, "");
        const decPart = cleaned.slice(sepIndex + 1).replace(/[.,]/g, "");
        const sep = cleaned[sepIndex];
        cleaned = decPart.length > 0 || cleaned.endsWith(",") || cleaned.endsWith(".")
            ? `${intPart}${sep}${decPart}`
            : intPart + sep;
    }
    return cleaned;
};

const toInputDecimal = (value: string | number | null | undefined) => {
    if (value == null || value === "") return "";
    return formatForInput(value);
};

export function ModalForm({ isOpen, onClose, title, fields, onSubmit, isLoading, initialData }: ModalFormProps) {
    const [formData, setFormData] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen) {
            const initial: Record<string, string> = {};
            fields.forEach((f) => {
                const raw = initialData?.[f.name] ?? f.defaultValue ?? "";
                initial[f.name] = DECIMAL_PRICE_FIELDS.has(f.name)
                    ? toInputDecimal(raw)
                    : String(raw ?? "");
            });
            setFormData(initial);
        }
    }, [isOpen, initialData, fields]);

    const handleChange = (name: string, value: string) => {
        if (DECIMAL_PRICE_FIELDS.has(name)) {
            setFormData((prev) => ({ ...prev, [name]: sanitizeDecimalTyping(value) }));
            return;
        }

        if (name === "tipo_id") {
            const field = fields.find((f) => f.name === "tipo_id");
            const selected = field?.options?.find((opt) => opt.value === value);
            const defaultPrice = selected?.defaultUnitPrice;
            setFormData((prev) => ({
                ...prev,
                tipo_id: value,
                ...(defaultPrice != null && String(defaultPrice) !== ""
                    ? { unit_price: toInputDecimal(defaultPrice) }
                    : {}),
            }));
            return;
        }

        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const normalized: Record<string, string> = {};
        Object.entries(formData).forEach(([key, value]) => {
            normalized[key] = DECIMAL_PRICE_FIELDS.has(key) ? normalizeDecimalInput(value) : value;
        });
        onSubmit(normalized);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1" noValidate>
                    {fields.map((field) => (
                        <div key={field.name} className="space-y-2">
                            <Label htmlFor={field.name}>{field.label}</Label>
                            {field.type === "select" ? (
                                <select
                                    id={field.name}
                                    name={field.name}
                                    value={formData[field.name] || ""}
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                    required={field.required !== false}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    {field.required !== false && (
                                        <option value="" disabled>
                                            Seleccionar...
                                        </option>
                                    )}
                                    {field.options?.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <Input
                                    id={field.name}
                                    name={field.name}
                                    type="text"
                                    inputMode={
                                        DECIMAL_PRICE_FIELDS.has(field.name)
                                            ? "decimal"
                                            : field.inputMode
                                    }
                                    placeholder={field.placeholder}
                                    value={formData[field.name] || ""}
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                    required={field.required !== false}
                                />
                            )}
                        </div>
                    ))}
                    <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background pb-1">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Guardando..." : "Guardar"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
