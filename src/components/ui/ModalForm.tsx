import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

const resolveInputType = (field: FieldDefinition) => {
    if (field.type === "decimal") return "text";
    return field.type;
};

const resolveInputMode = (field: FieldDefinition) => {
    if (field.type === "decimal") return "decimal" as const;
    return field.inputMode;
};

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
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries()) as Record<string, string>;
        onSubmit(data);
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
                                    defaultValue={initialData?.[field.name] ?? field.defaultValue ?? ""}
                                    required
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="" disabled>
                                        Seleccionar...
                                    </option>
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
                                    type={resolveInputType(field)}
                                    step={field.type === "decimal" ? undefined : field.step}
                                    inputMode={resolveInputMode(field)}
                                    placeholder={field.placeholder}
                                    defaultValue={initialData?.[field.name] ?? field.defaultValue ?? ""}
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
