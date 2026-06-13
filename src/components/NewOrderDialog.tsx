import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOrders } from "@/hooks/useOrders";

interface NewOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function NewOrderDialog({ open, onOpenChange, onSuccess }: NewOrderDialogProps) {
    const { createOrder, loading } = useOrders();
    const [clients, setClients] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState("");
    const [selectedProduct, setSelectedProduct] = useState("");
    const [projectedValue, setProjectedValue] = useState("");
    const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});

    const API_URL = import.meta.env.VITE_API_BASE_URL;
    const getToken = () => localStorage.getItem("token");

    useEffect(() => {
        if (open) {
            fetchClients();
            fetchProducts();
            setSelectedClient("");
            setSelectedProduct("");
            setProjectedValue("");
            setSelectedVariants({});
        }
    }, [open]);

    const fetchClients = async () => {
        try {
            const res = await fetch(`${API_URL}/api/v1/clients/`, {
                headers: { "Authorization": `Bearer ${getToken()}` }
            });
            const data = await res.json();
            setClients(data.results || []);
        } catch (error) {
            console.error("Error cargando clientes:", error);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch(`${API_URL}/api/v1/products/`, {
                headers: { "Authorization": `Bearer ${getToken()}` }
            });
            const data = await res.json();
            setProducts(data.items || []);
        } catch (error) {
            console.error("Error cargando productos:", error);
        }
    };

    const activeProduct = products.find(p => p.id === selectedProduct);

    const handleVariantQuantityChange = (variantId: string, quantity: number) => {
        setSelectedVariants(prev => ({
            ...prev,
            [variantId]: quantity
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!activeProduct?.variants) return;

        const itemsPayload = activeProduct.variants
            .filter((v: any) => (selectedVariants[v.id] || 0) > 0)
            .map((v: any) => ({
                subproducto_id: v.id,
                cantidad: Number(selectedVariants[v.id]),
                costo_unitario: Number(v.estimated_cost)
            }));

        if (itemsPayload.length === 0) {
            alert("Debes seleccionar al menos una variante con cantidad mayor a 0");
            return;
        }

        const payload = {
            cliente_id: selectedClient,
            producto_id: selectedProduct,
            valor_venta_proyectado: Number(projectedValue),
            items: itemsPayload
        };

        const success = await createOrder(payload);
        if (success) {
            onSuccess();
            onOpenChange(false);
        } else {
            alert("Hubo un error al crear la orden. Verifica los datos.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Crear Nueva Orden</DialogTitle>
                    <DialogDescription>
                        Selecciona el cliente, producto y las cantidades por variante.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Cliente</label>
                        <select
                            required
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                        >
                            <option value="" disabled>Selecciona un cliente...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name} - {c.nit}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Producto</label>
                        <select
                            required
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={selectedProduct}
                            onChange={(e) => {
                                setSelectedProduct(e.target.value);
                                setSelectedVariants({});
                            }}
                        >
                            <option value="" disabled>Selecciona un producto...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {activeProduct && activeProduct.variants && (
                        <div className="rounded-md border p-3 space-y-3 bg-muted/20">
                            <label className="text-sm font-medium">Cantidades por Variante</label>
                            {activeProduct.variants.map((v: any) => (
                                <div key={v.id} className="flex items-center justify-between gap-2">
                                    <div className="text-sm w-2/3 truncate" title={v.name}>
                                        {v.name} <span className="text-xs text-muted-foreground">(${v.estimated_cost})</span>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        className="flex h-8 w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-center"
                                        value={selectedVariants[v.id] || ""}
                                        onChange={(e) => handleVariantQuantityChange(v.id, Number(e.target.value))}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="space-y-2 pt-2">
                        <label className="text-sm font-medium">Valor de Venta Proyectado ($)</label>
                        <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder="28000.00"
                            value={projectedValue}
                            onChange={(e) => setProjectedValue(e.target.value)}
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creando..." : "Crear Orden"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}