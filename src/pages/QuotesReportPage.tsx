import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, type StatusType } from "@/components/StatusBadge";
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
import { exportQuotesReportCsv, getQuotesReport } from "@/services/reportsService";
import type { QuotesReportResponse } from "@/types/reports";

const fmtMoney = (value: number) => `$${formatCurrency(value)}`;

const quoteStatusTypes: StatusType[] = [
  "draft",
  "sent",
  "in_review",
  "approved",
  "rejected",
  "ordered",
];

function toQuoteStatus(estado: string): StatusType {
  return quoteStatusTypes.includes(estado as StatusType)
    ? (estado as StatusType)
    : "draft";
}

export default function QuotesReportPage() {
  const [data, setData] = useState<QuotesReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getQuotesReport({ estado: estadoFilter })
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
      allRows.filter((row) =>
        matchesReportSearch(
          search,
          row.codigo,
          row.cliente,
          row.items,
          row.estado_label,
          row.tomado_por
        )
      ),
    [allRows, search]
  );
  const showInitialLoader = loading && !data;

  return (
    <AppLayout
      title="Reporte de Cotizaciones"
      subtitle="Estado, probabilidad de cierre, fechas de envío y vigencia, notas y responsable"
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
              onClick={() => exportQuotesReportCsv(rows)}
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
            Cargando reporte de cotizaciones…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title="COTIZACIONES"
                value={summary?.cotizaciones_total ?? 0}
                icon={ClipboardList}
              />
              <StatCard
                title="MONTO TOTAL"
                value={summary?.monto_total ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={DollarSign}
              />
              <StatCard
                title="PIPELINE PONDERADO"
                value={summary?.pipeline_ponderado ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={TrendingUp}
                variant="accent"
              />
              <StatCard
                title="APROBADAS"
                value={summary?.cotizaciones_aprobadas ?? 0}
                icon={ClipboardList}
                variant="success"
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
                        <SelectItem value="draft">Borrador</SelectItem>
                        <SelectItem value="sent">Enviada</SelectItem>
                        <SelectItem value="in_review">En revisión</SelectItem>
                        <SelectItem value="approved">Aprobada</SelectItem>
                        <SelectItem value="rejected">Rechazada</SelectItem>
                        <SelectItem value="ordered">Ordenado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {rows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No hay cotizaciones para los filtros seleccionados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cotización</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Ítems</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Tomada por</TableHead>
                          <TableHead>Creada</TableHead>
                          <TableHead>Enviada</TableHead>
                          <TableHead>Vigente hasta</TableHead>
                          <TableHead className="text-right">Novedades</TableHead>
                          <TableHead className="text-right">Prob.</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono font-semibold">{row.codigo}</TableCell>
                            <TableCell>{row.cliente}</TableCell>
                            <TableCell className="max-w-[220px] truncate" title={row.items}>
                              {row.items}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={toQuoteStatus(row.estado)} compact />
                            </TableCell>
                            <TableCell>{row.tomado_por || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.fecha_creacion || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.fecha_envio || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.vigente_hasta || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.novedades}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.probabilidad}%</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {fmtMoney(row.monto)}
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
              El pipeline ponderado suma el monto de cada cotización multiplicado por su
              probabilidad de cierre. Las inactivas se excluyen del reporte.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
