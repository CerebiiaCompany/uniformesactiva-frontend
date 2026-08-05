import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Loader2,
    Plus,
    Trash2,
    User,
    Wrench,
    Upload,
    ClipboardList,
    Package,
    Calendar,
    DollarSign,
    ShoppingBag,
    ImageIcon,
    TrendingUp,
    Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrders, type Order } from "@/hooks/useOrders";
import { useQuotes, type CreateQuoteFromOrderFormInput, type Quote } from "@/hooks/useQuotes";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { useGetProductLines } from "@/hooks/useGetProductLines";
import { AddOrderProductDialog, type OrderProductEntry } from "@/components/AddOrderProductDialog";
import type { Client } from "@/hooks/useGetClients";
import { formatCurrency } from "@/lib/format-number";
import { getApiBaseUrl } from "@/lib/api-base";
import {
    LOGO_POSITION_OPTIONS,
    buildLogoFields,
    toIsoDeliveryDate,
    type LogoPositionKey,
} from "@/lib/order-fields";
import { seedFromOrder, seedFromQuote } from "@/lib/order-form-hydrate";

interface UserOption {
    id: string;
    label: string;
}

interface NewOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (opts?: { quoteMarked?: boolean }) => void;
    /** "order" (default) o "quote" para Nueva cotización */
    mode?: "order" | "quote";
    /** Prefill desde una cotización aprobada */
    initialClientId?: string;
    initialIncome?: number;
    initialDeliveryDate?: string;
    quoteId?: string;
    /** Se llama tras crear la orden (antes de onSuccess) si venía de cotización */
    onOrderCreatedFromQuote?: (quoteId: string, ordenId: string) => Promise<void> | void;
    /** Editar orden existente (solo pending) */
    editOrder?: Order | null;
    /** Editar cotización existente */
    editQuote?: Quote | null;
}

const LOGO_POSITIONS = LOGO_POSITION_OPTIONS;

const PAYMENT_STATUS_OPTIONS = [
    { value: "no_pagado", label: "No pagado" },
    { value: "parcial", label: "Pagado parcial" },
    { value: "pagado", label: "Pagado" },
];

const MEDIO_PAGO_OPTIONS = [
    { value: "transferencia", label: "Transferencia bancaria" },
    { value: "efectivo", label: "Efectivo" },
    { value: "tarjeta", label: "Tarjeta de crédito/débito" },
    { value: "cheque", label: "Cheque" },
];

const formatMoney = (value: number) => formatCurrency(value);

function SectionHeader({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: React.ElementType;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold leading-none">{title}</h3>
                    {description && (
                        <p className="text-xs text-muted-foreground mt-1">{description}</p>
                    )}
                </div>
            </div>
            {action}
        </div>
    );
}

function StatCard({
    label,
    value,
    sub,
    accent = "default",
}: {
    label: string;
    value: string;
    sub?: string;
    accent?: "default" | "cost" | "income" | "profit";
}) {
    const styles = {
        default: "bg-muted/40 border-border",
        cost: "bg-slate-50 border-slate-200 dark:bg-slate-900/40",
        income: "bg-primary/5 border-primary/20",
        profit: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30",
    };

    return (
        <div className={cn("rounded-xl border px-4 py-3 space-y-1", styles[accent])}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-lg tabular-nums leading-tight">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
    );
}

