import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Calculator,
  Download,
  FileText,
  Loader2,
  Package,
  Search,
  Shirt,
  Truck,
  Users,
  Workflow,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import type { StatusType } from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format-number";
import { printReportDocument } from "@/lib/report-print";
import { useOrders } from "@/hooks/useOrders";
import {
  buildGeneralConceptRows,
  buildOrderRealCostRows,
  buildProcessAnalyticsFromOrders,
  estimateRepairsFromSatellites,
  groupDeliveriesByType,
  groupInventoryByCategory,
  groupSatellitesByName,
  mergeProfitabilityEstimates,
  summarizeOrderRealCosts,
  type OrderRealCostRow,
} from "@/lib/real-costs-analytics";
import {
  getDeliveriesReport,
  getInventoryReport,
  getProfitabilityReport,
  getSatellitesReport,
} from "@/services/reportsService";
import type {
  DeliveriesReportResponse,
  InventoryReportResponse,
  ProfitabilityReportResponse,
  SatellitesReportResponse,
} from "@/types/reports";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fmtMoney = (value: number) => `$${formatCurrency(value)}`;
const fmtPct = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : `${value.toLocaleString("es-CO", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`;

/** Estilo unificado: tabla con celdas y valores centrados (Costos reales). */
const RC_TABLE = "border-collapse border border-border";
const RC_TH =
  "text-xs text-center font-semibold whitespace-nowrap border border-border bg-muted/50 px-2 py-2.5 h-auto text-foreground";
const RC_TD =
  "text-xs text-center tabular-nums border border-border px-2 py-2 align-middle";
const RC_TD_TEXT = "text-xs text-center border border-border px-2 py-2 align-middle";
const RC_TR_TOTAL = "bg-muted/40 font-semibold";

type SubTab =
  | "general"
  | "ordenes"
  | "inventario"
  | "mano_obra"
  | "satelites"
  | "entregas"
  | "procesos"
  | "productos";

const SUB_TABS: Array<{ id: SubTab; label: string }> = [
  { id: "general", label: "General" },
  { id: "ordenes", label: "Órdenes" },
  { id: "inventario", label: "Inventario" },
  { id: "mano_obra", label: "Mano de obra" },
  { id: "satelites", label: "Satélites" },
  { id: "entregas", label: "Entregas" },
  { id: "procesos", label: "Procesos" },
  { id: "productos", label: "Productos" },
];

