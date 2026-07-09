import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useGetClients, type Client } from "@/hooks/useGetClients";

export interface QuoteFormValues {
    id?: string;
    clientId: string;  // ID del cliente seleccionado
    customerName: string;  // Nombre del cliente (para mostrar en la tabla)
    items: string;
    totalAmount: number;
    status: "draft" | "sent" | "approved" | "rejected";
    validUntil: string;
    // Nuevos campos
    takenBy?: string;
    probability?: number;
    shippingDate?: string;
}

interface Props {
    initialData?: QuoteFormValues;
    onSubmit: (data: QuoteFormValues) => Promise<void>;
    onCancel: () => void;
}

export default function QuoteForm({ initialData, onSubmit, onCancel }: Props) {
    const { clients, isLoading: loadingClients } = useGetClients(1, 100);

    const [values, setValues] = useState<QuoteFormValues>({
        clientId: "",
        customerName: "",
        items: "",
        totalAmount: 0,
        status: "draft",
        validUntil: new Date().toISOString().split("T")[0],
        // Nuevos campos
        takenBy: "",
        probability: 0,
        shippingDate: "",
        ...initialData,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Cuando se selecciona un cliente, actualizar customerName automáticamente
    const handleClientChange = (clientId: string) => {
        const selectedClient = clients.find(c => c.id === clientId);
        setValues((prev) => ({
            ...prev,
            clientId: clientId,
            customerName: selectedClient?.name || "",
        }));
    };

    const handleChange = (
        field: keyof QuoteFormValues
    ) => (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
            const val = field === "totalAmount" || field === "probability"
                ? Number(e.target.value)
                : e.target.value;
            setValues((prev) => ({ ...prev, [field]: val }));
        };

    const handleStatusChange = (value: QuoteFormValues["status"]) => {
        setValues((prev) => ({ ...prev, status: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit(values);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto max-h-[70vh] pr-2">
            {/* Cliente - Selector */}
            <div className="space-y-2">
                <Label htmlFor="clientId">Cliente</Label>
                <Select
                    value={values.clientId}
                    onValueChange={handleClientChange}
                    disabled={loadingClients}
                >
                    <SelectTrigger id="clientId">
                        <SelectValue placeholder={loadingClients ? "Cargando clientes..." : "Seleccionar cliente"} />
                    </SelectTrigger>
                    <SelectContent>
                        {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                                {client.name} ({client.nit})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {values.customerName && (
                    <p className="text-xs text-muted-foreground mt-1">
                        Cliente seleccionado: <span className="font-medium">{values.customerName}</span>
                    </p>
                )}
            </div>

            {/* Artículos */}
            <div className="space-y-2">
                <Label htmlFor="items">Artículos</Label>
                <Input
                    id="items"
                    placeholder="Descripción de los artículos (separados por coma)"
                    value={values.items}
                    onChange={handleChange("items")}
                    required
                />
                <p className="text-xs text-muted-foreground">Separa los artículos con comas</p>
            </div>

            {/* Monto */}
            <div className="space-y-2">
                <Label htmlFor="totalAmount">Monto Total</Label>
                <Input
                    id="totalAmount"
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={values.totalAmount || ""}
                    onChange={handleChange("totalAmount")}
                    required
                />
            </div>

            {/* Tomado por */}
            <div className="space-y-2">
                <Label htmlFor="takenBy">Tomada por</Label>
                <Input
                    id="takenBy"
                    placeholder="Nombre de quien tomó la cotización"
                    value={values.takenBy || ""}
                    onChange={handleChange("takenBy")}
                />
            </div>

            {/* Probabilidad */}
            <div className="space-y-2">
                <Label htmlFor="probability">Probabilidad de Conversión (%)</Label>
                <Input
                    id="probability"
                    type="number"
                    placeholder="0-100"
                    min="0"
                    max="100"
                    value={values.probability ?? ""}
                    onChange={handleChange("probability")}
                />
            </div>

            {/* Fecha de Envío */}
            <div className="space-y-2">
                <Label htmlFor="shippingDate">Fecha Estimada de Envío</Label>
                <Input
                    id="shippingDate"
                    type="date"
                    value={values.shippingDate || ""}
                    onChange={handleChange("shippingDate")}
                />
            </div>

            {/* Estado */}
            <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                    value={values.status}
                    onValueChange={handleStatusChange}
                >
                    <SelectTrigger id="status">
                        <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="draft">Borrador</SelectItem>
                        <SelectItem value="sent">Enviada</SelectItem>
                        <SelectItem value="approved">Aprobada</SelectItem>
                        <SelectItem value="rejected">Rechazada</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Válida hasta */}
            <div className="space-y-2">
                <Label htmlFor="validUntil">Válida Hasta</Label>
                <Input
                    id="validUntil"
                    type="date"
                    value={values.validUntil}
                    onChange={handleChange("validUntil")}
                    required
                />
            </div>

            {/* Botones */}
            <DialogFooter className="flex justify-end space-x-2 pt-4 sticky bottom-0 bg-background border-t border-border py-3 -mx-2 px-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isSubmitting}
                >
                    Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting || !values.clientId}>
                    {isSubmitting ? "Guardando..." : "Guardar"}
                </Button>
            </DialogFooter>
        </form>
    );
}