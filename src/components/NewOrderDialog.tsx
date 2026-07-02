import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useOrders } from "@/hooks/useOrders";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { Client } from "@/hooks/useGetClients";

interface ProductOption {
    id: string;
    name: string;
}

interface VariantOption {
    id: string;
    name: string;
    estimated_cost?: string | number;
}

interface NewOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);

export function NewOrderDialog({ open, onOpenChange, onSuccess }: NewOrderDialogProps) {
    const { createOrder, loading } = useOrders();
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [variants, setVariants] = useState<VariantOption[]>([]);
    const [loadingCatalogs, setLoadingCatalogs] = useState(false);
    const [loadingVariants, setLoadingVariants] = useState(false);

    const [selectedClient, setSelectedClient] = useState("");
    const [selectedProduct, setSelectedProduct] = useState("");
    const [projectedValueRaw, setProjectedValueRaw] = useState("");
    const [projectedValueFormatted, setProjectedValueFormatted] = useState("");
    const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});
    const [deliveryDate, setDeliveryDate] = useState("");

    const handleProjectedValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numericStr = e.target.value.replace(/[^\d]/g, "");
        const numericValue = numericStr ? Number(numericStr) : 0;

        setProjectedValueRaw(numericStr);
        setProjectedValueFormatted(numericStr ? formatCurrency(numericValue) : "");
    };

    useEffect(() => {
        if (!open) return;

        setSelectedClient("");
        setSelectedProduct("");
        setProjectedValueRaw("");
        setProjectedValueFormatted("");
        setSelectedVariants({});
        setDeliveryDate("");
        setVariants([]);

        const loadCatalogs = async () => {
            setLoadingCatalogs(true);
            try {
                const [clientsData, productsData] = await Promise.all([
                    http<{ results: Client[] }>(`${endpoints.clients.list()}?page_size=100`),
                    http<{ items: ProductOption[] }>(`${endpoints.productos.list()}?page_size=100`),
                ]);
                setClients(clientsData.results || []);
                setProducts(productsData.items || []);
            } catch {
                toast.error("No se pudieron cargar clientes o productos.");
            } finally {
                setLoadingCatalogs(false);
            }
        };

        loadCatalogs();
    }, [open]);

    useEffect(() => {
        if (!selectedProduct) {
            setVariants([]);
            setSelectedVariants({});
            return;
        }

        const loadVariants = async () => {
            setLoadingVariants(true);
            try {
                const data = await http<VariantOption[]>(endpoints.productos.variantes(selectedProduct));
                setVariants(data || []);
            } catch {
                toast.error("No se pudieron cargar las variantes del producto.");
                setVariants([]);
            } finally {
                setLoadingVariants(false);
            }
        };

        loadVariants();
    }, [selectedProduct]);

    const handleVariantQuantityChange = (variantId: string, quantity: number) => {
        setSelectedVariants((prev) => ({
            ...prev,
            [variantId]: quantity,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const itemsPayload = variants
            .filter((variant) => (selectedVariants[variant.id] || 0) > 0)
            .map((variant) => ({
                subproducto_id: variant.id,
                cantidad: Number(selectedVariants[variant.id]),
            }));

        if (itemsPayload.length === 0) {
            toast.error("Debes seleccionar al menos una variante con cantidad mayor a 0.");
            return;
        }

        if (!projectedValueRaw || Number(projectedValueRaw) <= 0) {
            toast.error("Ingresa un valor de venta proyectado válido.");
            return;
        }

        const payload = {
            cliente_id: selectedClient,
            producto_id: selectedProduct,
            valor_venta_proyectado: Number(projectedValueRaw),
            items: itemsPayload,
            ...(deliveryDate ? { fecha_estimada_entrega: deliveryDate } : {}),
        };

        const success = await createOrder(payload);
        if (success) {
            toast.success("Orden creada correctamente.");
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error("No se pudo crear la orden. Verifica los datos.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Crear Nueva Orden</DialogTitle>
                    <DialogDescription>
                        El costo se calcula automáticamente según el costo estimado de cada variante.
                    </DialogDescription>
                </DialogHeader>

                {loadingCatalogs ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Cliente</label>
                            <select
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={selectedClient}
                                onChange={(e) => setSelectedClient(e.target.value)}
                            >
                                <option value="" disabled>
                                    Selecciona un cliente...
                                </option>
                                {clients.map((client) => (
                                    <option key={client.id} value={client.id}>
                                        {client.name} - {client.nit}
                                    </option>
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
                                <option value="" disabled>
                                    Selecciona un producto...
                                </option>
                                {products.map((product) => (
                                    <option key={product.id} value={product.id}>
                                        {product.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedProduct && (
                            <div className="rounded-md border p-3 space-y-3 bg-muted/20">
                                <label className="text-sm font-medium">Cantidades por variante</label>
                                {loadingVariants ? (
                                    <div className="flex justify-center py-4">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    </div>
                                ) : variants.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        Este producto no tiene variantes configuradas.
                                    </p>
                                ) : (
                                    variants.map((variant) => (
                                        <div key={variant.id} className="flex items-center justify-between gap-2">
                                            <div className="text-sm w-2/3 truncate" title={variant.name}>
                                                {variant.name}
                                                {variant.estimated_cost != null && (
                                                    <span className="text-xs text-muted-foreground ml-1">
                                                        (ref. {formatCurrency(Number(variant.estimated_cost))})
                                                    </span>
                                                )}
                                            </div>
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                className="flex h-8 w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-center"
                                                value={selectedVariants[variant.id] || ""}
                                                onChange={(e) =>
                                                    handleVariantQuantityChange(variant.id, Number(e.target.value))
                                                }
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Fecha de entrega estimada (opcional)</label>
                            <input
                                type="date"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={deliveryDate}
                                onChange={(e) => setDeliveryDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 pt-2">
                            <label className="text-sm font-medium">Valor de venta proyectado ($)</label>
                            <input
                                required
                                type="text"
                                placeholder="Ej. $1.000.000"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={projectedValueFormatted}
                                onChange={handleProjectedValueChange}
                            />
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading || loadingVariants}>
                                {loading ? "Creando..." : "Crear orden"}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