export function NewOrderDialog({
    open,
    onOpenChange,
    onSuccess,
    mode = "order",
    initialClientId,
    initialIncome,
    initialDeliveryDate,
    quoteId,
    onOrderCreatedFromQuote,
    editOrder = null,
    editQuote = null,
}: NewOrderDialogProps) {
    const isQuoteMode = mode === "quote";
    const isEditMode = Boolean(editOrder || editQuote);
    const { createOrder, updateOrder, loading } = useOrders();
    const {
        createQuoteFromOrderForm,
        updateQuoteFromOrderForm,
        loading: quoteLoading,
    } = useQuotes();
    const { lines, isLoading: loadingLines } = useGetProductLines();

    const [clients, setClients] = useState<Client[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loadingCatalogs, setLoadingCatalogs] = useState(false);

    const [selectedClient, setSelectedClient] = useState("");
    const [takenBy, setTakenBy] = useState("");
    const [isRepair, setIsRepair] = useState(false);
    const [productEntries, setProductEntries] = useState<OrderProductEntry[]>([]);
    const [addProductOpen, setAddProductOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<OrderProductEntry | null>(null);
    const [abonoAmountRaw, setAbonoAmountRaw] = useState("");
    const [medioPago, setMedioPago] = useState("");
    const [conceptoAbono, setConceptoAbono] = useState("");
    const [fechaLimiteSaldo, setFechaLimiteSaldo] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("no_pagado");
    const [orderComments, setOrderComments] = useState("");
    const [logoPositions, setLogoPositions] = useState<LogoPositionKey[]>([]);
    const [logoPath, setLogoPath] = useState<string | null>(null);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
    const [logoUploading, setLogoUploading] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [quoteStatus, setQuoteStatus] = useState<"draft" | "sent" | "in_review" | "approved" | "rejected">("draft");
    const [validUntil, setValidUntil] = useState(new Date().toISOString().split("T")[0]);
    const [purchaseIntention, setPurchaseIntention] = useState<string>("50");
    const [isSaving, setIsSaving] = useState(false);

    const fromQuote = Boolean(quoteId);
    const busy = loading || quoteLoading || isSaving;

    const resetForm = () => {
        setSelectedClient(initialClientId || "");
        setTakenBy("");
        setIsRepair(false);
        setProductEntries([]);
        setDeliveryDate(initialDeliveryDate || "");
        setPaymentStatus("no_pagado");
        setAbonoAmountRaw("");
        setMedioPago("");
        setConceptoAbono("");
        setFechaLimiteSaldo("");
        setOrderComments("");
        setLogoPositions([]);
        setLogoPath(null);
        setLogoPreviewUrl(null);
        setLogoUploading(false);
        setQuoteStatus("draft");
        setValidUntil(new Date().toISOString().split("T")[0]);
        setPurchaseIntention("50");
    };

    const applySeed = (seed: ReturnType<typeof seedFromOrder>) => {
        setSelectedClient(seed.selectedClient);
        setTakenBy(seed.takenBy);
        setIsRepair(seed.isRepair);
        setProductEntries(seed.productEntries);
        setDeliveryDate(seed.deliveryDate);
        setPaymentStatus(seed.paymentStatus);
        setAbonoAmountRaw(seed.abonoAmountRaw);
        setMedioPago(seed.medioPago);
        setConceptoAbono(seed.conceptoAbono);
        setFechaLimiteSaldo(seed.fechaLimiteSaldo);
        setOrderComments(seed.orderComments);
        setLogoPositions(seed.logoPositions);
        setLogoPath(seed.logoPath);
        setLogoPreviewUrl(seed.logoPreviewUrl);
        setQuoteStatus(seed.quoteStatus);
        setValidUntil(seed.validUntil);
        setPurchaseIntention(seed.purchaseIntention);
    };

    useEffect(() => {
        if (!open) return;
        resetForm();

        const loadCatalogs = async () => {
            setLoadingCatalogs(true);
            try {
                const [clientsData, usersData] = await Promise.all([
                    http<{ results: Client[] }>(`${endpoints.clients.list()}?page_size=100`),
                    http<any[]>(endpoints.users.list()).catch(() => []),
                ]);
                setClients(clientsData.results || []);

                const mappedUsers: UserOption[] = Array.isArray(usersData)
                    ? usersData.map((u) => ({
                          id: String(u.id),
                          label:
                              `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
                              u.username ||
                              String(u.id),
                      }))
                    : [];
                setUsers(mappedUsers);

                if (editOrder) {
                    applySeed(seedFromOrder(editOrder));
                } else if (editQuote) {
                    const seed = seedFromQuote(editQuote);
                    applySeed(seed);
                    if (!seed.takenBy && editQuote.takenBy) {
                        const byName = mappedUsers.find(
                            (u) =>
                                u.label.toLowerCase() === editQuote.takenBy!.toLowerCase() ||
                                u.label.toLowerCase().includes(editQuote.takenBy!.toLowerCase())
                        );
                        if (byName) setTakenBy(byName.id);
                    }
                    if (!seed.selectedClient && editQuote.customerId) {
                        setSelectedClient(editQuote.customerId);
                    }
                } else {
                    const storedUser = localStorage.getItem("user");
                    if (storedUser) {
                        try {
                            const parsed = JSON.parse(storedUser);
                            const me = mappedUsers.find(
                                (u) =>
                                    u.label.toLowerCase().includes((parsed.first_name || "").toLowerCase()) ||
                                    u.label.toLowerCase().includes((parsed.username || "").toLowerCase())
                            );
                            if (me) setTakenBy(me.id);
                        } catch {
                            /* ignore */
                        }
                    }

                    if (initialClientId) setSelectedClient(initialClientId);
                    if (initialDeliveryDate) setDeliveryDate(initialDeliveryDate);
                }
            } catch {
                toast.error("No se pudieron cargar clientes.");
            } finally {
                setLoadingCatalogs(false);
            }
        };

        loadCatalogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- rehydrate solo al abrir / cambiar entidad
    }, [open, editOrder?.id, editQuote?.id, initialClientId, initialDeliveryDate]);

    const { totalQuantity, totalCost, income } = useMemo(() => {
        let qty = 0;
        let cost = 0;
        let projectedIncome = 0;
        for (const entry of productEntries) {
            let entryQty = 0;
            for (const line of entry.size_lines) {
                entryQty += line.cantidad;
                cost += line.costo_unitario * line.cantidad;
            }
            qty += entryQty;
            projectedIncome += (entry.ingreso_proyectado_unitario || 0) * entryQty;
        }
        return {
            totalQuantity: qty,
            totalCost: cost,
            income: Math.round(projectedIncome * 100) / 100,
        };
    }, [productEntries]);

    const abonoAmount = Number(abonoAmountRaw) || 0;
    const saldoPendiente = Math.max(0, Math.round((income - abonoAmount) * 100) / 100);
    const estimatedProfit = income > 0 ? income - totalCost : 0;
    const estimatedMargin = income > 0 ? (estimatedProfit / income) * 100 : 0;

    const handleAddProduct = (entry: OrderProductEntry) => {
        setProductEntries((prev) => {
            if (editingProduct) {
                return prev.map((p) => (p.key === editingProduct.key ? entry : p));
            }
            return [...prev, entry];
        });
        setEditingProduct(null);
    };

    const handleRemoveProduct = (key: string) => {
        setProductEntries((prev) => prev.filter((p) => p.key !== key));
    };

    const openAddProduct = () => {
        setEditingProduct(null);
        setAddProductOpen(true);
    };

    const openEditProduct = (entry: OrderProductEntry) => {
        setEditingProduct(entry);
        setAddProductOpen(true);
    };

    const toggleLogoPosition = (id: LogoPositionKey) => {
        setLogoPositions((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    };

    const resolveMediaUrl = (pathOrUrl: string) => {
        if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
        const base = getApiBaseUrl().replace(/\/$/, "");
        return pathOrUrl.startsWith("/") ? `${base}${pathOrUrl}` : `${base}/media/${pathOrUrl}`;
    };

    const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
        if (!allowed.includes(file.type) && !/\.(png|jpe?g|webp|svg)$/i.test(file.name)) {
            toast.error("Formato no permitido. Usa PNG, JPG, WEBP o SVG.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("El archivo supera el máximo de 5 MB.");
            return;
        }

        const localPreview = URL.createObjectURL(file);
        setLogoPreviewUrl(localPreview);
        setLogoUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const result = await http<{ logo: string; logo_url: string }>(
                endpoints.orders.uploadLogo(),
                { method: "POST", body: formData }
            );
            setLogoPath(result.logo);
            setLogoPreviewUrl(resolveMediaUrl(result.logo_url || result.logo));
            toast.success("Logo cargado correctamente.");
        } catch (err) {
            setLogoPath(null);
            setLogoPreviewUrl(null);
            URL.revokeObjectURL(localPreview);
            toast.error(err instanceof Error ? err.message : "No se pudo subir el logo.");
        } finally {
            setLogoUploading(false);
        }
    };

    const clearLogo = () => {
        setLogoPath(null);
        setLogoPreviewUrl(null);
        if (logoInputRef.current) logoInputRef.current.value = "";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedClient) {
            toast.error("Selecciona un cliente.");
            return;
        }

        if (!takenBy) {
            toast.error(isQuoteMode ? "Selecciona quién tomó la cotización." : "Selecciona quién tomó la orden.");
            return;
        }

        if (productEntries.length === 0) {
            toast.error("Agrega al menos un producto.");
            return;
        }

        if (!income || income <= 0) {
            toast.error(
                "Agrega productos con ingreso proyectado por unidad para calcular el ingreso de la orden."
            );
            return;
        }

        if (isQuoteMode && !validUntil) {
            toast.error("Indica la fecha de validez de la cotización.");
            return;
        }

        const intentionNum = Number(purchaseIntention);
        if (
            isQuoteMode &&
            (purchaseIntention === "" ||
                Number.isNaN(intentionNum) ||
                intentionNum < 0 ||
                intentionNum > 100)
        ) {
            toast.error("La intención de compra debe ser un porcentaje entre 0 y 100.");
            return;
        }

        let detalleAbono:
            | {
                  monto_total: number;
                  monto_abono: number;
                  saldo_pendiente: number;
                  medio_pago: string;
                  concepto: string;
                  fecha_limite_saldo: string;
              }
            | { medio_pago: string }
            | undefined;

        if (paymentStatus === "pagado") {
            if (!medioPago) {
                toast.error("Selecciona el medio de pago.");
                return;
            }
            detalleAbono = { medio_pago: medioPago };
        }

        if (paymentStatus === "parcial") {
            if (!income || income <= 0) {
                toast.error("Define el ingreso / monto total antes del abono.");
                return;
            }
            if (!abonoAmount || abonoAmount <= 0) {
                toast.error("Ingresa el monto del pago parcial (abono).");
                return;
            }
            if (abonoAmount >= income) {
                toast.error("El abono debe ser menor al monto total. Si pagó todo, usa “Pagado”.");
                return;
            }
            if (!medioPago) {
                toast.error("Selecciona el medio de pago.");
                return;
            }
            if (!conceptoAbono.trim()) {
                toast.error("Ingresa el concepto del abono.");
                return;
            }
            if (!fechaLimiteSaldo) {
                toast.error("Indica la fecha límite para el saldo restante.");
                return;
            }
            detalleAbono = {
                monto_total: income,
                monto_abono: abonoAmount,
                saldo_pendiente: saldoPendiente,
                medio_pago: medioPago,
                concepto: conceptoAbono.trim(),
                fecha_limite_saldo: fechaLimiteSaldo,
            };
        }

        const productoId = productEntries[0].producto_id;
        type PayloadLineItem = {
            subproducto_id: string;
            talla_id: string;
            cantidad: number;
            color?: string;
            talla_nombre?: string;
            costo_unitario?: number;
            precio_venta_unitario?: number;
            producto_nombre?: string;
            subproducto_nombre?: string;
            linea_id?: string;
            linea_nombre?: string;
            estampado?: string;
        };
        const rawItems: PayloadLineItem[] = productEntries.flatMap((entry) =>
            entry.size_lines.map((line) => ({
                subproducto_id: entry.variant_id,
                talla_id: line.talla_id,
                cantidad: line.cantidad,
                color: entry.color.trim() || undefined,
                talla_nombre: (line.talla_nombre || "").trim() || undefined,
                costo_unitario: Number(line.costo_unitario) || 0,
                precio_venta_unitario:
                    Number(entry.ingreso_proyectado_unitario) > 0
                        ? Number(entry.ingreso_proyectado_unitario)
                        : undefined,
                producto_nombre: entry.product_name || entry.producto_label || undefined,
                subproducto_nombre: entry.variant_label || undefined,
                linea_id: entry.line_id || undefined,
                linea_nombre: entry.line_name || entry.line_label || undefined,
                estampado: entry.estampado?.trim() || undefined,
            }))
        );

        const mergedItemsMap = new Map<string, PayloadLineItem>();
        for (const item of rawItems) {
            const key = `${item.subproducto_id}:${item.talla_id}`;
            const existing = mergedItemsMap.get(key);
            if (existing) {
                existing.cantidad += item.cantidad;
                if (!existing.color && item.color) existing.color = item.color;
                if (!existing.talla_nombre && item.talla_nombre) {
                    existing.talla_nombre = item.talla_nombre;
                }
                if (!existing.costo_unitario && item.costo_unitario) {
                    existing.costo_unitario = item.costo_unitario;
                }
                if (!existing.precio_venta_unitario && item.precio_venta_unitario) {
                    existing.precio_venta_unitario = item.precio_venta_unitario;
                }
                if (!existing.linea_nombre && item.linea_nombre) {
                    existing.linea_nombre = item.linea_nombre;
                }
                if (!existing.linea_id && item.linea_id) {
                    existing.linea_id = item.linea_id;
                }
                if (!existing.estampado && item.estampado) {
                    existing.estampado = item.estampado;
                }
            } else {
                mergedItemsMap.set(key, { ...item });
            }
        }
        const items = [...mergedItemsMap.values()];

        if (items.length === 0) {
            toast.error("Agrega cantidades en al menos una talla.");
            return;
        }

        const logoFields = buildLogoFields(logoPositions);
        const comentariosFinal = [
            isRepair ? "[Arreglo / reparación de prenda]" : "",
            orderComments.trim(),
        ]
            .filter(Boolean)
            .join("\n");

        const shippingIso = deliveryDate ? toIsoDeliveryDate(deliveryDate) : undefined;
        const takenByLabel = users.find((u) => u.id === takenBy)?.label || takenBy;
        const productLabels = productEntries.map(
            (e) => e.producto_label || e.variant_label || e.producto_id
        );
        const colorLabel = [
            ...new Set(productEntries.map((e) => e.color.trim()).filter(Boolean)),
        ].join(", ");
        const estampadoLabel = [
            ...new Set(productEntries.map((e) => e.estampado.trim()).filter(Boolean)),
        ].join(", ");

        setIsSaving(true);
        try {
            if (isQuoteMode) {
                const quoteInput: CreateQuoteFromOrderFormInput = {
                    customerId: selectedClient,
                    customerName: clients.find((c) => c.id === selectedClient)?.name,
                    items: productLabels.join(", "),
                    totalAmount: income,
                    status: quoteStatus,
                    validUntil,
                    takenBy: takenByLabel,
                    probability: intentionNum,
                    shippingDate: deliveryDate || undefined,
                    orderPayload: {
                        cliente_id: selectedClient,
                        producto_id: productoId,
                        tomado_por_id: takenBy,
                        valor_venta_proyectado: income,
                        items,
                        ...(shippingIso ? { fecha_estimada_entrega: shippingIso } : {}),
                        ...(comentariosFinal ? { comentarios: comentariosFinal } : {}),
                        ...logoFields,
                        product_labels: productLabels,
                        ...(logoPath ? { logo: logoPath } : {}),
                        estado_pago: paymentStatus as "no_pagado" | "parcial" | "pagado",
                        ...(detalleAbono ? { detalle_abono: detalleAbono } : {}),
                        ...(colorLabel ? { color: colorLabel } : {}),
                        ...(estampadoLabel ? { estampado: estampadoLabel } : {}),
                    },
                };
                const result = editQuote
                    ? await updateQuoteFromOrderForm(editQuote.id, quoteInput)
                    : await createQuoteFromOrderForm(quoteInput);
                if (result.success) {
                    toast.success(
                        editQuote
                            ? "Cotización actualizada correctamente."
                            : "Cotización creada correctamente."
                    );
                    onOpenChange(false);
                    onSuccess();
                } else {
                    toast.error(
                        result.errorMessage ||
                            (editQuote
                                ? "No se pudo actualizar la cotización."
                                : "No se pudo crear la cotización.")
                    );
                }
                return;
            }

            const payload = {
                cliente_id: selectedClient,
                producto_id: productoId,
                tomado_por_id: takenBy,
                valor_venta_proyectado: income,
                items: items.map(
                    ({
                        subproducto_id,
                        talla_id,
                        cantidad,
                        color,
                        precio_venta_unitario,
                    }) => ({
                        subproducto_id,
                        talla_id,
                        cantidad,
                        ...(color ? { color } : {}),
                        ...(precio_venta_unitario && precio_venta_unitario > 0
                            ? { precio_venta_unitario }
                            : {}),
                    })
                ),
                ...logoFields,
                ...(comentariosFinal ? { comentarios: comentariosFinal } : {}),
                ...(shippingIso ? { fecha_estimada_entrega: shippingIso } : {}),
                ...(logoPath ? { logo: logoPath } : {}),
                estado_pago: paymentStatus as "no_pagado" | "parcial" | "pagado",
                ...(detalleAbono ? { detalle_abono: detalleAbono } : { detalle_abono: null }),
                ...(colorLabel ? { color: colorLabel } : {}),
                ...(estampadoLabel ? { estampado: estampadoLabel } : {}),
                ...(quoteId ? { quote_id: quoteId } : {}),
            };

            if (editOrder) {
                const { success, errorMessage } = await updateOrder(editOrder.id, payload);
                if (success) {
                    toast.success("Orden actualizada correctamente.");
                    onOpenChange(false);
                    onSuccess();
                } else {
                    toast.error(errorMessage || "No se pudo actualizar la orden.");
                }
                return;
            }

            const { success, order, errorMessage } = await createOrder(payload);
            if (success) {
                let quoteMarked = !fromQuote;
                if (quoteId && onOrderCreatedFromQuote && order?.id) {
                    try {
                        await onOrderCreatedFromQuote(quoteId, order.id);
                        quoteMarked = true;
                    } catch (err) {
                        const msg =
                            err instanceof Error
                                ? err.message
                                : "La orden se creó, pero no se pudo marcar la cotización como Ordenado.";
                        toast.error(msg);
                        quoteMarked = false;
                    }
                }
                if (fromQuote) {
                    toast.success(
                        quoteMarked
                            ? "Orden creada. Cotización marcada como Ordenado."
                            : "Orden creada, pero la cotización sigue en Aprobada."
                    );
                } else {
                    toast.success("Orden creada correctamente.");
                }
                onOpenChange(false);
                onSuccess(fromQuote ? { quoteMarked } : undefined);
            } else {
                toast.error(errorMessage || "No se pudo crear la orden. Verifica los datos ingresados.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[760px] p-0 gap-0 flex flex-col max-h-[92vh] overflow-hidden">
                    {/* Header */}
                    <div className="shrink-0 px-6 pt-6 pb-4 border-b bg-gradient-to-r from-background via-background to-primary/[0.04]">
                        <div className="flex items-start gap-3 pr-8">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold tracking-tight">
                                    {isQuoteMode
                                        ? isEditMode
                                            ? "Editar cotización"
                                            : "Nueva cotización"
                                        : isEditMode
                                          ? "Editar orden"
                                          : fromQuote
                                            ? "Crear orden desde cotización"
                                            : "Nueva orden"}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {isQuoteMode
                                        ? isEditMode
                                            ? "Actualiza cliente, productos y vigencia de la cotización."
                                            : "Completa cliente, productos y vigencia. Al aprobar podrás ordenar con un clic."
                                        : isEditMode
                                          ? "Solo órdenes pendientes. Al guardar se actualizan productos, tallas y datos de la orden."
                                          : fromQuote
                                            ? "Completa productos, tallas y datos de la orden. Al guardar, la cotización pasará a Ordenado."
                                            : "Selecciona productos del catálogo, define tallas, atributos y comentarios."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {loadingCatalogs ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 className="h-7 w-7 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Cargando catálogos...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                                {/* Datos generales */}
                                <section className="space-y-3">
                                    <SectionHeader
                                        icon={User}
                                        title="Datos generales"
                                        description={
                                            isQuoteMode
                                                ? "Cliente y responsable de la cotización"
                                                : "Cliente y responsable de la orden"
                                        }
                                    />
                                    <div
                                        className={cn(
                                            "grid grid-cols-1 gap-4",
                                            isQuoteMode ? "sm:grid-cols-3" : "sm:grid-cols-2"
                                        )}
                                    >
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Cliente</Label>
                                            <Select
                                                value={selectedClient}
                                                onValueChange={setSelectedClient}
                                                disabled={fromQuote && Boolean(initialClientId)}
                                            >
                                                <SelectTrigger className="h-10 bg-background">
                                                    <SelectValue placeholder="Selecciona cliente..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {clients.map((client) => (
                                                        <SelectItem key={client.id} value={client.id}>
                                                            {client.name}
                                                            {client.nit ? ` — ${client.nit}` : ""}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">
                                                Tomada por <span className="text-destructive">*</span>
                                            </Label>
                                            <Select value={takenBy} onValueChange={setTakenBy}>
                                                <SelectTrigger className="h-10 bg-background">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                        <SelectValue placeholder="Selecciona usuario..." />
                                                    </div>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {users.map((user) => (
                                                        <SelectItem key={user.id} value={user.id}>
                                                            {user.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {isQuoteMode && (
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium">
                                                    Intención de compra (%){" "}
                                                    <span className="text-destructive">*</span>
                                                </Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    value={purchaseIntention}
                                                    onChange={(e) => setPurchaseIntention(e.target.value)}
                                                    placeholder="0 - 100"
                                                    className="h-10"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {isQuoteMode && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium">Fecha estimada de envío</Label>
                                                <Input
                                                    type="date"
                                                    value={deliveryDate}
                                                    onChange={(e) => setDeliveryDate(e.target.value)}
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium">Estado</Label>
                                                <Select
                                                    value={quoteStatus}
                                                    onValueChange={(v) =>
                                                        setQuoteStatus(v as typeof quoteStatus)
                                                    }
                                                >
                                                    <SelectTrigger className="h-10 bg-background">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="draft">Borrador</SelectItem>
                                                        <SelectItem value="sent">Enviada</SelectItem>
                                                        <SelectItem value="in_review">En revisión</SelectItem>
                                                        <SelectItem value="approved">Aprobada</SelectItem>
                                                        <SelectItem value="rejected">Rechazada</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium">
                                                    Válida hasta <span className="text-destructive">*</span>
                                                </Label>
                                                <Input
                                                    type="date"
                                                    value={validUntil}
                                                    onChange={(e) => setValidUntil(e.target.value)}
                                                    className="h-10"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}
                                </section>

                                {/* Arreglo */}
                                <label
                                    className={cn(
                                        "flex items-start gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition-colors",
                                        isRepair
                                            ? "border-red-300 bg-red-50 shadow-sm dark:bg-red-950/20"
                                            : "border-red-100 bg-red-50/40 hover:bg-red-50/70 dark:bg-red-950/10"
                                    )}
                                >
                                    <Checkbox
                                        checked={isRepair}
                                        onCheckedChange={(checked) => setIsRepair(checked === true)}
                                        className="mt-0.5 border-red-400 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                    />
                                    <div className="space-y-0.5">
                                        <span className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                                            <Wrench className="h-3.5 w-3.5" />
                                            Es un arreglo / reparación de prenda
                                        </span>
                                        <p className="text-xs text-red-600/75 dark:text-red-400/70">
                                            Marca cuando el cliente paga por arreglar prendas existentes.
                                        </p>
                                    </div>
                                </label>

                                <Separator />

                                {/* Productos */}
                                <section className="space-y-3">
                                    <SectionHeader
                                        icon={Package}
                                        title="Productos"
                                        description="Artículos del catálogo de Líneas"
                                        action={
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="shrink-0 h-8 text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground transition-colors"
                                                onClick={openAddProduct}
                                            >
                                                <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                                            </Button>
                                        }
                                    />

                                    {productEntries.length === 0 ? (
                                        <button
                                            type="button"
                                            onClick={openAddProduct}
                                            className="w-full rounded-xl border-2 border-dashed border-muted-foreground/20 px-4 py-10 text-center transition-colors hover:border-primary/40 hover:bg-primary/[0.03] group"
                                        >
                                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                                                <ShoppingBag className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                            <p className="text-sm font-medium text-foreground">
                                                Aún no hay productos
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Haz clic para agregar desde el catálogo de Líneas
                                            </p>
                                        </button>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {productEntries.map((entry) => {
                                                const entryQty = entry.size_lines.reduce((a, l) => a + l.cantidad, 0);
                                                const entryCost = entry.size_lines.reduce(
                                                    (a, l) => a + l.costo_unitario * l.cantidad,
                                                    0
                                                );
                                                const entryIncome =
                                                    (entry.ingreso_proyectado_unitario || 0) * entryQty;

                                                return (
                                                    <div
                                                        key={entry.key}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => openEditProduct(entry)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" || e.key === " ") {
                                                                e.preventDefault();
                                                                openEditProduct(entry);
                                                            }
                                                        }}
                                                        className="group relative rounded-xl border bg-card pl-4 pr-3 py-3.5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all border-l-[3px] border-l-primary cursor-pointer"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0 space-y-2">
                                                                <div>
                                                                    <p className="font-semibold text-sm leading-snug">
                                                                        {entry.producto_label}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                                        {entry.variant_label}
                                                                    </p>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {entry.color?.trim() && (
                                                                        <Badge variant="secondary" className="text-[10px] font-normal">
                                                                            {entry.color}
                                                                        </Badge>
                                                                    )}
                                                                    {entry.estampado?.trim() && (
                                                                        <Badge variant="outline" className="text-[10px] font-normal">
                                                                            {entry.estampado}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {entry.size_lines.map((l) => (
                                                                        <span
                                                                            key={l.talla_id}
                                                                            className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium"
                                                                        >
                                                                            {l.talla_nombre}{" "}
                                                                            <span className="ml-1 text-primary">
                                                                                ×{l.cantidad}
                                                                            </span>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                                {entry.comentario && (
                                                                    <p className="text-xs italic text-muted-foreground border-l-2 border-muted pl-2">
                                                                        {entry.comentario}
                                                                    </p>
                                                                )}
                                                                <div className="space-y-0.5 text-xs tabular-nums">
                                                                    <p className="font-semibold">
                                                                        {entryQty} uds · Costo ${formatMoney(entryCost)}
                                                                    </p>
                                                                    <p className="text-muted-foreground">
                                                                        Ingreso proy. ${formatMoney(entryIncome)}
                                                                        {" "}
                                                                        <span className="text-[10px]">
                                                                            (${formatMoney(entry.ingreso_proyectado_unitario || 0)}/u)
                                                                        </span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-60 group-hover:opacity-100 transition-opacity"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveProduct(entry.key);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>

                                <Separator />

                                {/* Resumen financiero */}
                                <section className="space-y-3">
                                    <SectionHeader
                                        icon={DollarSign}
                                        title="Resumen financiero"
                                        description="Totales calculados automáticamente"
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <StatCard
                                            label="Cantidad total"
                                            value={`${totalQuantity} uds`}
                                            accent="default"
                                        />
                                        <StatCard
                                            label="Costo total"
                                            value={totalCost > 0 ? `$${formatMoney(totalCost)}` : "$0"}
                                            accent="cost"
                                        />
                                        <StatCard
                                            label="Precio de venta proyectado (con IVA)"
                                            value={income > 0 ? `$${formatMoney(income)}` : "$0"}
                                            accent="income"
                                        />
                                    </div>
                                    {income > 0 && totalCost > 0 && (
                                        <div
                                            className={cn(
                                                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
                                                estimatedProfit >= 0
                                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                                    : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                            )}
                                        >
                                            <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                                            Ganancia estimada: ${formatMoney(estimatedProfit)} · Margen:{" "}
                                            {estimatedMargin.toFixed(1)}%
                                        </div>
                                    )}
                                    {productEntries.length > 0 && income <= 0 && (
                                        <p className="text-[11px] text-muted-foreground">
                                            El ingreso proyectado se calcula con el valor por unidad capturado al agregar cada producto.
                                        </p>
                                    )}
                                </section>

                                <Separator />

                                {/* Logística */}
                                <section className="space-y-3">
                                    <SectionHeader
                                        icon={Calendar}
                                        title="Logística y pago"
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Fecha de entrega</Label>
                                            <Input
                                                type="date"
                                                value={deliveryDate}
                                                onChange={(e) => setDeliveryDate(e.target.value)}
                                                className="h-10"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Estado de pago</Label>
                                            <Select
                                                value={paymentStatus}
                                                onValueChange={(v) => {
                                                    setPaymentStatus(v);
                                                    if (v === "no_pagado") {
                                                        setAbonoAmountRaw("");
                                                        setMedioPago("");
                                                        setConceptoAbono("");
                                                        setFechaLimiteSaldo("");
                                                    } else if (v === "pagado") {
                                                        setAbonoAmountRaw("");
                                                        setConceptoAbono("");
                                                        setFechaLimiteSaldo("");
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="h-10">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {paymentStatus === "parcial" && (
                                        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-4 dark:bg-amber-950/10 dark:border-amber-900/40">
                                            <div>
                                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                                    <DollarSign className="h-4 w-4 text-amber-700" />
                                                    Detalle financiero del abono
                                                </h4>
                                                <p className="text-[11px] text-muted-foreground mt-1">
                                                    Completa el abono recibido. El saldo se calcula automáticamente.
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-medium">Monto total de la deuda</Label>
                                                    <Input
                                                        value={income > 0 ? formatMoney(income) : "—"}
                                                        readOnly
                                                        className="h-10 bg-muted/50 tabular-nums"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-medium">
                                                        Monto del abono <span className="text-destructive">*</span>
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step="0.01"
                                                        value={abonoAmountRaw}
                                                        onChange={(e) => setAbonoAmountRaw(e.target.value)}
                                                        placeholder="0"
                                                        className="h-10"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-medium">Saldo pendiente</Label>
                                                    <Input
                                                        value={
                                                            income > 0 && abonoAmount > 0
                                                                ? formatMoney(saldoPendiente)
                                                                : income > 0
                                                                  ? formatMoney(income)
                                                                  : "—"
                                                        }
                                                        readOnly
                                                        className="h-10 bg-muted/50 tabular-nums text-amber-800 dark:text-amber-200"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="space-y-1.5 sm:col-span-2">
                                                    <Label className="text-xs font-medium">
                                                        Medio de pago <span className="text-destructive">*</span>
                                                    </Label>
                                                    <Select value={medioPago} onValueChange={setMedioPago}>
                                                        <SelectTrigger className="h-10 bg-background">
                                                            <SelectValue placeholder="Selecciona..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {MEDIO_PAGO_OPTIONS.map((opt) => (
                                                                <SelectItem key={opt.value} value={opt.value}>
                                                                    {opt.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                                                <h4 className="text-sm font-semibold mt-3 mb-1">
                                                    Términos y compromisos futuros
                                                </h4>
                                                <p className="text-[11px] text-muted-foreground mb-3">
                                                    Describe el abono y pacta la fecha del saldo restante.
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div className="space-y-1.5 sm:col-span-2">
                                                        <Label className="text-xs font-medium">
                                                            Concepto <span className="text-destructive">*</span>
                                                        </Label>
                                                        <Input
                                                            value={conceptoAbono}
                                                            onChange={(e) => setConceptoAbono(e.target.value)}
                                                            placeholder='Ej. Abono del 50% para inicio de producción'
                                                            className="h-10"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-medium">
                                                            Fecha límite del saldo{" "}
                                                            <span className="text-destructive">*</span>
                                                        </Label>
                                                        <Input
                                                            type="date"
                                                            value={fechaLimiteSaldo}
                                                            onChange={(e) => setFechaLimiteSaldo(e.target.value)}
                                                            className="h-10"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {paymentStatus === "pagado" && (
                                        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-3 dark:bg-emerald-950/10 dark:border-emerald-900/40">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium">
                                                    Medio de pago <span className="text-destructive">*</span>
                                                </Label>
                                                <Select value={medioPago} onValueChange={setMedioPago}>
                                                    <SelectTrigger className="h-10 bg-background">
                                                        <SelectValue placeholder="Transferencia, efectivo, tarjeta..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {MEDIO_PAGO_OPTIONS.map((opt) => (
                                                            <SelectItem key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Quién registra el pago y la fecha/hora se guardan automáticamente.
                                            </p>
                                        </div>
                                    )}
                                </section>

                                <Separator />

                                {/* Comentarios y logo */}
                                <section className="space-y-4">
                                    <SectionHeader
                                        icon={Layers}
                                        title="Notas y personalización"
                                    />
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Comentarios de la orden</Label>
                                        <Textarea
                                            placeholder="Indicaciones generales, condiciones de entrega, observaciones..."
                                            value={orderComments}
                                            onChange={(e) => setOrderComments(e.target.value)}
                                            className="min-h-[88px] resize-y"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium flex items-center gap-1.5">
                                                <ImageIcon className="h-3.5 w-3.5" />
                                                Logo del cliente
                                            </Label>
                                            <input
                                                ref={logoInputRef}
                                                type="file"
                                                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                                                className="hidden"
                                                onChange={handleLogoFileChange}
                                            />
                                            {logoPreviewUrl ? (
                                                <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
                                                    <div className="flex items-center justify-center rounded-lg bg-background border overflow-hidden h-28">
                                                        <img
                                                            src={logoPreviewUrl}
                                                            alt="Vista previa del logo"
                                                            className="max-h-full max-w-full object-contain"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="flex-1"
                                                            disabled={logoUploading}
                                                            onClick={() => logoInputRef.current?.click()}
                                                        >
                                                            Cambiar
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            disabled={logoUploading}
                                                            onClick={clearLogo}
                                                        >
                                                            Quitar
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={logoUploading}
                                                    onClick={() => logoInputRef.current?.click()}
                                                    className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 px-4 py-5 text-sm text-muted-foreground hover:border-primary/40 hover:bg-primary/[0.03] hover:text-foreground transition-colors disabled:opacity-60"
                                                >
                                                    {logoUploading ? (
                                                        <Loader2 className="h-5 w-5 animate-spin" />
                                                    ) : (
                                                        <Upload className="h-5 w-5" />
                                                    )}
                                                    <span className="font-medium">
                                                        {logoUploading ? "Subiendo..." : "Subir logo"}
                                                    </span>
                                                    <span className="text-[11px]">PNG, JPG, WEBP o SVG (máx. 5 MB)</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium">Posiciones del logo</Label>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {LOGO_POSITIONS.map((pos) => {
                                                    const active = logoPositions.includes(pos.id);
                                                    return (
                                                        <button
                                                            key={pos.id}
                                                            type="button"
                                                            onClick={() => toggleLogoPosition(pos.id)}
                                                            className={cn(
                                                                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all text-left",
                                                                active
                                                                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                                                                    : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted/50"
                                                            )}
                                                        >
                                                            <span
                                                                className={cn(
                                                                    "h-3.5 w-3.5 rounded-sm border shrink-0 flex items-center justify-center",
                                                                    active
                                                                        ? "border-primary bg-primary text-primary-foreground"
                                                                        : "border-muted-foreground/40"
                                                                )}
                                                            >
                                                                {active && (
                                                                    <svg viewBox="0 0 10 8" className="h-2 w-2 fill-current">
                                                                        <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                                                    </svg>
                                                                )}
                                                            </span>
                                                            {pos.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Footer fijo */}
                            <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={busy || productEntries.length === 0 || !takenBy}
                                    className="min-w-[140px] shadow-sm"
                                >
                                    {busy ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : isEditMode ? (
                                        "Guardar cambios"
                                    ) : isQuoteMode ? (
                                        "Guardar cotización"
                                    ) : (
                                        "Crear orden"
                                    )}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <AddOrderProductDialog
                open={addProductOpen}
                onOpenChange={(open) => {
                    setAddProductOpen(open);
                    if (!open) setEditingProduct(null);
                }}
                lines={lines}
                loadingLines={loadingLines}
                lockedProductId={undefined}
                editEntry={editingProduct}
                onAdd={handleAddProduct}
            />
        </>
    );
}
