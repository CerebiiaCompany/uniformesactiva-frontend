import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  ClipboardList,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Search,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-number";
import { matchesReportSearch } from "@/lib/report-search";
import { exportSalesReportCsv, getSalesReport } from "@/services/reportsService";
import type { SalesReportResponse } from "@/types/reports";

const fmtMoney = (value: number) => `$${formatCurrency(value)}`;

export default function SalesReportPage() {
  const [data, setData] = useState<SalesReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getSalesReport()
      .then((res) => {
        if (mounted) setData(res);
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el reporte");
          setData(null);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const summary = data?.summary;
  const allRows = data?.rows ?? [];
  const rows = useMemo(
    () =>
      allRows.filter((row) => matchesReportSearch(search, row.cliente, row.ciudad)),
    [allRows, search]
  );
  const showInitialLoader = loading && !data;

  return (
    <AppLayout
      title="Reporte de Ventas"
      subtitle="Ingresos por cliente, participación, ticket promedio y cotizaciones"
      eyebrow="Reportes"
    >
      <div className="space-y-5 print:space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <Button variant="outline" size="sm" asChild className="w-fit">
            <Link to="/reports">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Reportes
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => exportSalesReportCsv(rows)} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-2" />
              CSV / Excel
            </Button>
            <Button size="sm" onClick={() => window.print()} disabled={!rows.length}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {showInitialLoader ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Cargando reporte de ventas…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title="VENTAS TOTALES"
                value={summary?.ventas_totales ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={TrendingUp}
                variant="success"
              />
              <StatCard
                title="UTILIDAD ESTIMADA"
                value={summary?.utilidad_estimada ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={DollarSign}
              />
              <StatCard
                title="TICKET PROMEDIO"
                value={summary?.ticket_promedio ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={DollarSign}
                variant="accent"
              />
              <StatCard
                title="COTIZACIONES APROBADAS"
                value={`${summary?.cotizaciones_aprobadas ?? 0} / ${summary?.cotizaciones_total ?? 0}`}
                icon={ClipboardList}
                variant="warning"
              />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle className="text-base">
                    Detalle ({rows.length} registros)
                  </CardTitle>
                  <div className="relative min-w-[220px] print:hidden">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar…"
                      className="pl-8 h-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {rows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No hay ventas ni cotizaciones registradas para los filtros seleccionados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Ciudad</TableHead>
                          <TableHead className="text-right">Órdenes</TableHead>
                          <TableHead className="text-right">Prendas</TableHead>
                          <TableHead className="text-right">Ventas</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                          <TableHead className="text-right">Utilidad</TableHead>
                          <TableHead className="text-right">Particip.</TableHead>
                          <TableHead className="text-right">Última orden</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.client_id}>
                            <TableCell className="font-semibold">{row.cliente}</TableCell>
                            <TableCell>{row.ciudad}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.ordenes}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.prendas}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {fmtMoney(row.ventas)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtMoney(row.costo)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                              {fmtMoney(row.utilidad)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.participacion_pct.toLocaleString("es-CO", {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              })}
                              %
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                              {row.ultima_orden || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-[11px] text-muted-foreground print:hidden">
              Las ventas se calculan desde las órdenes registradas en la plataforma (conversión de
              cotización o creación directa). Las cotizaciones muestran el pipeline comercial por
              cliente, incluyendo estados aprobados y convertidos a orden.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
