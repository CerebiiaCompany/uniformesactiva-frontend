import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { orders } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Costing() {
  const totalCost = orders.reduce((s, o) => s + o.totalCost, 0);
  const totalRevenue = orders.reduce((s, o) => s + o.revenue, 0);
  const totalProfit = totalRevenue - totalCost;
  const avgMargin = orders.reduce((s, o) => s + o.margin, 0) / orders.length;

  return (
    <AppLayout title="Costos" subtitle="Análisis de costos y rentabilidad">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Costo total" value={`$${(totalCost / 1000).toFixed(0)}K`} icon={DollarSign} variant="default" />
          <StatCard title="Ingresos totales" value={`$${(totalRevenue / 1000).toFixed(0)}K`} icon={TrendingUp} variant="accent" />
          <StatCard title="Ganancia total" value={`$${(totalProfit / 1000).toFixed(0)}K`} icon={TrendingUp} variant="success" />
          <StatCard title="Margen promedio" value={`${avgMargin.toFixed(1)}%`} icon={TrendingDown} variant="warning" />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Rentabilidad por orden</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orders.map((order) => {
                const profit = order.revenue - order.totalCost;
                const barWidth = (order.margin / 40) * 100;
                return (
                  <div key={order.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-foreground">{order.id}</span>
                        <span className="text-xs text-muted-foreground ml-2">{order.customerName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {order.margin < 20 && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                        <span className={cn("text-sm font-bold", order.margin >= 25 ? "text-success" : order.margin >= 20 ? "text-warning" : "text-destructive")}>
                          {order.margin}%
                        </span>
                        <span className="text-xs text-muted-foreground w-20 text-right">${profit.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", order.margin >= 25 ? "bg-success" : order.margin >= 20 ? "bg-warning" : "bg-destructive")}
                        style={{ width: `${Math.min(barWidth, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
