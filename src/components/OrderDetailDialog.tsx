import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
import {
    Loader2,
    ClipboardList,
    User,
    Package,
    Calendar,
    DollarSign,
    TrendingUp,
    MessageSquare,
    ImageIcon,
    Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Order } from "@/hooks/useOrders";
import { LOGO_POSITION_OPTIONS } from "@/lib/order-fields";
import { formatCurrency } from "@/lib/format-number";
import { getApiBaseUrl } from "@/lib/api-base";

const formatMoney = (value: string | number) => formatCurrency(value);

function resolveMediaUrl(pathOrUrl?: string | null) {
    if (!pathOrUrl) return null;
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
    const base = getApiBaseUrl().replace(/\/$/, "");
    return pathOrUrl.startsWith("/") ? `${base}${pathOrUrl}` : `${base}/media/${pathOrUrl}`;
}

interface OrderDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: Order | null;
    loading: boolean;
    commentsDraft: string;
    onCommentsChange: (value: string) => void;
    onSaveComments: () => void;
    savingComments: boolean;
}

function InfoTile({
    icon: Icon,
    label,
    value,
    className,
}: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("rounded-xl border bg-card px-3.5 py-3 space-y-1", className)}>
            <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-sm font-semibold leading-snug">{value}</p>
        </div>
    );
}

function FinanceTile({
    label,
    value,
    accent,
}: {
    label: string;
    value: string;
    accent: "cost" | "sale" | "profit" | "margin";
}) {
    const styles = {
        cost: "bg-slate-50 border-slate-200 dark:bg-slate-900/40",
        sale: "bg-primary/5 border-primary/20",
        profit: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30",
        margin: "bg-blue-50 border-blue-200 dark:bg-blue-950/30",
    };

    return (
        <div className={cn("rounded-xl border px-3 py-2.5", styles[accent])}>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-base font-bold tabular-nums mt-0.5">{value}</p>
        </div>
    );
}

