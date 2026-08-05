import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useDashboard } from "@/hooks/useDashboard";
import type { StatusType } from "@/components/StatusBadge";
import { SatelliteUserDashboard } from "@/components/SatelliteUserDashboard";
import { ProductionUserDashboard } from "@/components/ProductionUserDashboard";
import { InventoryMaterialStatusRings } from "@/components/inventory/InventoryOverview";
import { useGetMaterials } from "@/hooks/useGetMaterials";
import { readStoredSatelliteUser } from "@/lib/satellite-user-dashboard";
import { readStoredProductionUser } from "@/lib/production-user-dashboard";
import {
  Scissors,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  Percent,
  FileText,
  Users,
  Loader2,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format-number";
import { cn } from "@/lib/utils";

function asStatus(value: string): StatusType {
  return value as StatusType;
}

function paymentLabel(estado: string) {
  if (estado === "parcial") return "Parcial";
  if (estado === "pagado") return "Pagado";
  return "No pagado";
}

function paymentBadgeClass(estado: string) {
  if (estado === "parcial") return "bg-amber-100 text-amber-800 border-amber-200";
  if (estado === "pagado") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  return "bg-red-100 text-red-800 border-red-200";
}

export default function Dashboard() {
  const isSatelliteUser = useMemo(() => Boolean(readStoredSatelliteUser()), []);
  const isProductionUser = useMemo(() => Boolean(readStoredProductionUser()), []);
  const { loading, error, stats, trends, recentOrders, alerts, unpaidOrders } =
    useDashboard();
  const { materials, isLoading: isLoadingMaterials } = useGetMaterials({});

  if (isSatelliteUser) {
    return <SatelliteUserDashboard />;
  }

  if (isProductionUser) {
    return <ProductionUserDashboard />;
  }

  if (loading && !stats) {
    return (
      <AppLayout title="Dashboard" subtitle="Resumen general de operaciones" eyebrow="General">
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando indicadores...</p>
        </div>
      </AppLayout>
    );
  }

  if (error && !stats) {
    return (
      <AppLayout title="Dashboard" subtitle="Resumen general de operaciones" eyebrow="General">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Verifica que el backend esté activo y el endpoint /api/v1/dashboard/.
          </p>
        </div>
      </AppLayout>
    );
  }

  const s = stats!;

  return (
    <AppLayout title="Dashboard" subtitle="Resumen general de operaciones" eyebrow="General">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Órdenes en proceso"
            value={s.ordersInProgress}
            subtitle="En producción"
            icon={Scissors}
            trend={
              trends?.ordersInProgressPct != null
                ? {
                    value: Math.abs(trends.ordersInProgressPct),
                    positive: trends.ordersInProgressPct >= 0,
                  }
                : undefined
            }
            variant="default"
          />
          <StatCard
            title="Órdenes retrasadas"
            value={s.delayedOrders}
            icon={AlertTriangle}
            variant="destructive"
          />
          <StatCard
            title="Tiempo prom. entrega"
            value={s.avgDeliveryDays}
            suffix=" días"
            subtitle="Según fecha estimada"
            icon={Clock}
            variant="default"
          />
          <StatCard
            title="Margen promedio"
            value={s.avgMargin}
            formatValue={(n) =>
              Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.05
                ? String(Math.round(n))
                : n.toFixed(1)
            }
            suffix="%"
            icon={Percent}
            variant="success"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Ingresos del mes"
            value={s.monthlyRevenue}
            formatValue={(n) => `$${formatCurrency(Math.round(n))}`}
            subtitle="Pagado + abonos parciales"
            icon={DollarSign}
            trend={
              trends?.monthlyRevenuePct != null
                ? {
                    value: Math.abs(trends.monthlyRevenuePct),
                    positive: trends.monthlyRevenuePct >= 0,
                  }
                : undefined
            }
            variant="accent"
          />
          <StatCard
            title="Ganancia del mes"
            value={s.monthlyProfit}
            formatValue={(n) => `$${formatCurrency(Math.round(n))}`}
            subtitle="Órdenes creadas este mes"
            icon={TrendingUp}
            variant="success"
          />
          <StatCard
            title="Cotizaciones pendientes"
            value={s.quotationsPending}
            icon={FileText}
            variant="warning"
          />
          <StatCard
            title="Clientes activos"
            value={s.customersActive}
            icon={Users}
            variant="default"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            title="Órdenes por cobrar"
            value={s.ordersUnpaidCount}
            subtitle="Sin pago al 100%"
            icon={Wallet}
            variant={s.ordersUnpaidCount > 0 ? "warning" : "success"}
          />
          <StatCard
            title="Saldo pendiente total"
            value={s.ordersUnpaidBalance}
            formatValue={(n) => `$${formatCurrency(Math.round(n))}`}
            subtitle="Deuda acumulada de clientes"
            icon={DollarSign}
            variant={s.ordersUnpaidBalance > 0 ? "destructive" : "success"}
          />
        </div>

        <InventoryMaterialStatusRings
          materials={materials}
          isLoading={isLoadingMaterials}
          showInventoryLink
        />

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Wallet className="h-4 w-4 text-amber-600" />
                Órdenes con pago pendiente
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Control de órdenes no pagadas o con abono parcial (saldo &gt; 0).
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/orders">Ver órdenes</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {unpaidOrders.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">
                No hay órdenes con saldo pendiente. Todas están pagadas al 100%.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {unpaidOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">
                          {order.shortId}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            paymentBadgeClass(order.estadoPago)
                          )}
                        >
                          {paymentLabel(order.estadoPago)}
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {order.porcentajePagado}% pagado
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {order.clienteNombre || "Sin cliente"}
                        {order.productoNombre ? ` · ${order.productoNombre}` : ""}
                      </p>
                      {order.fechaLimiteSaldo ? (
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          Límite de saldo: {order.fechaLimiteSaldo}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Cobrado
                        </p>
                        <p className="text-sm tabular-nums text-muted-foreground">
                          ${formatCurrency(order.montoCobrado)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Saldo
                        </p>
                        <p className="text-sm tabular-nums text-destructive">
                          ${formatCurrency(order.saldoPendiente)}
                        </p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Total
                        </p>
                        <p className="text-sm tabular-nums text-foreground">
                          ${formatCurrency(order.valorVenta)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold tracking-tight">Órdenes recientes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentOrders.length === 0 ? (
                <p className="px-6 py-8 text-sm text-muted-foreground">
                  No hay órdenes registradas.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between px-6 py-3 gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {order.shortId}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {order.clienteNombre}
                          {order.productoNombre ? ` · ${order.productoNombre}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm text-foreground tabular-nums">
                          ${formatCurrency(order.valorVenta)}
                        </span>
                        <StatusBadge status={asStatus(order.estado)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertas de producción
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay alertas activas</p>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10"
                    >
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {alert.shortId} — {alert.clienteNombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {alert.productoNombre || "Sin producto"}
                        </p>
                        <p className="text-xs text-destructive mt-1">
                          {alert.daysLate} día{alert.daysLate === 1 ? "" : "s"} de atraso
                          {alert.fechaEstimadaEntrega
                            ? ` · Vence: ${alert.fechaEstimadaEntrega}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={asStatus(alert.estado)} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
