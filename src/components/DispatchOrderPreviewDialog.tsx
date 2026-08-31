import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { formatCurrency } from "@/lib/format-number";
import type { Order } from "@/hooks/useOrders";
import type { Client } from "@/hooks/useGetClients";
import {
  resolveEffectivePaymentStatus,
  type PaymentStatus,
} from "@/lib/payment-status";
import {
  Building2,
  CreditCard,
  FileText,
  Hash,
  Loader2,
  MapPin,
  Package,
  Phone,
  User,
  Wallet,
} from "lucide-react";

type DispatchOrderPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
};

function money(value: number | string | null | undefined) {
  if (value == null || value === "") return "—";
  return `$${formatCurrency(value)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-CO");
}

function paymentCopy(status: PaymentStatus, order: Order) {
  const detalle = order.detalle_abono;
  const venta =
    Number(order.valor_venta_proyectado) ||
    Number(detalle?.monto_total) ||
    0;
  const abono = Number(detalle?.monto_abono ?? detalle?.abono_detalle?.monto_abono) || 0;
  const saldo =
    Number.isFinite(Number(detalle?.saldo_pendiente))
      ? Number(detalle?.saldo_pendiente)
      : Math.max(0, venta - abono);

  if (status === "pagado") {
    return {
      title: "Pagado por completo",
      detail: "La orden no tiene saldo pendiente. El cliente ya canceló el total.",
      tone: "ok" as const,
      venta,
      abono: venta > 0 ? venta : abono,
      saldo: 0,
    };
  }
  if (status === "parcial") {
    return {
      title: "Pago parcial",
      detail: `Hay un abono registrado, pero aún se debe saldo al cliente.`,
      tone: "warn" as const,
      venta,
      abono,
      saldo,
    };
  }
  return {
    title: "Sin pago / se debe todo",
    detail:
      venta > 0
        ? "No hay evidencia de pago registrado. Se debe el valor total de la orden."
        : "No hay evidencia de pago registrado.",
    tone: "bad" as const,
    venta,
    abono: 0,
    saldo: venta,
  };
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-card px-3.5 py-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="text-sm font-semibold text-foreground leading-snug break-words">
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

export function DispatchOrderPreviewDialog({
  open,
  onOpenChange,
  order,
}: DispatchOrderPreviewDialogProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  useEffect(() => {
    if (!open || !order?.cliente_id) {
      setClient(null);
      return;
    }
    let cancelled = false;
    setLoadingClient(true);
    void http<Client>(endpoints.clients.detail(order.cliente_id))
      .then((data) => {
        if (!cancelled) setClient(data);
      })
      .catch(() => {
        if (!cancelled) setClient(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingClient(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, order?.cliente_id]);

  if (!order) return null;

  const shortId = `ORD-${order.id.slice(0, 3).toUpperCase()}`;
  const paymentStatus = resolveEffectivePaymentStatus(order);
  const payment = paymentCopy(paymentStatus, order);
  const units = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.cantidad) || 0),
    0
  );
  const address =
    [client?.address, client?.city].filter(Boolean).join(", ") || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden">
        <div className="relative border-b bg-gradient-to-br from-red-50/90 via-background to-background px-6 pt-6 pb-5 dark:from-red-950/30">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-red-600/10 px-2 py-0.5 text-xs font-bold tracking-wide text-red-700 dark:text-red-400">
                Despacho
              </span>
              <StatusBadge status={order.estado} />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {shortId}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Datos para entrega · {order.cliente_nombre}
            </p>
          </DialogHeader>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-red-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Cliente
              </h3>
              {loadingClient ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <InfoRow
                icon={Building2}
                label="Nombre"
                value={client?.name || order.cliente_nombre}
              />
              <InfoRow icon={Hash} label="NIT" value={client?.nit || "—"} />
              <InfoRow
                icon={Phone}
                label="Teléfono"
                value={client?.phone || "—"}
              />
              <InfoRow
                icon={MapPin}
                label="Dirección de entrega"
                value={address}
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-red-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Información del pedido
              </h3>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <InfoRow
                icon={FileText}
                label="Producto"
                value={order.producto_nombre || "—"}
              />
              <InfoRow
                icon={Package}
                label="Unidades"
                value={`${units} uds`}
              />
              <InfoRow
                icon={Wallet}
                label="Valor de venta"
                value={money(order.valor_venta_proyectado)}
              />
              <InfoRow
                icon={FileText}
                label="Entrega estimada"
                value={formatDate(order.fecha_estimada_entrega)}
              />
            </div>
            {(order.items || []).length > 0 ? (
              <div className="rounded-xl border bg-muted/30 px-3.5 py-3 space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Detalle de artículos
                </p>
                <ul className="space-y-1.5">
                  {order.items.map((item, idx) => (
                    <li
                      key={`${item.subproducto_id}-${item.talla_id}-${idx}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate font-medium">
                        {item.subproducto_nombre || "Artículo"}
                        {item.talla_nombre ? (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {item.talla_nombre}
                          </span>
                        ) : null}
                      </span>
                      <span className="tabular-nums text-muted-foreground shrink-0">
                        {Number(item.cantidad) || 0} uds
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {order.comentarios?.trim() ? (
              <div className="rounded-xl border border-dashed px-3.5 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  Comentarios
                </p>
                <p className="text-sm leading-relaxed">{order.comentarios}</p>
              </div>
            ) : null}
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-red-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Estado de pago
              </h3>
            </div>
            <div
              className={cn(
                "rounded-2xl border p-4 space-y-3",
                payment.tone === "ok" &&
                  "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/30",
                payment.tone === "warn" &&
                  "border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30",
                payment.tone === "bad" &&
                  "border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className={cn(
                      "text-base font-bold",
                      payment.tone === "ok" && "text-emerald-700 dark:text-emerald-400",
                      payment.tone === "warn" && "text-amber-700 dark:text-amber-400",
                      payment.tone === "bad" && "text-red-700 dark:text-red-400"
                    )}
                  >
                    {payment.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {payment.detail}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                    payment.tone === "ok" &&
                      "bg-emerald-600 text-white",
                    payment.tone === "warn" &&
                      "bg-amber-500 text-white",
                    payment.tone === "bad" &&
                      "bg-red-600 text-white"
                  )}
                >
                  {paymentStatus === "pagado"
                    ? "Pagado"
                    : paymentStatus === "parcial"
                      ? "Parcial"
                      : "Se debe"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="rounded-lg bg-background/70 px-2.5 py-2 border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                  <p className="text-sm font-bold tabular-nums">{money(payment.venta)}</p>
                </div>
                <div className="rounded-lg bg-background/70 px-2.5 py-2 border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Abonado</p>
                  <p className="text-sm font-bold tabular-nums">{money(payment.abono)}</p>
                </div>
                <div className="rounded-lg bg-background/70 px-2.5 py-2 border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Saldo</p>
                  <p
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      payment.saldo > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {money(payment.saldo)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