export function OrderDetailDialog({
    open,
    onOpenChange,
    order,
    loading,
    commentsDraft,
    onCommentsChange,
    onSaveComments,
    savingComments,
}: OrderDetailDialogProps) {
    const ganancia = order ? Number(order.ganancia) : 0;
    const margen = order ? Number(order.margen_ganancia) * 100 : 0;
    const profitPositive = ganancia >= 0;

    const totalItems = order?.items?.reduce((acc, i) => acc + i.cantidad, 0) ?? 0;
    const activeLogos = order
        ? LOGO_POSITION_OPTIONS.filter((pos) => order[pos.id])
        : [];

    const commentsChanged = order ? commentsDraft !== (order.comentarios ?? "") : false;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[720px] p-0 gap-0 flex flex-col max-h-[92vh] overflow-hidden">
                {/* Header */}
                <div className="shrink-0 px-6 pt-6 pb-4 border-b bg-gradient-to-r from-background via-background to-primary/[0.04]">
                    <div className="flex items-start justify-between gap-4 pr-8">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-lg font-bold tracking-tight">
                                        ORD-{order?.id.slice(0, 8).toUpperCase() ?? "—"}
                                    </h2>
                                    {order && <StatusBadge status={order.estado} />}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Creada el{" "}
                                    {order
                                        ? new Date(order.fecha_creacion).toLocaleDateString("es-CO", {
                                              day: "numeric",
                                              month: "long",
                                              year: "numeric",
                                          })
                                        : "—"}
                                    {order?.fecha_estimada_entrega && (
                                        <>
                                            {" · Entrega "}
                                            {new Date(order.fecha_estimada_entrega).toLocaleDateString("es-CO")}
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Loader2 className="h-7 w-7 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Cargando detalle...</p>
                    </div>
                ) : order ? (
                    <>
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                            {/* Resumen financiero */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <DollarSign className="h-3.5 w-3.5" />
                                    </div>
                                    <h3 className="text-sm font-semibold">Resumen financiero</h3>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    <FinanceTile
                                        label="Costo total"
                                        value={`$${formatMoney(order.costo_total)}`}
                                        accent="cost"
                                    />
                                    <FinanceTile
                                        label="Valor venta"
                                        value={`$${formatMoney(order.valor_venta_proyectado)}`}
                                        accent="sale"
                                    />
                                    <FinanceTile
                                        label="Ganancia"
                                        value={`$${formatMoney(ganancia)}`}
                                        accent="profit"
                                    />
                                    <FinanceTile
                                        label="Margen"
                                        value={`${margen.toFixed(1)}%`}
                                        accent="margin"
                                    />
                                </div>
                                <div
                                    className={cn(
                                        "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
                                        profitPositive
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                            : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                    )}
                                >
                                    <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                                    {totalItems} unidades ·{" "}
                                    {profitPositive ? "Rentabilidad positiva" : "Rentabilidad negativa"}
                                </div>
                            </section>

                            <Separator />

                            {/* Datos generales */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <Layers className="h-3.5 w-3.5" />
                                    </div>
                                    <h3 className="text-sm font-semibold">Información general</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <InfoTile icon={User} label="Cliente" value={order.cliente_nombre} />
                                    <InfoTile
                                        icon={User}
                                        label="Tomada por"
                                        value={order.tomado_por_nombre || "No registrado"}
                                    />
                                    <InfoTile icon={Package} label="Producto" value={order.producto_nombre} />
                                    <InfoTile
                                        icon={Calendar}
                                        label="Entrega estimada"
                                        value={
                                            order.fecha_estimada_entrega
                                                ? new Date(order.fecha_estimada_entrega).toLocaleDateString("es-CO", {
                                                      weekday: "short",
                                                      day: "numeric",
                                                      month: "short",
                                                      year: "numeric",
                                                  })
                                                : "Sin fecha definida"
                                        }
                                    />
                                </div>
                            </section>

                            {/* Logos */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4 text-primary" />
                                    <h3 className="text-sm font-semibold">Logo del cliente</h3>
                                </div>
                                {resolveMediaUrl(order.logo_url || order.logo) ? (
                                    <div className="rounded-xl border bg-muted/20 p-3 flex items-center justify-center h-32">
                                        <img
                                            src={resolveMediaUrl(order.logo_url || order.logo) || ""}
                                            alt="Logo del cliente"
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-3">
                                        Sin logo cargado
                                    </p>
                                )}
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Posiciones
                                </h4>
                                {activeLogos.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {activeLogos.map((pos) => (
                                            <Badge
                                                key={pos.id}
                                                variant="secondary"
                                                className="text-xs font-normal px-2.5 py-1"
                                            >
                                                {pos.label}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-3">
                                        Sin posiciones de logo configuradas
                                    </p>
                                )}
                            </section>

                            <Separator />

                            {/* Comentarios */}
                            <section className="space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-primary" />
                                    <Label className="text-sm font-semibold">Comentarios</Label>
                                </div>
                                <Textarea
                                    value={commentsDraft}
                                    onChange={(e) => onCommentsChange(e.target.value)}
                                    placeholder="Comentarios de la orden..."
                                    className="min-h-[88px] resize-y bg-background"
                                />
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] text-muted-foreground">
                                        Editar comentarios no afecta costos, margen ni estado.
                                    </p>
                                    <Button
                                        size="sm"
                                        variant={commentsChanged ? "default" : "outline"}
                                        disabled={!commentsChanged || savingComments}
                                        onClick={onSaveComments}
                                        className="shrink-0"
                                    >
                                        {savingComments ? (
                                            <>
                                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                                Guardando...
                                            </>
                                        ) : (
                                            "Guardar"
                                        )}
                                    </Button>
                                </div>
                            </section>

                            <Separator />

                            {/* Ítems */}
                            <section className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Package className="h-4 w-4 text-primary" />
                                        <h3 className="text-sm font-semibold">Ítems de la orden</h3>
                                    </div>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {order.items?.length ?? 0} líneas · {totalItems} uds
                                    </span>
                                </div>

                                {!order.items?.length ? (
                                    <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                                        Esta orden no tiene ítems registrados.
                                    </div>
                                ) : (
                                    <div className="rounded-xl border overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-muted/50 text-xs text-muted-foreground border-b">
                                                        <th className="text-left font-semibold px-4 py-2.5">Variante</th>
                                                        <th className="text-center font-semibold px-3 py-2.5">Talla</th>
                                                        <th className="text-center font-semibold px-3 py-2.5">Cant.</th>
                                                        <th className="text-right font-semibold px-3 py-2.5">Unit.</th>
                                                        <th className="text-right font-semibold px-4 py-2.5">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {order.items.map((item, idx) => {
                                                        const lineTotal =
                                                            Number(item.costo_unitario) * item.cantidad;
                                                        return (
                                                            <tr
                                                                key={`${item.subproducto_id}-${item.talla_id ?? "na"}-${idx}`}
                                                                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                                                            >
                                                                <td className="px-4 py-3 font-medium">
                                                                    {item.subproducto_nombre || item.subproducto_id}
                                                                </td>
                                                                <td className="px-3 py-3 text-center">
                                                                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
                                                                        {item.talla_nombre ||
                                                                            (item.talla_id
                                                                                ? item.talla_id.slice(0, 6)
                                                                                : "N/A")}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-3 text-center font-semibold tabular-nums">
                                                                    {item.cantidad}
                                                                </td>
                                                                <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                                                                    ${formatMoney(item.costo_unitario)}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                                                                    ${formatMoney(lineTotal)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="bg-muted/40 border-t">
                                                        <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground text-right">
                                                            Subtotal ítems
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                                                            ${formatMoney(order.costo_total)}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>

                        <div className="shrink-0 flex items-center justify-end px-6 py-4 border-t bg-muted/20">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cerrar
                            </Button>
                        </div>
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
