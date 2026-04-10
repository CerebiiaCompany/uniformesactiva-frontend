import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { dashboardStats, orders, productionOrders } from "@/data/mockData";
import {
  ShoppingCart,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  Percent,
  FileText,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const recentOrders = orders.slice(0, 5);
  const delayedProduction = productionOrders.filter((po) => po.isDelayed);

  return (
    <AppLayout title="Dashboard" subtitle="Resumen general de operaciones">
      <div className="space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Órdenes en progreso"
            value={dashboardStats.ordersInProgress}
            icon={ShoppingCart}
            trend={{ value: 12, positive: true }}
            variant="default"
          />
          <StatCard
            title="Órdenes retrasadas"
            value={dashboardStats.delayedOrders}
            icon={AlertTriangle}
            variant="destructive"
          />
          <StatCard
            title="Tiempo prom. entrega"
            value={`${dashboardStats.avgDeliveryDays} días`}
            icon={Clock}
            trend={{ value: 5, positive: true }}
            variant="default"
          />
          <StatCard
            title="Margen promedio"
            value={`${dashboardStats.avgMargin}%`}
            icon={Percent}
            trend={{ value: 2.1, positive: true }}
            variant="success"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Ingresos del mes"
            value={`$${(dashboardStats.monthlyRevenue / 1000).toFixed(0)}K`}
            subtitle="MXN"
            icon={DollarSign}
            trend={{ value: 18, positive: true }}
            variant="accent"
          />
          <StatCard
            title="Ganancia del mes"
            value={`$${(dashboardStats.monthlyProfit / 1000).toFixed(0)}K`}
            subtitle="MXN"
            icon={TrendingUp}
            variant="success"
          />
          <StatCard
            title="Cotizaciones pendientes"
            value={dashboardStats.quotationsPending}
            icon={FileText}
            variant="warning"
          />
          <StatCard
            title="Clientes activos"
            value={dashboardStats.customersActive}
            icon={Users}
            variant="default"
          />
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Órdenes recientes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{order.id}</p>
                      <p className="text-xs text-muted-foreground truncate">{order.customerName} · {order.items}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-foreground">${order.revenue.toLocaleString()}</span>
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Delayed Alerts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertas de producción
              </CardTitle>
            </CardHeader>
            <CardContent>
              {delayedProduction.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay alertas activas</p>
              ) : (
                <div className="space-y-3">
                  {delayedProduction.map((po) => (
                    <div key={po.id} className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{po.orderId} — {po.customerName}</p>
                        <p className="text-xs text-muted-foreground">{po.items}</p>
                        <p className="text-xs text-destructive mt-1">
                          {po.daysInStage} días en etapa "{po.stage}" · Vence: {po.dueDate}
                        </p>
                      </div>
                      <StatusBadge status={po.stage} />
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
