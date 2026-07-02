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
import { formatCurrency } from "@/lib/format-number";

export interface FieldDefinition {
    name: string;
    label: string;
    type: string;
    placeholder?: string;
    defaultValue?: string | number;
    step?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    options?: { value: string; label: string }[];
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

export function ModalForm({ isOpen, onClose, title, fields, onSubmit, isLoading, initialData }: ModalFormProps) {
    const [formData, setFormData] = useState<Record<string, string>>({});

    // Inicializar el estado cuando el modal se abre
    useEffect(() => {
        if (isOpen) {
            const initial: Record<string, string> = {};
            fields.forEach((f) => {
                initial[f.name] = initialData?.[f.name]?.toString() ?? f.defaultValue?.toString() ?? "";
            });
            setFormData(initial);
        }
    }, [isOpen, initialData, fields]);

    const handleChange = (name: string, value: string) => {
        // Si es unit_price, limpiamos todo lo que no sea dígito para mantener el valor crudo
        if (name === "unit_price") {
            const rawValue = value.replace(/[^0-9]/g, "");
            setFormData((prev) => ({ ...prev, [name]: rawValue }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    {fields.map((field) => (
                        <div key={field.name} className="space-y-2">
                            <Label htmlFor={field.name}>{field.label}</Label>
                            {field.type === "select" ? (
                                <select
                                    id={field.name}
                                    name={field.name}
                                    value={formData[field.name] || ""}
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                    required
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="" disabled>Seleccionar...</option>
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
                                    type={field.name === "unit_price" ? "text" : field.type === "decimal" ? "text" : field.type}
                                    placeholder={field.placeholder}
                                    // Si es unit_price, mostramos formateado, si no, el valor crudo
                                    value={
                                        field.name === "unit_price" && formData[field.name]
                                            ? formatCurrency(Number(formData[field.name]))
                                            : formData[field.name] || ""
                                    }
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                    required
                                />
                            )}
                        </div>
                    ))}
                    <div className="flex justify-end gap-2 pt-4">
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