import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useDashboard } from "@/hooks/useDashboard";
import type { StatusType } from "@/components/StatusBadge";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format-number";

function asStatus(value: string): StatusType {
  return value as StatusType;
}

export default function Dashboard() {
  const { loading, error, stats, trends, recentOrders, alerts } = useDashboard();

  if (loading && !stats) {
    return (
      <AppLayout title="Dashboard" subtitle="Resumen general de operaciones">
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando indicadores...</p>
        </div>
      </AppLayout>
    );
  }

  if (error && !stats) {
    return (
      <AppLayout title="Dashboard" subtitle="Resumen general de operaciones">
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
    <AppLayout title="Dashboard" subtitle="Resumen general de operaciones">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Órdenes recientes</CardTitle>
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
                        <span className="text-sm font-semibold text-foreground tabular-nums">
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
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
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
