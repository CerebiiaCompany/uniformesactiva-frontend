import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  DollarSign,
  Loader2,
  Package,
  Percent,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format-number";
import { useOrders, type Order } from "@/hooks/useOrders";
import { useGetClients } from "@/hooks/useGetClients";
import {
  buildOrderRealCostRows,
  groupProductivityByStage,
  mergeProfitabilityEstimates,
  summarizeOrderRealCosts,
} from "@/lib/real-costs-analytics";
import {
  getOrdersReport,
  getProductivityReport,
  getProfitabilityReport,
  getSalesReport,
} from "@/services/reportsService";
import type {
  OrdersReportResponse,
  ProductivityReportResponse,
  ProfitabilityReportResponse,
  SalesReportResponse,
} from "@/types/reports";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fmtMoney = (value: number) => `$${formatCurrency(value)}`;
const fmtPct = (value: number) =>
  `${value.toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  pending: "Pendientes",
  confirmed: "Confirmadas",
  in_production: "En producción",
  ready: "Listas",
  delivered: "Entregadas",
  cancelled: "Canceladas",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#ef4444",
  confirmed: "#f97316",
  in_production: "#b91c1c",
  ready: "#eab308",
  delivered: "#16a34a",
  draft: "#94a3b8",
  cancelled: "#64748b",
};

const PIE_FALLBACK = ["#dc2626", "#b91c1c", "#16a34a", "#f59e0b", "#2563eb", "#9333ea"];

function money(n: number) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function orderUnits(order: Order) {
  return (order.items || []).reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
}

function monthKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const m = String(iso).match(/^(\d{4})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}` : null;
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${mo}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d
    .toLocaleDateString("es-CO", { month: "short", year: "2-digit" })
    .replace(".", "");
}

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={String(p.name)} className="tabular-nums" style={{ color: p.color }}>
          {p.name}:{" "}
          {typeof p.value === "number" && Math.abs(p.value) >= 100
            ? fmtMoney(p.value)
            : String(p.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

function StatKpi({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: typeof DollarSign;
  tone: "red" | "orange" | "green" | "rose";
}) {
  const tones = {
    red: "bg-red-50 text-red-600 border-red-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4 pb-4 px-4 flex items-start gap-3">
        <div className={cn("h-10 w-10 rounded-xl border flex items-center justify-center shrink-0", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="text-xl font-bold tabular-nums text-foreground mt-0.5">{value}</p>
          {subtitle ? <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatisticsPanel() {
  const { orders, loading: ordersLoading, fetchOrders } = useOrders();
  const { clients } = useGetClients(1, 200);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [estado, setEstado] = useState("todos");
  const [clienteId, setClienteId] = useState("todos");
  const [loadingExtra, setLoadingExtra] = useState(true);

  const [recordsFilter, setRecordsFilter] = useState<"todos" | "con" | "sin">("todos");
  const [desviacionFilter, setDesviacionFilter] = useState<"cualquiera" | "positiva" | "negativa">(
    "cualquiera"
  );
  const [sortBy, setSortBy] = useState<"desviacion" | "real" | "estimado">("desviacion");
  const [topN, setTopN] = useState("10");

  const [profitability, setProfitability] = useState<ProfitabilityReportResponse | null>(null);
  const [sales, setSales] = useState<SalesReportResponse | null>(null);
  const [ordersReport, setOrdersReport] = useState<OrdersReportResponse | null>(null);
  const [productivity, setProductivity] = useState<ProductivityReportResponse | null>(null);

  const load = useCallback(async () => {
    setLoadingExtra(true);
    try {
      await fetchOrders({
        page: 1,
        page_size: 200,
        fecha_desde: dateFrom || undefined,
        fecha_hasta: dateTo || undefined,
        estado: estado === "todos" ? undefined : estado,
        cliente_id: clienteId === "todos" ? undefined : clienteId,
      });

      const [prof, salesRes, ordersRes, prod] = await Promise.all([
        getProfitabilityReport({
          estado: estado === "todos" ? undefined : estado,
        }),
        getSalesReport(),
        getOrdersReport({
          estado: estado === "todos" ? undefined : estado,
        }),
        getProductivityReport({
          estado: estado === "todos" ? undefined : estado,
        }),
      ]);
      setProfitability(prof);
      setSales(salesRes);
      setOrdersReport(ordersRes);
      setProductivity(prod);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las estadísticas");
    } finally {
      setLoadingExtra(false);
    }
  }, [fetchOrders, dateFrom, dateTo, estado, clienteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setEstado("todos");
    setClienteId("todos");
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (clienteId !== "todos" && o.cliente_id !== clienteId) return false;
      if (estado !== "todos" && o.estado !== estado) return false;
      if (dateFrom) {
        const created = (o.fecha_creacion || "").slice(0, 10);
        if (created && created < dateFrom) return false;
      }
      if (dateTo) {
        const created = (o.fecha_creacion || "").slice(0, 10);
        if (created && created > dateTo) return false;
      }
      return true;
    });
  }, [orders, clienteId, estado, dateFrom, dateTo]);

  const orderCostRows = useMemo(() => {
    const base = buildOrderRealCostRows(filteredOrders);
    return mergeProfitabilityEstimates(base, profitability?.rows ?? []);
  }, [filteredOrders, profitability?.rows]);

  const comparisonRows = useMemo(() => {
    let rows = [...orderCostRows];
    if (recordsFilter === "con") rows = rows.filter((r) => r.hasBreakdown);
    if (recordsFilter === "sin") rows = rows.filter((r) => !r.hasBreakdown);
    if (desviacionFilter === "positiva") rows = rows.filter((r) => r.desviacion > 0);
    if (desviacionFilter === "negativa") rows = rows.filter((r) => r.desviacion < 0);

    rows.sort((a, b) => {
      if (sortBy === "real") return b.real - a.real;
      if (sortBy === "estimado") return b.estimado - a.estimado;
      return Math.abs(b.desviacion) - Math.abs(a.desviacion);
    });

    const n = Number(topN) || 10;
    return rows.slice(0, n);
  }, [orderCostRows, recordsFilter, desviacionFilter, sortBy, topN]);

  const comparisonChart = useMemo(
    () =>
      comparisonRows.map((r) => ({
        name: `#${r.codigo}`,
        estimado: r.estimado,
        real: r.real,
        desviacion: r.desviacion,
      })),
    [comparisonRows]
  );

  const comparisonSummary = useMemo(() => summarizeOrderRealCosts(comparisonRows), [comparisonRows]);

  const kpis = useMemo(() => {
    const ventas = money(
      filteredOrders.reduce((s, o) => s + (Number(o.valor_venta_proyectado) || 0), 0)
    );
    const costos = money(filteredOrders.reduce((s, o) => s + (Number(o.costo_total) || 0), 0));
    const unidades = filteredOrders.reduce((s, o) => s + orderUnits(o), 0);
    const margenAbs = money(ventas - costos);
    const margenPct = ventas > 0 ? money((margenAbs / ventas) * 100) : 0;
    return {
      ventas,
      costos,
      unidades,
      margenAbs,
      margenPct,
      ordenes: filteredOrders.length,
    };
  }, [filteredOrders]);

  const salesVsCostsByMonth = useMemo(() => {
    const map = new Map<string, { key: string; ventas: number; costos: number }>();
    for (const o of filteredOrders) {
      const key = monthKey(o.fecha_creacion);
      if (!key) continue;
      const cur = map.get(key) || { key, ventas: 0, costos: 0 };
      cur.ventas += money(Number(o.valor_venta_proyectado) || 0);
      cur.costos += money(Number(o.costo_total) || 0);
      map.set(key, cur);
    }
    return [...map.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({
        mes: monthLabel(r.key),
        Ventas: money(r.ventas),
        Costos: money(r.costos),
      }));
  }, [filteredOrders]);

  const ordersByStatus = useMemo(() => {
    const map = new Map<string, number>();
    const source =
      ordersReport?.rows?.length && !dateFrom && !dateTo && clienteId === "todos"
        ? ordersReport.rows.map((r) => r.estado)
        : filteredOrders.map((o) => o.estado);

    for (const estadoKey of source) {
      const key = String(estadoKey || "pending");
      map.set(key, (map.get(key) || 0) + 1);
    }

    return [...map.entries()]
      .map(([key, value], idx) => ({
        name: STATUS_LABELS[key] || key,
        value,
        key,
        color: STATUS_COLORS[key] || PIE_FALLBACK[idx % PIE_FALLBACK.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredOrders, ordersReport?.rows, dateFrom, dateTo, clienteId]);

  const topClients = useMemo(() => {
    if (sales?.rows?.length && clienteId === "todos" && !dateFrom && !dateTo) {
      return [...sales.rows]
        .sort((a, b) => b.ventas - a.ventas)
        .slice(0, 5)
        .map((r) => ({
          cliente: r.cliente.length > 22 ? `${r.cliente.slice(0, 22)}…` : r.cliente,
          ventas: money(r.ventas),
        }));
    }

    const map = new Map<string, number>();
    for (const o of filteredOrders) {
      const name = o.cliente_nombre || "Sin cliente";
      map.set(name, money((map.get(name) || 0) + (Number(o.valor_venta_proyectado) || 0)));
    }
    return [...map.entries()]
      .map(([cliente, ventas]) => ({
        cliente: cliente.length > 22 ? `${cliente.slice(0, 22)}…` : cliente,
        ventas,
      }))
      .sort((a, b) => b.ventas - a.ventas)
      .slice(0, 5);
  }, [sales?.rows, filteredOrders, clienteId, dateFrom, dateTo]);

  const stageLoad = useMemo(() => {
    const stages = groupProductivityByStage(productivity?.rows ?? []);
    if (stages.length) {
      return stages.map((s) => ({
        etapa: s.label,
        carga: s.tarjetas,
        prendas: s.prendas,
      }));
    }

    const map = new Map<string, number>();
    for (const o of filteredOrders) {
      const etapa = o.etapa_produccion || "Sin etapa";
      map.set(etapa, (map.get(etapa) || 0) + 1);
    }
    return [...map.entries()].map(([etapa, carga]) => ({ etapa, carga, prendas: 0 }));
  }, [productivity?.rows, filteredOrders]);

  const loading = (ordersLoading || loadingExtra) && filteredOrders.length === 0;

  const clientOptions = useMemo(() => {
    const fromHook = clients.map((c) => ({ id: c.id, name: c.name }));
    if (fromHook.length) return fromHook;
    const map = new Map<string, string>();
    for (const o of orders) {
      if (o.cliente_id) map.set(o.cliente_id, o.cliente_nombre || o.cliente_id);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [clients, orders]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="confirmed">Confirmada</SelectItem>
                <SelectItem value="in_production">En producción</SelectItem>
                <SelectItem value="ready">Lista</SelectItem>
                <SelectItem value="delivered">Entregada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {clientOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={clearFilters}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Limpiar
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-9 text-xs" onClick={() => void load()}>
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando estadísticas…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatKpi
              title="Ventas"
              value={fmtMoney(kpis.ventas)}
              subtitle={`${kpis.ordenes} órdenes`}
              icon={DollarSign}
              tone="red"
            />
            <StatKpi
              title="Costos estimados"
              value={fmtMoney(kpis.costos)}
              icon={Package}
              tone="orange"
            />
            <StatKpi
              title="Margen"
              value={fmtPct(kpis.margenPct)}
              subtitle={fmtMoney(kpis.margenAbs)}
              icon={Percent}
              tone="green"
            />
            <StatKpi
              title="Unidades"
              value={String(kpis.unidades)}
              subtitle="prendas en el periodo"
              icon={AlertTriangle}
              tone="rose"
            />
          </div>

          <Card>
            <CardHeader className="pb-2 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Costo real vs. estimado por orden ({comparisonRows.length} órdenes)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Real {fmtMoney(comparisonSummary.realTotal)} · Estimado{" "}
                    {fmtMoney(comparisonSummary.estimadoTotal)} · Desviación{" "}
                    {fmtMoney(comparisonSummary.desviacion)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <Select
                  value={recordsFilter}
                  onValueChange={(v) => setRecordsFilter(v as typeof recordsFilter)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Registros de costo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Con y sin registros</SelectItem>
                    <SelectItem value="con">Solo con desglose</SelectItem>
                    <SelectItem value="sin">Solo sin desglose</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={desviacionFilter}
                  onValueChange={(v) => setDesviacionFilter(v as typeof desviacionFilter)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Desviación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cualquiera">Cualquiera</SelectItem>
                    <SelectItem value="positiva">Sobrecosto (real &gt; estimado)</SelectItem>
                    <SelectItem value="negativa">Ahorro (real &lt; estimado)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desviacion">Mayor desviación</SelectItem>
                    <SelectItem value="real">Mayor costo real</SelectItem>
                    <SelectItem value="estimado">Mayor estimado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={topN} onValueChange={setTopN}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Mostrar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Top 5</SelectItem>
                    <SelectItem value="10">Top 10</SelectItem>
                    <SelectItem value="20">Top 20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={comparisonChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    />
                    <Tooltip content={<MoneyTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="estimado" name="Estimado" fill="#6b7280" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="real" name="Costo real" fill="#dc2626" radius={[3, 3, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="desviacion"
                      name="Desviación"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Ventas vs. costos por mes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={salesVsCostsByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11 }} />
                      <Tooltip content={<MoneyTooltip />} />
                      <Legend />
                      <Bar dataKey="Ventas" fill="#dc2626" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Costos" fill="#9ca3af" radius={[3, 3, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Órdenes por estado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  {ordersByStatus.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-16">Sin órdenes</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ordersByStatus}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ name, value }) => `${value}`}
                        >
                          {ordersByStatus.map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top 5 clientes por ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      layout="vertical"
                      data={topClients}
                      margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis type="category" dataKey="cliente" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip content={<MoneyTooltip />} />
                      <Bar dataKey="ventas" name="Ventas" fill="#dc2626" radius={[0, 3, 3, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Carga por etapa de producción</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stageLoad} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="etapa"
                        tick={{ fontSize: 10 }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="carga"
                        name="Tarjetas / órdenes"
                        stroke="#dc2626"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#dc2626" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Datos 100% reales: órdenes filtradas, desglose de costo real, reportes de rentabilidad,
            ventas, órdenes y eficiencia del módulo Reportes.
          </p>
        </>
      )}
    </div>
  );
}