function KpiCard({
  title,
  value,
  tone = "default",
}: {
  title: string;
  value: string;
  tone?: "default" | "danger" | "success" | "muted";
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4 pb-4 px-4">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
        <p
          className={cn(
            "mt-1.5 text-xl font-bold tabular-nums",
            tone === "danger" && "text-red-600",
            tone === "success" && "text-emerald-600",
            tone === "muted" && "text-muted-foreground",
            tone === "default" && "text-foreground"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
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
          {p.name}: {fmtMoney(Number(p.value) || 0)}
        </p>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  height = 280,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
      </CardHeader>
      <CardContent>
        <div style={{ width: "100%", height }}>{children}</div>
      </CardContent>
    </Card>
  );
}

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const lines = rows.map((cells) =>
    cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function RealCostsPanel() {
  const { orders, loading: ordersLoading, fetchOrders, totalCount } = useOrders();
  const [subTab, setSubTab] = useState<SubTab>("general");
  const [search, setSearch] = useState("");
  const [recordsFilter, setRecordsFilter] = useState<"todos" | "con" | "sin">("todos");
  const [loadingReports, setLoadingReports] = useState(true);
  const [printing, setPrinting] = useState(false);

  const [profitability, setProfitability] = useState<ProfitabilityReportResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryReportResponse | null>(null);
  const [satellites, setSatellites] = useState<SatellitesReportResponse | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveriesReportResponse | null>(null);

  const load = useCallback(async () => {
    setLoadingReports(true);
    try {
      await fetchOrders({ page: 1, page_size: 200 });
      const [prof, inv, sat, del] = await Promise.all([
        getProfitabilityReport(),
        getInventoryReport(),
        getSatellitesReport(),
        getDeliveriesReport(),
      ]);
      setProfitability(prof);
      setInventory(inv);
      setSatellites(sat);
      setDeliveries(del);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar costos reales");
    } finally {
      setLoadingReports(false);
    }
  }, [fetchOrders]);

  useEffect(() => {
    void load();
  }, [load]);

  const orderRowsAll = useMemo(() => {
    const base = buildOrderRealCostRows(orders);
    return mergeProfitabilityEstimates(base, profitability?.rows ?? []);
  }, [orders, profitability?.rows]);

  const orderRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orderRowsAll.filter((row) => {
      if (recordsFilter === "con" && !row.hasBreakdown) return false;
      if (recordsFilter === "sin" && row.hasBreakdown) return false;
      if (!q) return true;
      return (
        row.codigo.toLowerCase().includes(q) ||
        row.cliente.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q)
      );
    });
  }, [orderRowsAll, search, recordsFilter]);

  const summary = useMemo(() => summarizeOrderRealCosts(orderRows), [orderRows]);

  const conceptRows = useMemo(() => {
    const repairs = estimateRepairsFromSatellites(satellites?.rows ?? []);
    return buildGeneralConceptRows(orderRows, { repairs, samples: 0 });
  }, [orderRows, satellites?.rows]);

  const chartOrders = useMemo(() => {
    return orderRows.slice(0, 12).map((r, idx) => ({
      name: `#${String(idx + 1).padStart(3, "0")}`,
      codigo: r.codigo,
      estimado: r.estimado,
      real: r.real,
      desviacion: r.desviacion,
    }));
  }, [orderRows]);

  const inventoryByCat = useMemo(
    () => groupInventoryByCategory(inventory?.rows ?? []),
    [inventory?.rows]
  );
  const satellitesByName = useMemo(
    () => groupSatellitesByName(satellites?.rows ?? []),
    [satellites?.rows]
  );
  const deliveriesByType = useMemo(
    () => groupDeliveriesByType(deliveries?.rows ?? []),
    [deliveries?.rows]
  );

  const filteredOrders = useMemo(() => {
    const ids = new Set(orderRows.map((r) => r.id));
    return orders.filter((o) => ids.has(o.id));
  }, [orders, orderRows]);

  const processAnalytics = useMemo(
    () => buildProcessAnalyticsFromOrders(filteredOrders),
    [filteredOrders]
  );

  const laborByOrder = useMemo(
    () =>
      orderRows
        .filter((r) => r.labor + r.mold > 0)
        .sort((a, b) => b.labor + b.mold - (a.labor + a.mold))
        .slice(0, 12)
        .map((r) => ({
          name: r.codigo,
          labor: r.labor,
          mold: r.mold,
          total: r.labor + r.mold,
        })),
    [orderRows]
  );

  const productsByOrder = useMemo(() => {
    const map = new Map<
      string,
      { producto: string; estimado: number; real: number; ordenes: number; cantidad: number }
    >();
    for (const order of orders) {
      const name = order.producto_nombre || "Sin producto";
      const row = orderRowsAll.find((r) => r.id === order.id);
      if (!row) continue;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!name.toLowerCase().includes(q) && !row.codigo.toLowerCase().includes(q)) continue;
      }
      const cur = map.get(name) || {
        producto: name,
        estimado: 0,
        real: 0,
        ordenes: 0,
        cantidad: 0,
      };
      cur.estimado += row.estimado;
      cur.real += row.real;
      cur.ordenes += 1;
      cur.cantidad += row.cantidad;
      map.set(name, cur);
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        estimado: Math.round(r.estimado * 100) / 100,
        real: Math.round(r.real * 100) / 100,
      }))
      .sort((a, b) => b.real - a.real);
  }, [orders, orderRowsAll, search]);

  const loading = (ordersLoading || loadingReports) && orderRowsAll.length === 0;

  const titleByTab: Record<SubTab, { title: string; subtitle: string }> = {
    general: {
      title: "Costos reales – General",
      subtitle: "Costos consolidados de toda la operación por concepto",
    },
    ordenes: {
      title: "Costos reales – Órdenes",
      subtitle: "Costo real vs estimado por orden (desglose persistido + rentabilidad)",
    },
    inventario: {
      title: "Costos reales – Inventario",
      subtitle: "Valor de materiales en stock según el reporte de inventario",
    },
    mano_obra: {
      title: "Costos reales – Mano de obra",
      subtitle: "MO y moldería acumuladas desde el desglose de costo real por orden",
    },
    satelites: {
      title: "Costos reales – Satélites",
      subtitle: "Costos de mano de obra externa según el reporte de satélites",
    },
    entregas: {
      title: "Costos reales – Entregas",
      subtitle: "Costos de despacho y domicilios según el reporte de entregas",
    },
    procesos: {
      title: "Costos reales – Procesos",
      subtitle: "Costo acumulado por etapa del proceso productivo",
    },
    productos: {
      title: "Costos reales – Productos",
      subtitle: "Costo real vs estimado agrupado por producto de la orden",
    },
  };

  const handleExportCsv = () => {
    if (subTab === "general") {
      exportCsv(
        `costos-reales-general-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Concepto", "Origen", "Costo real", "Participación %", "Por prenda"],
        conceptRows.map((r) => [
          r.label,
          r.origin,
          String(r.amount),
          String(r.sharePct),
          String(r.perGarment),
        ])
      );
      return;
    }
    if (subTab === "ordenes" || subTab === "mano_obra") {
      exportCsv(
        `costos-reales-${subTab}-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Orden",
          "Cliente",
          "Estado",
          "Cant.",
          "Materiales",
          "Mano de obra",
          "Moldería",
          "Satélites",
          "Envíos",
          "Arreglos",
          "Muestras",
          "Costo real",
          "Costo est.",
          "Desviación",
          "Real/unid.",
          "Venta",
          "Margen real %",
        ],
        orderRows.map((r) => [
          r.codigo,
          r.cliente,
          r.estado,
          String(r.cantidad),
          String(r.materials),
          String(r.labor),
          String(r.mold),
          String(r.satellites),
          String(r.shipping),
          String(r.repairs),
          String(r.samples),
          r.hasBreakdown ? String(r.real) : "Sin registros",
          String(r.estimado),
          String(r.desviacion),
          String(r.realPerUnit),
          String(r.venta),
          r.margenReal == null ? "" : String(r.margenReal),
        ])
      );
      return;
    }
    if (subTab === "inventario") {
      exportCsv(
        `costos-reales-inventario-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Categoría", "Ítems", "Stock", "Valor"],
        inventoryByCat.map((r) => [r.categoria, String(r.items), String(r.stock), String(r.valor)])
      );
      return;
    }
    if (subTab === "satelites") {
      exportCsv(
        `costos-reales-satelites-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Satélite", "Trabajos", "Cantidad", "Costo", "Por liquidar"],
        satellitesByName.map((r) => [
          r.satelite,
          String(r.trabajos),
          String(r.cantidad),
          String(r.costo),
          String(r.porLiquidar),
        ])
      );
      return;
    }
    if (subTab === "entregas") {
      exportCsv(
        `costos-reales-entregas-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Tipo", "Movimientos", "Costo"],
        deliveriesByType.map((r) => [r.label, String(r.movimientos), String(r.costo)])
      );
      return;
    }
    if (subTab === "procesos") {
      exportCsv(
        `costos-reales-procesos-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Etapa",
          "Tarjetas",
          "Prendas",
          "Materiales",
          "Mano de obra",
          "Moldería",
          "Satélites",
          "Total",
          "Participación %",
        ],
        processAnalytics.byStage.map((r) => [
          r.label,
          String(r.tarjetas),
          String(r.prendas),
          String(r.materials),
          String(r.labor),
          String(r.mold),
          String(r.satellites),
          String(r.total),
          String(r.sharePct),
        ])
      );
      return;
    }
    exportCsv(
      `costos-reales-productos-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Producto", "Órdenes", "Cantidad", "Estimado", "Real"],
      productsByOrder.map((r) => [
        r.producto,
        String(r.ordenes),
        String(r.cantidad),
        String(r.estimado),
        String(r.real),
      ])
    );
  };

  const handlePrintPdf = async () => {
    setPrinting(true);
    try {
      if (subTab === "general") {
        await printReportDocument({
          title: "Costos reales – General",
          documentLabel: "Informe de costos reales",
          summary: [
            { label: "Costo real total", value: fmtMoney(summary.realTotal) },
            { label: "Costo estimado", value: fmtMoney(summary.estimadoTotal) },
            { label: "Desviación", value: fmtMoney(summary.desviacion) },
            { label: "Margen real", value: fmtPct(summary.margenReal) },
            { label: "Órdenes en filtro", value: String(summary.ordenes) },
          ],
          columns: [
            { key: "c", label: "Concepto" },
            { key: "o", label: "Origen" },
            { key: "a", label: "Costo real", align: "right" },
            { key: "p", label: "Participación %", align: "right" },
            { key: "g", label: "Por prenda", align: "right" },
          ],
          rows: conceptRows.map((r) => [
            r.label,
            r.origin,
            fmtMoney(r.amount),
            fmtPct(r.sharePct),
            fmtMoney(r.perGarment),
          ]),
          totalsRow: [
            "TOTAL",
            "",
            fmtMoney(summary.realTotal),
            "100%",
            "",
          ],
          notes:
            "Fuente: desglose de costo real por orden + reportes de satélites/entregas/inventario del módulo Reportes.",
          signLeft: "Elaborado por",
          signRight: "Revisado por",
        });
      } else if (subTab === "ordenes") {
        await printReportDocument({
          title: "Costos reales – Órdenes",
          documentLabel: "Informe por orden",
          summary: [
            { label: "Órdenes", value: String(orderRows.length) },
            { label: "Costo real", value: fmtMoney(summary.realTotal) },
            { label: "Estimado", value: fmtMoney(summary.estimadoTotal) },
          ],
          columns: [
            { key: "o", label: "Orden" },
            { key: "c", label: "Cliente" },
            { key: "e", label: "Estimado", align: "right" },
            { key: "r", label: "Real", align: "right" },
            { key: "d", label: "Desviación", align: "right" },
          ],
          rows: orderRows.map((r) => [
            r.codigo,
            r.cliente,
            fmtMoney(r.estimado),
            fmtMoney(r.real),
            fmtMoney(r.desviacion),
          ]),
          notes: "Comparativo estimado (costo_total / rentabilidad) vs costo real acumulado.",
          signLeft: "Elaborado por",
          signRight: "Revisado por",
        });
      } else {
        toast.message("Usa CSV/Excel para exportar el detalle de esta pestaña.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF");
    } finally {
      setPrinting(false);
    }
  };

  const meta = titleByTab[subTab];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4 text-red-600" />
            {meta.title}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">{meta.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            CSV / Excel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs bg-red-600 hover:bg-red-700"
            disabled={printing}
            onClick={() => void handlePrintPdf()}
          >
            {printing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
            PDF
          </Button>
        </div>
      </div>

      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTab)} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/50 p-1">
          {SUB_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 py-1.5">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <Card>
          <CardContent className="pt-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Orden, cliente o prenda"
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Registros de costo</Label>
              <Select
                value={recordsFilter}
                onValueChange={(v) => setRecordsFilter(v as typeof recordsFilter)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Con y sin registros</SelectItem>
                  <SelectItem value="con">Solo con desglose real</SelectItem>
                  <SelectItem value="sin">Solo sin desglose</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex items-end justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {orderRows.length} orden(es) en el filtro
                {totalCount > orders.length ? ` · listando ${orders.length} de ${totalCount}` : ""}
              </p>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void load()}>
                Actualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando costos reales…
          </div>
        ) : (
          <>
            <TabsContent value="general" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard title="Costo real total" value={fmtMoney(summary.realTotal)} tone="danger" />
                <KpiCard title="Costo estimado" value={fmtMoney(summary.estimadoTotal)} />
                <KpiCard
                  title="Desviación"
                  value={fmtMoney(summary.desviacion)}
                  tone={summary.desviacion > 0 ? "danger" : summary.desviacion < 0 ? "success" : "default"}
                />
                <KpiCard title="Margen real" value={fmtPct(summary.margenReal)} tone="muted" />
              </div>

              <ChartCard
                title={`Costo real vs. estimado por orden (${Math.min(orderRows.length, 12)} órdenes)`}
                subtitle="Barras: costo registrado en operación frente al estimado. Línea: desviación (real − estimado)."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartOrders} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              </ChartCard>

              <DetailTable
                title={`Detalle (${conceptRows.length} registros)`}
                headers={["Concepto", "Origen", "Costo real", "Participación", "Por prenda"]}
                rows={conceptRows.map((r) => [
                  r.label,
                  r.origin,
                  fmtMoney(r.amount),
                  fmtPct(r.sharePct),
                  fmtMoney(r.perGarment),
                ])}
                footer={[
                  "TOTAL",
                  "",
                  fmtMoney(summary.realTotal),
                  "100%",
                  "",
                ]}
              />
            </TabsContent>

            <TabsContent value="ordenes" className="space-y-4 mt-0">
              <OrdersTabContent rows={orderRows} chartOrders={chartOrders} summary={summary} />
            </TabsContent>

            <TabsContent value="inventario" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KpiCard
                  title="Valor inventario"
                  value={fmtMoney(inventory?.summary.valor_inventario ?? 0)}
                  tone="danger"
                />
                <KpiCard title="Materiales" value={String(inventory?.summary.materiales_total ?? 0)} />
                <KpiCard title="Stock bajo" value={String(inventory?.summary.stock_bajo ?? 0)} />
              </div>
              <ChartCard
                title="Valor de inventario por categoría"
                subtitle="Fuente: reporte de Inventario del módulo Reportes"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={inventoryByCat.slice(0, 10)}
                    margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="categoria" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip content={<MoneyTooltip />} />
                    <Bar dataKey="valor" name="Valor" fill="#dc2626" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              <DetailTable
                title={`Detalle por categoría (${inventoryByCat.length})`}
                headers={["Categoría", "Ítems", "Stock", "Valor"]}
                rows={inventoryByCat.map((r) => [
                  r.categoria,
                  String(r.items),
                  Number(r.stock).toLocaleString("es-CO", {
                    maximumFractionDigits: 2,
                  }),
                  fmtMoney(r.valor),
                ])}
              />
            </TabsContent>

            <TabsContent value="mano_obra" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KpiCard
                  title="MO total"
                  value={fmtMoney(orderRows.reduce((s, r) => s + r.labor, 0))}
                  tone="danger"
                />
                <KpiCard
                  title="Moldería"
                  value={fmtMoney(orderRows.reduce((s, r) => s + r.mold, 0))}
                />
                <KpiCard
                  title="MO + moldería"
                  value={fmtMoney(orderRows.reduce((s, r) => s + r.labor + r.mold, 0))}
                />
              </div>
              <ChartCard
                title="Mano de obra por orden"
                subtitle="Desde desglose de costo real (laborLines / mold)"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={laborByOrder} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip content={<MoneyTooltip />} />
                    <Legend />
                    <Bar dataKey="labor" name="Mano de obra" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="mold" name="Moldería" stackId="a" fill="#86efac" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              <DetailTable
                title={`Detalle MO (${orderRows.filter((r) => r.labor + r.mold > 0).length})`}
                headers={["Orden", "Cliente", "MO", "Moldería", "Total"]}
                rows={orderRows
                  .filter((r) => r.labor + r.mold > 0)
                  .map((r) => [
                    r.codigo,
                    r.cliente,
                    fmtMoney(r.labor),
                    fmtMoney(r.mold),
                    fmtMoney(r.labor + r.mold),
                  ])}
              />
            </TabsContent>

            <TabsContent value="satelites" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KpiCard
                  title="Costo satélites"
                  value={fmtMoney(satellites?.summary.costo_total ?? 0)}
                  tone="danger"
                />
                <KpiCard title="Por liquidar" value={fmtMoney(satellites?.summary.por_liquidar ?? 0)} />
                <KpiCard title="Trabajos" value={String(satellites?.summary.trabajos_total ?? 0)} />
              </div>
              <ChartCard title="Costo por satélite" subtitle="Fuente: reporte de Satélites">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={satellitesByName.slice(0, 10)}
                    margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="satelite" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip content={<MoneyTooltip />} />
                    <Legend />
                    <Bar dataKey="costo" name="Costo" fill="#dc2626" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="porLiquidar" name="Por liquidar" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              <DetailTable
                title={`Detalle satélites (${satellitesByName.length})`}
                headers={["Satélite", "Trabajos", "Cant.", "Costo", "Por liquidar"]}
                rows={satellitesByName.map((r) => [
                  r.satelite,
                  String(r.trabajos),
                  String(r.cantidad),
                  fmtMoney(r.costo),
                  fmtMoney(r.porLiquidar),
                ])}
              />
            </TabsContent>

            <TabsContent value="entregas" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KpiCard
                  title="Costo envíos"
                  value={fmtMoney(deliveries?.summary.costo_envios ?? 0)}
                  tone="danger"
                />
                <KpiCard
                  title="Costo promedio"
                  value={fmtMoney(deliveries?.summary.costo_promedio ?? 0)}
                />
                <KpiCard title="Movimientos" value={String(deliveries?.summary.movimientos_total ?? 0)} />
              </div>
              <ChartCard title="Costo por tipo de entrega" subtitle="Fuente: reporte de Entregas">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={deliveriesByType} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip content={<MoneyTooltip />} />
                    <Bar dataKey="costo" name="Costo" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              <DetailTable
                title={`Detalle entregas (${deliveries?.rows.length ?? 0})`}
                headers={["Código", "Tipo", "Orden", "Destino", "Costo"]}
                rows={(deliveries?.rows ?? []).slice(0, 50).map((r) => [
                  r.codigo || r.id,
                  r.tipo_label,
                  r.orden,
                  r.destino,
                  fmtMoney(r.costo),
                ])}
              />
            </TabsContent>

            <TabsContent value="procesos" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  title="Costo en proceso"
                  value={fmtMoney(processAnalytics.summary.costoEnProceso)}
                  tone="danger"
                />
                <KpiCard
                  title="Etapas con costo"
                  value={String(processAnalytics.summary.etapasConCosto)}
                />
                <KpiCard
                  title="Tarjetas"
                  value={String(processAnalytics.summary.tarjetas)}
                />
                <KpiCard
                  title="Costo por prenda"
                  value={fmtMoney(processAnalytics.summary.costoPorPrenda)}
                />
              </div>
              <ChartCard
                title={`Costo por etapa (${processAnalytics.byStage.length})`}
                subtitle="Materiales + mano de obra + moldería + satélites acumulados por etapa"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={processAnalytics.byStage.map((r) => ({
                      label: r.label,
                      total: r.total,
                      prendas: r.prendas,
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip content={<MoneyTooltip />} />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="total"
                      name="Costo total"
                      fill="#dc2626"
                      radius={[3, 3, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="prendas"
                      name="Prendas"
                      stroke="#f59e0b"
                      strokeWidth={2}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    Detalle ({processAnalytics.byStage.length} registros)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto p-px">
                    <Table className={RC_TABLE}>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-0">
                          {[
                            "Etapa",
                            "Tarjetas",
                            "Prendas",
                            "Materiales",
                            "Mano de obra",
                            "Moldería",
                            "Satélites",
                            "Total",
                            "Particip.",
                          ].map((h) => (
                            <TableHead key={h} className={RC_TH}>
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processAnalytics.byStage.length === 0 ? (
                          <TableRow className="hover:bg-transparent border-0">
                            <TableCell
                              colSpan={9}
                              className={cn(RC_TD_TEXT, "text-muted-foreground py-8")}
                            >
                              Sin datos de proceso para las órdenes filtradas.
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {processAnalytics.byStage.map((r) => (
                              <TableRow key={r.etapa} className="hover:bg-muted/30 border-0">
                                <TableCell className={cn(RC_TD_TEXT, "font-medium")}>
                                  {r.label}
                                </TableCell>
                                <TableCell className={RC_TD}>{r.tarjetas}</TableCell>
                                <TableCell className={RC_TD}>{r.prendas}</TableCell>
                                <TableCell className={RC_TD}>{fmtMoney(r.materials)}</TableCell>
                                <TableCell className={RC_TD}>{fmtMoney(r.labor)}</TableCell>
                                <TableCell className={RC_TD}>{fmtMoney(r.mold)}</TableCell>
                                <TableCell className={RC_TD}>{fmtMoney(r.satellites)}</TableCell>
                                <TableCell className={cn(RC_TD, "font-semibold")}>
                                  {fmtMoney(r.total)}
                                </TableCell>
                                <TableCell className={RC_TD}>{fmtPct(r.sharePct)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className={cn(RC_TR_TOTAL, "hover:bg-muted/40 border-0")}>
                              <TableCell className={RC_TD_TEXT}>Totales</TableCell>
                              <TableCell className={RC_TD}>
                                {processAnalytics.summary.tarjetas}
                              </TableCell>
                              <TableCell className={RC_TD}>
                                {processAnalytics.summary.prendas}
                              </TableCell>
                              <TableCell className={RC_TD}>
                                {fmtMoney(
                                  processAnalytics.byStage.reduce((s, r) => s + r.materials, 0)
                                )}
                              </TableCell>
                              <TableCell className={RC_TD}>
                                {fmtMoney(
                                  processAnalytics.byStage.reduce((s, r) => s + r.labor, 0)
                                )}
                              </TableCell>
                              <TableCell className={RC_TD}>
                                {fmtMoney(
                                  processAnalytics.byStage.reduce((s, r) => s + r.mold, 0)
                                )}
                              </TableCell>
                              <TableCell className={RC_TD}>
                                {fmtMoney(
                                  processAnalytics.byStage.reduce((s, r) => s + r.satellites, 0)
                                )}
                              </TableCell>
                              <TableCell className={RC_TD}>
                                {fmtMoney(processAnalytics.summary.costoEnProceso)}
                              </TableCell>
                              <TableCell className={RC_TD}>
                                {processAnalytics.summary.costoEnProceso > 0 ? "100%" : "0.0%"}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="productos" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KpiCard title="Productos" value={String(productsByOrder.length)} />
                <KpiCard
                  title="Costo real"
                  value={fmtMoney(productsByOrder.reduce((s, r) => s + r.real, 0))}
                  tone="danger"
                />
                <KpiCard
                  title="Estimado"
                  value={fmtMoney(productsByOrder.reduce((s, r) => s + r.estimado, 0))}
                />
              </div>
              <ChartCard title="Costo real vs estimado por producto" subtitle="Agrupado desde órdenes + desglose real">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={productsByOrder.slice(0, 10).map((r) => ({
                      name: r.producto.length > 18 ? `${r.producto.slice(0, 18)}…` : r.producto,
                      estimado: r.estimado,
                      real: r.real,
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip content={<MoneyTooltip />} />
                    <Legend />
                    <Bar dataKey="estimado" name="Estimado" fill="#6b7280" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="real" name="Costo real" fill="#dc2626" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              <DetailTable
                title={`Detalle productos (${productsByOrder.length})`}
                headers={["Producto", "Órdenes", "Cant.", "Estimado", "Real", "Desviación"]}
                rows={productsByOrder.map((r) => [
                  r.producto,
                  String(r.ordenes),
                  String(r.cantidad),
                  fmtMoney(r.estimado),
                  fmtMoney(r.real),
                  fmtMoney(r.real - r.estimado),
                ])}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <p className="text-[11px] text-muted-foreground flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" /> Inventario</span>
        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Satélites</span>
        <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" /> Entregas</span>
        <span className="inline-flex items-center gap-1"><Workflow className="h-3 w-3" /> Procesos</span>
        <span className="inline-flex items-center gap-1"><Shirt className="h-3 w-3" /> Productos</span>
        · Datos tomados de los mismos reportes del módulo y del desglose de costo real por orden.
      </p>
    </div>
  );
}

function OrdersTabContent({
  rows,
  chartOrders,
  summary,
}: {
  rows: OrderRealCostRow[];
  chartOrders: Array<{ name: string; estimado: number; real: number; desviacion: number }>;
  summary: ReturnType<typeof summarizeOrderRealCosts>;
}) {
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.cantidad += r.cantidad;
        acc.materials += r.materials;
        acc.labor += r.labor;
        acc.mold += r.mold;
        acc.satellites += r.satellites;
        acc.shipping += r.shipping;
        acc.repairs += r.repairs;
        acc.samples += r.samples;
        acc.real += r.real;
        acc.estimado += r.estimado;
        acc.desviacion += r.desviacion;
        acc.venta += r.venta;
        return acc;
      },
      {
        cantidad: 0,
        materials: 0,
        labor: 0,
        mold: 0,
        satellites: 0,
        shipping: 0,
        repairs: 0,
        samples: 0,
        real: 0,
        estimado: 0,
        desviacion: 0,
        venta: 0,
      }
    );
  }, [rows]);

  const margenTotal =
    totals.venta > 0
      ? ((totals.venta - totals.real) / totals.venta) * 100
      : null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Costo real" value={fmtMoney(summary.realTotal)} tone="danger" />
        <KpiCard title="Estimado" value={fmtMoney(summary.estimadoTotal)} />
        <KpiCard title="Desviación" value={fmtMoney(summary.desviacion)} />
        <KpiCard title="Con desglose" value={`${summary.conRegistro}/${summary.ordenes}`} />
      </div>
      <ChartCard
        title="Costo real vs estimado por orden"
        subtitle="Desglose persistido + Kanban de cada orden real"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartOrders} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11 }} />
            <Tooltip content={<MoneyTooltip />} />
            <Legend />
            <Bar dataKey="estimado" name="Estimado" fill="#6b7280" radius={[3, 3, 0, 0]} />
            <Bar dataKey="real" name="Costo real" fill="#dc2626" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="desviacion" name="Desviación" stroke="#f59e0b" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Detalle ({rows.length} registros)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto p-px">
            <Table className={RC_TABLE}>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-0">
                  {[
                    "Orden",
                    "Cliente",
                    "Estado",
                    "Cant.",
                    "Materiales",
                    "Mano de obra",
                    "Moldería",
                    "Satélites",
                    "Envíos",
                    "Arreglos",
                    "Muestras",
                    "Costo real",
                    "Costo est.",
                    "Desv.",
                    "Real/unid.",
                    "Venta",
                    "Margen real",
                  ].map((h) => (
                    <TableHead key={h} className={RC_TH}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent border-0">
                    <TableCell
                      colSpan={17}
                      className={cn(RC_TD_TEXT, "text-muted-foreground py-8")}
                    >
                      Sin órdenes para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/30 border-0">
                      <TableCell className={cn(RC_TD_TEXT, "font-semibold whitespace-nowrap")}>
                        {r.codigo}
                      </TableCell>
                      <TableCell className={cn(RC_TD_TEXT, "max-w-[140px] truncate")}>
                        {r.cliente}
                      </TableCell>
                      <TableCell className={RC_TD_TEXT}>
                        <div className="flex justify-center">
                          <StatusBadge status={(r.estado as StatusType) || "pending"} compact />
                        </div>
                      </TableCell>
                      <TableCell className={RC_TD}>{r.cantidad}</TableCell>
                      <TableCell className={RC_TD}>{fmtMoney(r.materials)}</TableCell>
                      <TableCell className={RC_TD}>{fmtMoney(r.labor)}</TableCell>
                      <TableCell className={RC_TD}>{fmtMoney(r.mold)}</TableCell>
                      <TableCell className={RC_TD}>{fmtMoney(r.satellites)}</TableCell>
                      <TableCell className={RC_TD}>{fmtMoney(r.shipping)}</TableCell>
                      <TableCell className={RC_TD}>{fmtMoney(r.repairs)}</TableCell>
                      <TableCell className={RC_TD}>{fmtMoney(r.samples)}</TableCell>
                      <TableCell className={RC_TD}>
                        {r.hasBreakdown && r.real > 0 ? (
                          <span className="font-medium">{fmtMoney(r.real)}</span>
                        ) : r.hasBreakdown ? (
                          fmtMoney(0)
                        ) : (
                          <span className="text-muted-foreground">Sin registros</span>
                        )}
                      </TableCell>
                      <TableCell className={RC_TD}>{fmtMoney(r.estimado)}</TableCell>
                      <TableCell
                        className={cn(
                          RC_TD,
                          r.desviacion > 0 && "text-red-600",
                          r.desviacion < 0 && "text-emerald-600"
                        )}
                      >
                        {fmtMoney(r.desviacion)}
                      </TableCell>
                      <TableCell className={RC_TD}>{fmtMoney(r.realPerUnit)}</TableCell>
                      <TableCell className={RC_TD}>{fmtMoney(r.venta)}</TableCell>
                      <TableCell className={RC_TD}>{fmtPct(r.margenReal)}</TableCell>
                    </TableRow>
                  ))
                )}
                {rows.length > 0 ? (
                  <TableRow className={cn(RC_TR_TOTAL, "hover:bg-muted/40 border-0")}>
                    <TableCell className={RC_TD_TEXT} colSpan={3}>
                      Totales
                    </TableCell>
                    <TableCell className={RC_TD}>{totals.cantidad}</TableCell>
                    <TableCell className={RC_TD}>{fmtMoney(totals.materials)}</TableCell>
                    <TableCell className={RC_TD}>{fmtMoney(totals.labor)}</TableCell>
                    <TableCell className={RC_TD}>{fmtMoney(totals.mold)}</TableCell>
                    <TableCell className={RC_TD}>{fmtMoney(totals.satellites)}</TableCell>
                    <TableCell className={RC_TD}>{fmtMoney(totals.shipping)}</TableCell>
                    <TableCell className={RC_TD}>{fmtMoney(totals.repairs)}</TableCell>
                    <TableCell className={RC_TD}>{fmtMoney(totals.samples)}</TableCell>
                    <TableCell className={RC_TD}>{fmtMoney(totals.real)}</TableCell>
                    <TableCell className={RC_TD}>{fmtMoney(totals.estimado)}</TableCell>
                    <TableCell className={RC_TD}>{fmtMoney(totals.desviacion)}</TableCell>
                    <TableCell className={RC_TD}>
                      {totals.cantidad > 0 ? fmtMoney(totals.real / totals.cantidad) : fmtMoney(0)}
                    </TableCell>
                    <TableCell className={RC_TD}>{fmtMoney(totals.venta)}</TableCell>
                    <TableCell className={RC_TD}>{fmtPct(margenTotal)}</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function DetailTable({
  title,
  headers,
  rows,
  footer,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  footer?: string[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto p-px">
          <Table className={RC_TABLE}>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-0">
                {headers.map((h) => (
                  <TableHead key={h} className={RC_TH}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent border-0">
                  <TableCell
                    colSpan={headers.length}
                    className={cn(RC_TD_TEXT, "text-muted-foreground py-8")}
                  >
                    Sin datos para mostrar.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((cells, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/30 border-0">
                    {cells.map((cell, cIdx) => (
                      <TableCell key={cIdx} className={RC_TD}>
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
              {footer ? (
                <TableRow className={cn(RC_TR_TOTAL, "hover:bg-muted/40 border-0")}>
                  {footer.map((cell, cIdx) => (
                    <TableCell key={cIdx} className={RC_TD}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
