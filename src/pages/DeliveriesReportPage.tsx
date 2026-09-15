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
  CheckCircle2,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Search,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-number";
import { matchesReportSearch } from "@/lib/report-search";
import { printReportDocument } from "@/lib/report-print";
import { exportDeliveriesReportCsv, getDeliveriesReport } from "@/services/reportsService";
import type { DeliveriesReportResponse } from "@/types/reports";
import { toast } from "sonner";

const fmtMoney = (value: number) => `$${formatCurrency(value)}`;

function estadoClass(estado: string): string {
  if (estado === "entregada" || estado === "recibido_completo") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }
  if (estado === "lista" || estado === "registrado") {
    return "bg-sky-100 text-sky-800 border border-sky-200";
  }
  if (estado === "recibido_faltantes") {
    return "bg-amber-100 text-amber-900 border border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

export default function DeliveriesReportPage() {
  const [data, setData] = useState<DeliveriesReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getDeliveriesReport({ tipo: tipoFilter })
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
  }, [tipoFilter]);

  const summary = data?.summary;
  const allRows = data?.rows ?? [];
  const rows = useMemo(
    () =>
      allRows.filter((row) =>
        matchesReportSearch(
          search,
          row.codigo,
          row.id,
          row.tipo_label,
          row.orden,
          row.destino,
          row.direccion,
          row.responsable,
          row.estado_label,
          row.observaciones
        )
      ),
    [allRows, search]
  );
  const showInitialLoader = loading && !data;
  const totalCosto = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.costo) || 0), 0),
    [rows]
  );

  const handlePrintPdf = async () => {
    try {
      await printReportDocument({
        title: "Entregas y Domicilios",
        documentLabel: "Informe de entregas y domicilios",
        summary: [
          { label: "Movimientos", value: String(summary?.movimientos_total ?? 0) },
          { label: "Entregados", value: String(summary?.entregados ?? 0) },
          { label: "Costo de envíos", value: fmtMoney(summary?.costo_envios ?? 0) },
          { label: "Costo promedio", value: fmtMoney(summary?.costo_promedio ?? 0) },
        ],
        columns: [
          { key: "id", label: "ID" },
          { key: "tipo", label: "Tipo" },
          { key: "orden", label: "Orden" },
          { key: "destino", label: "Destino" },
          { key: "direccion", label: "Dirección" },
          { key: "responsable", label: "Responsable" },
          { key: "fecha", label: "Fecha" },
          { key: "estado", label: "Estado" },
          { key: "obs", label: "Observaciones" },
          { key: "costo", label: "Costo", align: "right" },
        ],
        rows: rows.map((r) => [
          r.codigo || r.id,
          r.tipo_label,
          r.orden,
          r.destino,
          r.direccion || "—",
          r.responsable || "—",
          r.fecha || "—",
          r.estado_label,
          r.observaciones || "—",
          r.costo > 0 ? fmtMoney(r.costo) : "$0",
        ]),
        totalsRow: ["Totales", "", "", "", "", "", "", "", "", fmtMoney(totalCosto)],
        notes:
          "Fuente: módulo Despacho. El costo solo incluye envío real (nunca costo de taller).",
        signLeft: "Elaborado por",
        signRight: "Revisado por",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF");
    }
  };

  return (
    <AppLayout
      title="Entregas y Domicilios"
      subtitle="Despachos a clientes y envíos de material a satélites, con costo real de envío"
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
              onClick={() => exportDeliveriesReportCsv(rows)}
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
            Cargando entregas y domicilios…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title="MOVIMIENTOS"
                value={summary?.movimientos_total ?? 0}
                icon={Truck}
              />
              <StatCard
                title="ENTREGADOS"
                value={summary?.entregados ?? 0}
                icon={CheckCircle2}
                variant="success"
              />
              <StatCard
                title="COSTO DE ENVÍOS"
                value={summary?.costo_envios ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={DollarSign}
                variant="accent"
              />
              <StatCard
                title="COSTO PROMEDIO"
                value={summary?.costo_promedio ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={DollarSign}
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
                    <Select value={tipoFilter} onValueChange={setTipoFilter}>
                      <SelectTrigger className="h-9 w-full sm:w-[180px]">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="despacho">Despacho</SelectItem>
                        <SelectItem value="domicilio">Domicilio</SelectItem>
                        <SelectItem value="satelite">Satélite</SelectItem>
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
                          <TableHead>ID</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Orden</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead>Dirección</TableHead>
                          <TableHead>Responsable</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Observaciones</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono font-semibold">
                              {row.codigo || row.id}
                            </TableCell>
                            <TableCell>{row.tipo_label}</TableCell>
                            <TableCell>{row.orden}</TableCell>
                            <TableCell className="font-medium">{row.destino}</TableCell>
                            <TableCell className="max-w-[220px] truncate" title={row.direccion}>
                              {row.direccion || "—"}
                            </TableCell>
                            <TableCell>{row.responsable || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {row.fecha || "—"}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                  estadoClass(row.estado)
                                )}
                              >
                                {row.estado_label}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={row.observaciones}>
                              {row.observaciones || "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {row.costo > 0 ? fmtMoney(row.costo) : "$0"}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/40 font-semibold">
                          <TableCell colSpan={9}>Totales</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtMoney(totalCosto)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-[11px] text-muted-foreground print:hidden">
              Fuente: módulo Despacho — pedidos listos/entregados, domicilios ida y vuelta de
              tarjetas Kanban y movimientos logísticos de satélites. El costo solo incluye envío
              real (nunca costo de taller).
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
