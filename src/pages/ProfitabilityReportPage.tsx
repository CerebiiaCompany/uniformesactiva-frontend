import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  BarChart3,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Search,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-number";
import { matchesReportSearch } from "@/lib/report-search";
import {
  exportProfitabilityReportCsv,
  getProfitabilityReport,
} from "@/services/reportsService";
import type { ProfitabilityReportResponse } from "@/types/reports";

const fmtMoney = (value: number) => `$${formatCurrency(value)}`;
const fmtUnit = (value: number) => `$${formatCurrency(Math.round(value))}`;

export default function ProfitabilityReportPage() {
  const [data, setData] = useState<ProfitabilityReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getProfitabilityReport({ estado: estadoFilter })
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
  }, [estadoFilter]);

  const summary = data?.summary;
  const allRows = data?.rows ?? [];
  const rows = useMemo(
    () =>
      allRows.filter((row) => matchesReportSearch(search, row.codigo, row.cliente, row.estado)),
    [allRows, search]
  );
  const showInitialLoader = loading && !data;

  return (
    <AppLayout
      title="Rentabilidad por orden"
      subtitle="Comparativo de costo estimado, venta, utilidad y margen unitario"
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportProfitabilityReportCsv(rows)}
              disabled={!rows.length}
            >
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
            Cargando reporte de rentabilidad…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title="VENTA TOTAL"
                value={summary?.venta_total ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={TrendingUp}
                variant="success"
              />
              <StatCard
                title="COSTO TOTAL"
                value={summary?.costo_total ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={DollarSign}
              />
              <StatCard
                title="UTILIDAD"
                value={summary?.utilidad ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={BarChart3}
                variant="accent"
              />
              <StatCard
                title="MARGEN PROMEDIO"
                value={`${(summary?.margen_promedio ?? 0).toLocaleString("es-CO", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}%`}
                icon={BarChart3}
                variant="warning"
              />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle className="text-base">
                    Detalle ({rows.length} registros)
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2 print:hidden">
                    <div className="relative min-w-[220px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar…"
                        className="pl-8 h-9"
                      />
                    </div>
                    <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                      <SelectTrigger className="h-9 w-full sm:w-[160px]">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="in_production">En producción</SelectItem>
                        <SelectItem value="delivered">Entregado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {rows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No hay órdenes para los filtros seleccionados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Orden</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">Costo est.</TableHead>
                          <TableHead className="text-right">Venta</TableHead>
                          <TableHead className="text-right">Utilidad</TableHead>
                          <TableHead className="text-right">Margen</TableHead>
                          <TableHead className="text-right">Costo/unid.</TableHead>
                          <TableHead className="text-right">Venta/unid.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono font-semibold">{row.codigo}</TableCell>
                            <TableCell>{row.cliente}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.cantidad}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtMoney(row.costo_estimado)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {fmtMoney(row.venta)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                              {fmtMoney(row.utilidad)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.margen_pct.toLocaleString("es-CO", {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              })}
                              %
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtUnit(row.costo_unitario)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtUnit(row.venta_unitario)}
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
              Los valores provienen del costeo registrado en cada orden al momento de su creación
              (costo estimado, venta proyectada y ganancia). El margen se calcula como utilidad /
              venta.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
