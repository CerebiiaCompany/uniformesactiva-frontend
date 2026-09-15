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
  DollarSign,
  Download,
  FileText,
  Loader2,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-number";
import { matchesReportSearch } from "@/lib/report-search";
import { printReportDocument } from "@/lib/report-print";
import { exportSatellitesReportCsv, getSatellitesReport } from "@/services/reportsService";
import type { SatellitesReportResponse } from "@/types/reports";
import { toast } from "sonner";

const fmtMoney = (value: number) => `$${formatCurrency(value)}`;

function workStatusClass(estado: string): string {
  if (estado === "recibido_completo") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }
  if (estado === "recibido_faltantes") {
    return "bg-amber-100 text-amber-900 border border-amber-200";
  }
  return "bg-sky-100 text-sky-800 border border-sky-200";
}

function paymentClass(pago: string): string {
  if (pago === "paid") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }
  return "bg-red-100 text-red-800 border border-red-200";
}

export default function SatellitesReportPage() {
  const [data, setData] = useState<SatellitesReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getSatellitesReport({ estado: estadoFilter })
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
          row.satelite,
          row.especialidad,
          row.etapa_label,
          row.estado_label,
          row.pago_label
        )
      ),
    [allRows, search]
  );
  const showInitialLoader = loading && !data;

  const handlePrintPdf = async () => {
    try {
      await printReportDocument({
        title: "Reporte de Satélites",
        documentLabel: "Informe de satélites",
        summary: [
          { label: "Trabajos", value: String(summary?.trabajos_total ?? 0) },
          { label: "Satélites activos", value: String(summary?.satelites_activos ?? 0) },
          { label: "Costo total", value: fmtMoney(summary?.costo_total ?? 0) },
          { label: "Por liquidar", value: fmtMoney(summary?.por_liquidar ?? 0) },
        ],
        columns: [
          { key: "tarjeta", label: "Tarjeta" },
          { key: "orden", label: "Orden" },
          { key: "cliente", label: "Cliente" },
          { key: "satelite", label: "Satélite" },
          { key: "especialidad", label: "Especialidad" },
          { key: "etapa", label: "Etapa" },
          { key: "cant", label: "Cant.", align: "right" },
          { key: "enviado", label: "Enviado" },
          { key: "recibido", label: "Recibido" },
          { key: "estado", label: "Estado" },
          { key: "costo", label: "Costo", align: "right" },
          { key: "pago", label: "Pago" },
        ],
        rows: rows.map((r) => [
          r.tarjeta,
          r.orden,
          r.cliente,
          r.satelite,
          r.especialidad,
          r.etapa_label,
          String(r.cantidad),
          r.fecha_enviado || "—",
          r.fecha_recibido || "—",
          r.estado_label,
          fmtMoney(r.costo),
          r.pago_label,
        ]),
        notes:
          "Fuente: tarjetas Kanban con asignación a satélite y liquidaciones del módulo Satélites.",
        signLeft: "Elaborado por",
        signRight: "Revisado por",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF");
    }
  };

  return (
    <AppLayout
      title="Reporte de Satélites"
      subtitle="Trabajos externos por satélite: estado de recepción, costos y pagos pendientes"
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
              onClick={() => exportSatellitesReportCsv(rows)}
              disabled={!rows.length}
            >
              <Download className="h-4 w-4 mr-2" />
              CSV / Excel
            </Button>
            <Button size="sm" onClick={handlePrintPdf} disabled={!rows.length}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {showInitialLoader ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Cargando reporte de satélites…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard title="TRABAJOS" value={summary?.trabajos_total ?? 0} icon={FileText} />
              <StatCard
                title="SATÉLITES ACTIVOS"
                value={summary?.satelites_activos ?? 0}
                icon={Users}
                variant="accent"
              />
              <StatCard
                title="COSTO TOTAL"
                value={summary?.costo_total ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={DollarSign}
                variant="success"
              />
              <StatCard
                title="POR LIQUIDAR"
                value={summary?.por_liquidar ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={Wallet}
                variant="destructive"
              />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle className="text-base">
                    Detalle ({rows.length} {rows.length === 1 ? "registro" : "registros"})
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
                      <SelectTrigger className="h-9 w-full sm:w-[180px]">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="enviado">Enviado</SelectItem>
                        <SelectItem value="recibido_completo">Recibido completo</SelectItem>
                        <SelectItem value="recibido_faltantes">Con faltantes</SelectItem>
                        <SelectItem value="pendiente">Por liquidar</SelectItem>
                        <SelectItem value="pagado">Pagado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {rows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Sin resultados para los filtros aplicados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarjeta</TableHead>
                          <TableHead>Orden</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Satélite</TableHead>
                          <TableHead>Especialidad</TableHead>
                          <TableHead>Etapa</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead>Enviado</TableHead>
                          <TableHead>Recibido</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                          <TableHead>Pago</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono font-semibold">{row.tarjeta}</TableCell>
                            <TableCell>{row.orden}</TableCell>
                            <TableCell className="font-medium">{row.cliente}</TableCell>
                            <TableCell>{row.satelite}</TableCell>
                            <TableCell>{row.especialidad}</TableCell>
                            <TableCell>{row.etapa_label}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.cantidad}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {row.fecha_enviado || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {row.fecha_recibido || "—"}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                  workStatusClass(row.estado)
                                )}
                              >
                                {row.estado_label}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {fmtMoney(row.costo)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                  paymentClass(row.pago)
                                )}
                              >
                                {row.pago_label}
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
              Fuente: tarjetas Kanban con asignación a satélite y liquidaciones del módulo Satélites.
              El estado refleja recepción del trabajo (enviado / recibido) y el pago pendiente o
              liquidado por taller.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
