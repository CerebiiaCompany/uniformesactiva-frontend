import { useState, useEffect, useMemo } from "react";
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
import { useOrders } from "@/hooks/useOrders";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { useGetProductLines } from "@/hooks/useGetProductLines";
import { AddOrderProductDialog, type OrderProductEntry } from "@/components/AddOrderProductDialog";
import type { Client } from "@/hooks/useGetClients";
import { formatCurrency } from "@/lib/format-number";
import {
    LOGO_POSITION_OPTIONS,
    buildLogoFields,
    toIsoDeliveryDate,
    type LogoPositionKey,
} from "@/lib/order-fields";

interface UserOption {
    id: string;
    label: string;
}

interface NewOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const LOGO_POSITIONS = LOGO_POSITION_OPTIONS;

const PAYMENT_STATUS_OPTIONS = [
    { value: "no_pagado", label: "No pagado" },
    { value: "parcial", label: "Pagado parcial" },
    { value: "pagado", label: "Pagado" },
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
            <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
    );
}

export function NewOrderDialog({ open, onOpenChange, onSuccess }: NewOrderDialogProps) {
    const { createOrder, loading } = useOrders();
    const { lines, isLoading: loadingLines } = useGetProductLines();

    const [clients, setClients] = useState<Client[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loadingCatalogs, setLoadingCatalogs] = useState(false);

    const [selectedClient, setSelectedClient] = useState("");
    const [takenBy, setTakenBy] = useState("");
    const [isRepair, setIsRepair] = useState(false);
    const [productEntries, setProductEntries] = useState<OrderProductEntry[]>([]);
    const [addProductOpen, setAddProductOpen] = useState(false);
    const [incomeRaw, setIncomeRaw] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("no_pagado");
    const [orderComments, setOrderComments] = useState("");
    const [logoPositions, setLogoPositions] = useState<LogoPositionKey[]>([]);

    const lockedProductId = productEntries[0]?.producto_id;

    const resetForm = () => {
        setSelectedClient("");
        setTakenBy("");
        setIsRepair(false);
        setProductEntries([]);
        setIncomeRaw("");
        setDeliveryDate("");
        setPaymentStatus("no_pagado");
        setOrderComments("");
        setLogoPositions([]);
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
            } catch {
                toast.error("No se pudieron cargar clientes.");
            } finally {
                setLoadingCatalogs(false);
            }
        };

        loadCatalogs();
    }, [open]);

    const { totalQuantity, totalCost } = useMemo(() => {
        let qty = 0;
        let cost = 0;
        for (const entry of productEntries) {
            for (const line of entry.size_lines) {
                qty += line.cantidad;
                cost += line.costo_unitario * line.cantidad;
            }
        }
        return { totalQuantity: qty, totalCost: cost };
    }, [productEntries]);

    const income = Number(incomeRaw) || 0;
    const estimatedProfit = income > 0 ? income - totalCost : 0;
    const estimatedMargin = income > 0 ? (estimatedProfit / income) * 100 : 0;

    const handleAddProduct = (entry: OrderProductEntry) => {
        if (lockedProductId && entry.producto_id !== lockedProductId) {
            toast.error("Esta orden admite un solo producto del catálogo. Agrega otra variante del mismo artículo.");
            return;
        }
        setProductEntries((prev) => [...prev, entry]);
    };

    const handleRemoveProduct = (key: string) => {
        setProductEntries((prev) => prev.filter((p) => p.key !== key));
    };

    const toggleLogoPosition = (id: LogoPositionKey) => {
        setLogoPositions((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedClient) {
            toast.error("Selecciona un cliente.");
            return;
        }

        if (!takenBy) {
            toast.error("Selecciona quién tomó la orden.");
            return;
        }

        if (productEntries.length === 0) {
            toast.error("Agrega al menos un producto.");
            return;
        }

        if (!income || income <= 0) {
            toast.error("Ingresa un ingreso válido.");
            return;
        }

        const productoId = productEntries[0].producto_id;
        const rawItems = productEntries.flatMap((entry) =>
            entry.size_lines.map((line) => ({
                subproducto_id: entry.variant_id,
                talla_id: line.talla_id,
                cantidad: line.cantidad,
            }))
        );

        const mergedItemsMap = new Map<string, { subproducto_id: string; talla_id: string; cantidad: number }>();
        for (const item of rawItems) {
            const key = `${item.subproducto_id}:${item.talla_id}`;
            const existing = mergedItemsMap.get(key);
            if (existing) {
                existing.cantidad += item.cantidad;
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

        const payload = {
            cliente_id: selectedClient,
            producto_id: productoId,
            tomado_por_id: takenBy,
            valor_venta_proyectado: income,
            items,
            ...logoFields,
            ...(comentariosFinal ? { comentarios: comentariosFinal } : {}),
            ...(deliveryDate ? { fecha_estimada_entrega: toIsoDeliveryDate(deliveryDate) } : {}),
        };

        const { success, errorMessage } = await createOrder(payload);
        if (success) {
            toast.success("Orden creada correctamente.");
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error(errorMessage || "No se pudo crear la orden. Verifica los datos ingresados.");
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
                                <h2 className="text-lg font-bold tracking-tight">Nueva orden</h2>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Selecciona productos del catálogo, define tallas, atributos y comentarios.
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
                                        description="Cliente y responsable de la orden"
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Cliente</Label>
                                            <Select value={selectedClient} onValueChange={setSelectedClient}>
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
                                    </div>
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
                                                onClick={() => setAddProductOpen(true)}
                                            >
                                                <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                                            </Button>
                                        }
                                    />

                                    {productEntries.length === 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => setAddProductOpen(true)}
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

                                                return (
                                                    <div
                                                        key={entry.key}
                                                        className="group relative rounded-xl border bg-card pl-4 pr-3 py-3.5 shadow-sm hover:shadow-md transition-shadow border-l-[3px] border-l-primary"
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
                                                                    <Badge variant="secondary" className="text-[10px] font-normal">
                                                                        {entry.color}
                                                                    </Badge>
                                                                    <Badge variant="outline" className="text-[10px] font-normal">
                                                                        {entry.estampado}
                                                                    </Badge>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {entry.size_lines.map((l) => (
                                                                        <span
                                                                            key={l.talla_id}
                                                                            className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium"
                                                                        >
                                                                            {l.talla_nombre}{" "}
                                                                            <span className="ml-1 text-primary font-bold">
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
                                                                <p className="text-xs font-semibold tabular-nums">
                                                                    {entryQty} uds · ${formatMoney(entryCost)}
                                                                </p>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-60 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => handleRemoveProduct(entry.key)}
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
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Ingreso proyectado
                                            </Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                required
                                                placeholder="0"
                                                value={incomeRaw}
                                                onChange={(e) => setIncomeRaw(e.target.value)}
                                                className="h-[52px] text-lg font-bold tabular-nums border-primary/30 focus-visible:ring-primary/30"
                                            />
                                        </div>
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
                                            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
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
                                            <button
                                                type="button"
                                                className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 px-4 py-5 text-sm text-muted-foreground hover:border-primary/40 hover:bg-primary/[0.03] hover:text-foreground transition-colors"
                                            >
                                                <Upload className="h-5 w-5" />
                                                <span className="font-medium">Subir logo</span>
                                                <span className="text-[11px]">PNG, JPG o SVG</span>
                                            </button>
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
                                    disabled={loading || productEntries.length === 0 || !takenBy}
                                    className="min-w-[120px] shadow-sm"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Creando...
                                        </>
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
                onOpenChange={setAddProductOpen}
                lines={lines}
                loadingLines={loadingLines}
                lockedProductId={lockedProductId}
                onAdd={handleAddProduct}
            />
        </>
    );
}
