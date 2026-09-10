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
  Clock,
  Download,
  Factory,
  FileText,
  Loader2,
  Package,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { matchesReportSearch } from "@/lib/report-search";
import {
  exportProductivityReportCsv,
  getProductivityReport,
} from "@/services/reportsService";
import type { ProductivityReportResponse } from "@/types/reports";

function toStageType(etapa: string): StatusType {
  const allowed: StatusType[] = [
    "design",
    "cutting",
    "sewing",
    "embroidery",
    "quality",
    "printing",
    "dispatch",
  ];
  return allowed.includes(etapa as StatusType) ? (etapa as StatusType) : "design";
}

export default function ProductivityReportPage() {
  const [data, setData] = useState<ProductivityReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getProductivityReport({ estado: estadoFilter })
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
          row.tarjeta,
          row.orden,
          row.cliente,
          row.etapa_label,
          row.responsable,
          row.estado_label
        )
      ),
    [allRows, search]
  );
  const showInitialLoader = loading && !data;

  return (
    <AppLayout
      title="Eficiencia productiva"
      subtitle="Tarjetas del Kanban por etapa, días en proceso, retrasos y responsables"
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
              onClick={() => exportProductivityReportCsv(rows)}
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
            Cargando eficiencia productiva…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title="TARJETAS ACTIVAS"
                value={summary?.tarjetas_activas ?? 0}
                icon={ClipboardList}
              />
              <StatCard
                title="RETRASADAS"
                value={summary?.retrasadas ?? 0}
                icon={Factory}
                variant="destructive"
              />
              <StatCard
                title="DÍAS PROM. EN ETAPA"
                value={summary?.dias_promedio_etapa ?? 0}
                formatValue={(n) =>
                  n.toLocaleString("es-CO", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })
                }
                icon={Clock}
                variant="accent"
              />
              <StatCard
                title="PRENDAS EN PROCESO"
                value={summary?.prendas_en_proceso ?? 0}
                icon={Package}
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
                        <SelectItem value="en_tiempo">En tiempo</SelectItem>
                        <SelectItem value="retrasada">Retrasada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {rows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No hay tarjetas Kanban activas para los filtros seleccionados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarjeta</TableHead>
                          <TableHead>Orden</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Etapa</TableHead>
                          <TableHead>Responsable</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">Días en etapa</TableHead>
                          <TableHead className="text-right">Entrega</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono font-semibold">{row.tarjeta}</TableCell>
                            <TableCell className="font-mono">{row.orden}</TableCell>
                            <TableCell>{row.cliente}</TableCell>
                            <TableCell>
                              <StatusBadge status={toStageType(row.etapa)} compact />
                            </TableCell>
                            <TableCell>{row.responsable}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.cantidad}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.dias_en_etapa}</TableCell>
                            <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                              {row.fecha_entrega || "—"}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                  row.retrasada
                                    ? "bg-red-100 text-red-800 border border-red-200"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                )}
                              >
                                {row.estado_label}
                              </span>
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
              Cada fila corresponde a una tarjeta Kanban de órdenes en producción. El responsable
              se toma de la asignación de la capa actual (`stageAssignees`). Retraso: fecha de
              entrega vencida o más de 7 días en la misma etapa.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
