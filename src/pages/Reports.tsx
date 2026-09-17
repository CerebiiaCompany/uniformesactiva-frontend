import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  DollarSign,
  Eye,
  Factory,
  FileText,
  Loader2,
  TrendingUp,
  Truck,
  Users,
  ClipboardList,
  Package,
  ShoppingCart,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import { RealCostsPanel } from "@/components/reports/RealCostsPanel";
import { StatisticsPanel } from "@/components/reports/StatisticsPanel";
import { getClientsReport, getDeliveriesReport, getInventoryReport, getOrdersReport, getProductivityReport, getProfitabilityReport, getPurchasesReport, getQuotesReport, getSalesReport, getSatellitesReport } from "@/services/reportsService";
import type { ReportCardDefinition } from "@/types/reports";

const fmtMoney = (value: number) => `$${formatCurrency(value)}`;

const staticReports: ReportCardDefinition[] = [];

const iconByReport: Record<string, typeof FileText> = {
  ordenes: FileText,
  ventas: TrendingUp,
  rentabilidad: BarChart3,
  eficiencia: Factory,
  cotizaciones: ClipboardList,
  inventario: Package,
  compras: ShoppingCart,
  satelites: Users,
  entregas: Truck,
  clientes: Users,
};

function ReportCard({
  report,
}: {
  report: ReportCardDefinition & { icon?: typeof FileText };
}) {
  const Icon = report.icon || FileText;
  const content = (
    <Card
      className={cn(
        "transition-shadow h-full",
        report.disabled
          ? "opacity-70 cursor-not-allowed"
          : "hover:shadow-md cursor-pointer"
      )}
    >
      <CardContent className="p-5 flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{report.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{report.description}</p>
          {report.countLabel ? (
            <p className="text-xs font-semibold text-red-600 mt-2">{report.countLabel}</p>
          ) : null}
        </div>
        {!report.disabled && report.route ? (
          <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" asChild>
            <span>
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Abrir
            </span>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );

  if (report.disabled || !report.route) {
    return content;
  }

  return <Link to={report.route}>{content}</Link>;
}

export default function Reports() {
  const [ordersSummary, setOrdersSummary] = useState<{
    activas: number;
    loading: boolean;
  }>({ activas: 0, loading: true });
  const [salesSummary, setSalesSummary] = useState<{
    ventas: number;
    cotizacionesAprobadas: number;
    cotizacionesTotal: number;
    loading: boolean;
  }>({
    ventas: 0,
    cotizacionesAprobadas: 0,
    cotizacionesTotal: 0,
    loading: true,
  });

  const [profitabilitySummary, setProfitabilitySummary] = useState<{
    margenPromedio: number;
    utilidad: number;
    loading: boolean;
  }>({ margenPromedio: 0, utilidad: 0, loading: true });

  const [productivitySummary, setProductivitySummary] = useState<{
    tarjetasActivas: number;
    retrasadas: number;
    loading: boolean;
  }>({ tarjetasActivas: 0, retrasadas: 0, loading: true });

  const [quotesSummary, setQuotesSummary] = useState<{
    total: number;
    aprobadas: number;
    pipeline: number;
    loading: boolean;
  }>({ total: 0, aprobadas: 0, pipeline: 0, loading: true });

  const [inventorySummary, setInventorySummary] = useState<{
    materiales: number;
    valor: number;
    stockBajo: number;
    tnsDisponible: boolean;
    loading: boolean;
  }>({ materiales: 0, valor: 0, stockBajo: 0, tnsDisponible: true, loading: true });

  const [purchasesSummary, setPurchasesSummary] = useState<{
    proveedores: number;
    monto: number;
    compras: number;
    tnsDisponible: boolean;
    loading: boolean;
  }>({ proveedores: 0, monto: 0, compras: 0, tnsDisponible: true, loading: true });

  const [satellitesSummary, setSatellitesSummary] = useState<{
    trabajos: number;
    activos: number;
    porLiquidar: number;
    loading: boolean;
  }>({ trabajos: 0, activos: 0, porLiquidar: 0, loading: true });

  const [deliveriesSummary, setDeliveriesSummary] = useState<{
    movimientos: number;
    entregados: number;
    costo: number;
    loading: boolean;
  }>({ movimientos: 0, entregados: 0, costo: 0, loading: true });

  const [clientsSummary, setClientsSummary] = useState<{
    clientes: number;
    facturacion: number;
    ordenes: number;
    loading: boolean;
  }>({ clientes: 0, facturacion: 0, ordenes: 0, loading: true });

  useEffect(() => {
    let mounted = true;
    getOrdersReport()
      .then((res) => {
        if (!mounted) return;
        setOrdersSummary({
          activas: res.summary.ordenes_activas,
          loading: false,
        });
      })
      .catch(() => {
        if (mounted) setOrdersSummary((prev) => ({ ...prev, loading: false }));
      });
    getSalesReport()
      .then((res) => {
        if (!mounted) return;
        setSalesSummary({
          ventas: res.summary.ventas_totales,
          cotizacionesAprobadas: res.summary.cotizaciones_aprobadas,
          cotizacionesTotal: res.summary.cotizaciones_total,
          loading: false,
        });
      })
      .catch(() => {
        if (mounted) setSalesSummary((prev) => ({ ...prev, loading: false }));
      });
    getProfitabilityReport()
      .then((res) => {
        if (!mounted) return;
        setProfitabilitySummary({
          margenPromedio: res.summary.margen_promedio,
          utilidad: res.summary.utilidad,
          loading: false,
        });
      })
      .catch(() => {
        if (mounted) setProfitabilitySummary((prev) => ({ ...prev, loading: false }));
      });
    getProductivityReport()
      .then((res) => {
        if (!mounted) return;
        setProductivitySummary({
          tarjetasActivas: res.summary.tarjetas_activas,
          retrasadas: res.summary.retrasadas,
          loading: false,
        });
      })
      .catch(() => {
        if (mounted) setProductivitySummary((prev) => ({ ...prev, loading: false }));
      });
    getQuotesReport()
      .then((res) => {
        if (!mounted) return;
        setQuotesSummary({
          total: res.summary.cotizaciones_total,
          aprobadas: res.summary.cotizaciones_aprobadas,
          pipeline: res.summary.pipeline_ponderado,
          loading: false,
        });
      })
      .catch(() => {
        if (mounted) setQuotesSummary((prev) => ({ ...prev, loading: false }));
      });
    getInventoryReport()
      .then((res) => {
        if (!mounted) return;
        setInventorySummary({
          materiales: res.summary.materiales_total,
          valor: res.summary.valor_inventario,
          stockBajo: res.summary.stock_bajo,
          tnsDisponible: res.summary.tns_disponible !== false,
          loading: false,
        });
      })
      .catch(() => {
        if (mounted) setInventorySummary((prev) => ({ ...prev, loading: false }));
      });
    getPurchasesReport()
      .then((res) => {
        if (!mounted) return;
        setPurchasesSummary({
          proveedores: res.summary.proveedores_total,
          monto: res.summary.monto_comprado,
          compras: res.summary.compras_registradas,
          tnsDisponible: res.summary.tns_disponible !== false,
          loading: false,
        });
      })
      .catch(() => {
        if (mounted) setPurchasesSummary((prev) => ({ ...prev, loading: false }));
      });
    getSatellitesReport()
      .then((res) => {
        if (!mounted) return;
        setSatellitesSummary({
          trabajos: res.summary.trabajos_total,
          activos: res.summary.satelites_activos,
          porLiquidar: res.summary.por_liquidar,
          loading: false,
        });
      })
      .catch(() => {
        if (mounted) setSatellitesSummary((prev) => ({ ...prev, loading: false }));
      });
    getDeliveriesReport()
      .then((res) => {
        if (!mounted) return;
        setDeliveriesSummary({
          movimientos: res.summary.movimientos_total,
          entregados: res.summary.entregados,
          costo: res.summary.costo_envios,
          loading: false,
        });
      })
      .catch(() => {
        if (mounted) setDeliveriesSummary((prev) => ({ ...prev, loading: false }));
      });
    getClientsReport()
      .then((res) => {
        if (!mounted) return;
        setClientsSummary({
          clientes: res.summary.clientes_total,
          facturacion: res.summary.facturacion_historica,
          ordenes: res.summary.ordenes_historicas,
          loading: false,
        });
      })
      .catch(() => {
        if (mounted) setClientsSummary((prev) => ({ ...prev, loading: false }));
      });
    return () => {
      mounted = false;
    };
  }, []);

  const ordersReport = useMemo<ReportCardDefinition>(
    () => ({
      id: "ordenes",
      title: "Reporte de Órdenes",
      description: "Estado, cliente, entrega, pago, responsable y prendas",
      countLabel: ordersSummary.loading
        ? "Cargando…"
        : `${ordersSummary.activas} ${ordersSummary.activas === 1 ? "orden activa" : "órdenes activas"}`,
      route: "/reports/ordenes",
    }),
    [ordersSummary]
  );

  const salesReport = useMemo<ReportCardDefinition>(
    () => ({
      id: "ventas",
      title: "Reporte de Ventas",
      description: "Ingresos por cliente, ticket promedio y cotizaciones",
      countLabel: salesSummary.loading
        ? "Cargando…"
        : `${fmtMoney(salesSummary.ventas)} facturado · ${salesSummary.cotizacionesAprobadas}/${salesSummary.cotizacionesTotal} cotizaciones`,
      route: "/reports/ventas",
    }),
    [salesSummary]
  );

  const profitabilityReport = useMemo<ReportCardDefinition>(
    () => ({
      id: "rentabilidad",
      title: "Rentabilidad",
      description: "Costo, venta, utilidad y margen por orden",
      countLabel: profitabilitySummary.loading
        ? "Cargando…"
        : `${profitabilitySummary.margenPromedio.toLocaleString("es-CO", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}% margen · ${fmtMoney(profitabilitySummary.utilidad)} utilidad`,
      route: "/reports/rentabilidad",
    }),
    [profitabilitySummary]
  );

  const productivityReport = useMemo<ReportCardDefinition>(
    () => ({
      id: "eficiencia",
      title: "Eficiencia Productiva",
      description: "Etapas del Kanban, días, retrasos y responsables",
      countLabel: productivitySummary.loading
        ? "Cargando…"
        : `${productivitySummary.tarjetasActivas} tarjetas · ${productivitySummary.retrasadas} retrasadas`,
      route: "/reports/eficiencia",
    }),
    [productivitySummary]
  );

  const quotesReport = useMemo<ReportCardDefinition>(
    () => ({
      id: "cotizaciones",
      title: "Reporte de Cotizaciones",
      description: "Estado, probabilidad, envío, vigencia y responsable",
      countLabel: quotesSummary.loading
        ? "Cargando…"
        : `${quotesSummary.total} cotizaciones · ${quotesSummary.aprobadas} aprobadas · ${fmtMoney(quotesSummary.pipeline)} pipeline`,
      route: "/reports/cotizaciones",
    }),
    [quotesSummary]
  );

  const inventoryReport = useMemo<ReportCardDefinition>(
    () => ({
      id: "inventario",
      title: "Reporte de Inventario",
      description: "Inventario general TNS: stock, mínimos, categoría y valorización",
      countLabel: inventorySummary.loading
        ? "Cargando…"
        : inventorySummary.tnsDisponible === false
          ? "TNS no disponible"
          : `${inventorySummary.materiales} materiales TNS · ${fmtMoney(inventorySummary.valor)} · ${inventorySummary.stockBajo} en bajo`,
      route: "/reports/inventario",
    }),
    [inventorySummary]
  );

  const purchasesReport = useMemo<ReportCardDefinition>(
    () => ({
      id: "compras",
      title: "Compras por Proveedor",
      description: "Trazabilidad de entradas, cantidades y montos por proveedor",
      countLabel: purchasesSummary.loading
        ? "Cargando…"
        : purchasesSummary.tnsDisponible === false
          ? "TNS no disponible"
          : `${purchasesSummary.proveedores} proveedores · ${fmtMoney(purchasesSummary.monto)} · ${purchasesSummary.compras} entradas TNS`,
      route: "/reports/compras",
    }),
    [purchasesSummary]
  );

  const satellitesReport = useMemo<ReportCardDefinition>(
    () => ({
      id: "satelites",
      title: "Reporte de Satélites",
      description: "Trabajos asignados, estado, costos y pagos por liquidar",
      countLabel: satellitesSummary.loading
        ? "Cargando…"
        : `${satellitesSummary.trabajos} trabajos · ${satellitesSummary.activos} satélites · ${fmtMoney(satellitesSummary.porLiquidar)} por liquidar`,
      route: "/reports/satelites",
    }),
    [satellitesSummary]
  );

  const deliveriesReport = useMemo<ReportCardDefinition>(
    () => ({
      id: "entregas",
      title: "Entregas y Domicilios",
      description: "Despachos a clientes y envíos a satélites con costos reales",
      countLabel: deliveriesSummary.loading
        ? "Cargando…"
        : `${deliveriesSummary.movimientos} movimientos · ${deliveriesSummary.entregados} entregados · ${fmtMoney(deliveriesSummary.costo)} envíos`,
      route: "/reports/entregas",
    }),
    [deliveriesSummary]
  );

  const clientsReport = useMemo<ReportCardDefinition>(
    () => ({
      id: "clientes",
      title: "Reporte de Clientes",
      description: "Histórico, órdenes, facturación y última interacción",
      countLabel: clientsSummary.loading
        ? "Cargando…"
        : `${clientsSummary.clientes} clientes · ${fmtMoney(clientsSummary.facturacion)} · ${clientsSummary.ordenes} órdenes`,
      route: "/reports/clientes",
    }),
    [clientsSummary]
  );

  const allInformes = [
    ordersReport,
    salesReport,
    profitabilityReport,
    productivityReport,
    quotesReport,
    inventoryReport,
    purchasesReport,
    satellitesReport,
    deliveriesReport,
    clientsReport,
    ...staticReports,
  ];

  return (
    <AppLayout
      title="Reportes"
      subtitle="Informes, costos reales y estadísticas de la operación"
      eyebrow="Gerencia"
    >
      <Tabs defaultValue="informes" className="space-y-5">
        <TabsList>
          <TabsTrigger value="informes">Informes</TabsTrigger>
          <TabsTrigger value="costos">
            <DollarSign className="h-4 w-4 mr-1.5" />
            Costos reales
          </TabsTrigger>
          <TabsTrigger value="estadisticas">Estadísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="informes" className="space-y-4">
          {ordersSummary.loading ||
          salesSummary.loading ||
          profitabilitySummary.loading ||
          productivitySummary.loading ||
          quotesSummary.loading ||
          inventorySummary.loading ||
          purchasesSummary.loading ||
          satellitesSummary.loading ||
          deliveriesSummary.loading ||
          clientsSummary.loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Actualizando métricas de reportes…
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allInformes.map((report) => (
              <ReportCard
                key={report.id}
                report={{
                  ...report,
                  icon: iconByReport[report.id] || FileText,
                }}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="costos" className="space-y-4">
          <RealCostsPanel />
        </TabsContent>

        <TabsContent value="estadisticas" className="space-y-4">
          <StatisticsPanel />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
