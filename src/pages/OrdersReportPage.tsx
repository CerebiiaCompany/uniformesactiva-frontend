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
  Package,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-number";
import { matchesReportSearch } from "@/lib/report-search";
import { exportOrdersReportCsv, getOrdersReport } from "@/services/reportsService";
import type { OrdersReportResponse, OrdersReportRow } from "@/types/reports";

const fmtMoney = (value: number) => `$${formatCurrency(value)}`;

function paymentBadgeClass(pago: string): string {
  if (pago === "pagado") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }
  if (pago === "parcial") {
    return "bg-amber-100 text-amber-900 border border-amber-200";
  }
  return "bg-red-100 text-red-800 border border-red-200";
}

function toStatusType(estado: string): StatusType {
  if (estado === "pending" || estado === "in_production" || estado === "delivered") {
    return estado;
  }
  return "pending";
}

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

export default function OrdersReportPage() {
  const [data, setData] = useState<OrdersReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getOrdersReport({ estado: estadoFilter })
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

  const allRows = data?.rows ?? [];
  const summary = data?.summary;
  const showInitialLoader = loading && !data;

  const filteredRows = useMemo(
    () =>
      allRows.filter((row) =>
        matchesReportSearch(
          search,
          row.codigo,
          row.cliente,
          row.prendas,
          row.estado_label,
          row.etapa_label,
          row.responsable,
          row.pago_label
        )
      ),
    [allRows, search]
  );

  const handleExportCsv = () => {
    exportOrdersReportCsv(filteredRows);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <AppLayout
      title="Reporte de Órdenes"
      subtitle="Detalle completo de órdenes: estado, entrega, pago, responsable y prendas"
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
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!filteredRows.length}>
              <Download className="h-4 w-4 mr-2" />
              CSV / Excel
            </Button>
            <Button size="sm" onClick={handlePrintPdf} disabled={!filteredRows.length}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {showInitialLoader ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Cargando reporte de órdenes…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title="ÓRDENES"
                value={summary?.total_ordenes ?? 0}
                icon={ClipboardList}
              />
              <StatCard
                title="PRENDAS"
                value={summary?.total_prendas ?? 0}
                icon={Package}
              />
              <StatCard
                title="VENTA TOTAL"
                value={summary?.venta_total ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={DollarSign}
                variant="success"
              />
              <StatCard
                title="PENDIENTES DE PAGO"
                value={summary?.pendientes_pago ?? 0}
                icon={DollarSign}
                variant="warning"
              />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle className="text-base">
                    Detalle ({filteredRows.length} registros)
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
                {filteredRows.length === 0 ? (
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
                          <TableHead>Prendas</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Etapa</TableHead>
                          <TableHead>Creada</TableHead>
                          <TableHead>Entrega</TableHead>
                          <TableHead>Tomada por</TableHead>
                          <TableHead>Pago</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">Venta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.map((row: OrdersReportRow) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono font-semibold">{row.codigo}</TableCell>
                            <TableCell>{row.cliente}</TableCell>
                            <TableCell className="max-w-[220px] truncate" title={row.prendas}>
                              {row.prendas}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={toStatusType(row.estado)} compact />
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={toStageType(row.etapa)} compact />
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{row.fecha_creacion || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.fecha_entrega || "—"}</TableCell>
                            <TableCell>{row.responsable || "—"}</TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                  paymentBadgeClass(row.pago)
                                )}
                              >
                                {row.pago_label}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{row.cantidad}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {fmtMoney(row.venta)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
