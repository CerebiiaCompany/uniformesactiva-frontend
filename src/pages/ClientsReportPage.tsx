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
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-number";
import { matchesReportSearch } from "@/lib/report-search";
import { printReportDocument } from "@/lib/report-print";
import { exportClientsReportCsv, getClientsReport } from "@/services/reportsService";
import type { ClientsReportResponse } from "@/types/reports";
import { toast } from "sonner";

const fmtMoney = (value: number) => `$${formatCurrency(value)}`;

export default function ClientsReportPage() {
  const [data, setData] = useState<ClientsReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getClientsReport()
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
      allRows.filter((row) =>
        matchesReportSearch(
          search,
          row.cliente,
          row.empresa,
          row.ciudad,
          row.telefono,
          row.correo,
          row.nit
        )
      ),
    [allRows, search]
  );
  const showInitialLoader = loading && !data;

  const totals = useMemo(
    () => ({
      ordenes: rows.reduce((sum, row) => sum + (Number(row.ordenes) || 0), 0),
      facturacion: rows.reduce((sum, row) => sum + (Number(row.facturacion) || 0), 0),
    }),
    [rows]
  );

  const handlePrintPdf = async () => {
    try {
      await printReportDocument({
        title: "Reporte de Clientes",
        documentLabel: "Informe de clientes",
        summary: [
          { label: "Clientes", value: String(summary?.clientes_total ?? 0) },
          { label: "Facturación histórica", value: fmtMoney(summary?.facturacion_historica ?? 0) },
          { label: "Órdenes históricas", value: String(summary?.ordenes_historicas ?? 0) },
          { label: "Ticket promedio", value: fmtMoney(summary?.ticket_promedio ?? 0) },
        ],
        columns: [
          { key: "cliente", label: "Cliente" },
          { key: "empresa", label: "Empresa" },
          { key: "ciudad", label: "Ciudad" },
          { key: "telefono", label: "Teléfono" },
          { key: "correo", label: "Correo" },
          { key: "ordenes", label: "Órdenes", align: "right" },
          { key: "facturacion", label: "Facturación", align: "right" },
          { key: "ticket", label: "Ticket prom.", align: "right" },
          { key: "desde", label: "Cliente desde" },
          { key: "ultima", label: "Última interacción" },
        ],
        rows: rows.map((r) => [
          r.cliente,
          r.empresa || "—",
          r.ciudad,
          r.telefono || "—",
          r.correo || "—",
          String(r.ordenes),
          fmtMoney(r.facturacion),
          fmtMoney(r.ticket_promedio),
          r.cliente_desde || "—",
          r.ultima_interaccion || "—",
        ]),
        totalsRow: [
          "Totales",
          "",
          "",
          "",
          "",
          String(totals.ordenes),
          fmtMoney(totals.facturacion),
          "",
          "",
          "",
        ],
        notes:
          "Facturación = suma de valor de venta de órdenes del cliente. Ticket promedio = facturación / órdenes.",
        signLeft: "Elaborado por",
        signRight: "Revisado por",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF");
    }
  };

  return (
    <AppLayout
      title="Reporte de Clientes"
      subtitle="Histórico comercial por cliente: órdenes, facturación, ticket y última interacción"
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
              onClick={() => exportClientsReportCsv(rows)}
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
            Cargando reporte de clientes…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard title="CLIENTES" value={summary?.clientes_total ?? 0} icon={Users} />
              <StatCard
                title="FACTURACIÓN HISTÓRICA"
                value={summary?.facturacion_historica ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={DollarSign}
                variant="success"
              />
              <StatCard
                title="ÓRDENES HISTÓRICAS"
                value={summary?.ordenes_historicas ?? 0}
                icon={ClipboardList}
                variant="accent"
              />
              <StatCard
                title="TICKET PROMEDIO"
                value={summary?.ticket_promedio ?? 0}
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
                    Sin resultados para los filtros aplicados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Ciudad</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead>Correo</TableHead>
                          <TableHead className="text-right">Órdenes</TableHead>
                          <TableHead className="text-right">Facturación</TableHead>
                          <TableHead className="text-right">Ticket prom.</TableHead>
                          <TableHead>Cliente desde</TableHead>
                          <TableHead>Última interacción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-semibold">{row.cliente}</TableCell>
                            <TableCell>{row.empresa || "—"}</TableCell>
                            <TableCell>{row.ciudad}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.telefono}</TableCell>
                            <TableCell>{row.correo}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.ordenes}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {fmtMoney(row.facturacion)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtMoney(row.ticket_promedio)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {row.cliente_desde || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {row.ultima_interaccion || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/40 font-semibold">
                          <TableCell>Totales</TableCell>
                          <TableCell colSpan={4} />
                          <TableCell className="text-right tabular-nums">{totals.ordenes}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtMoney(totals.facturacion)}
                          </TableCell>
                          <TableCell colSpan={3} />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-[11px] text-muted-foreground print:hidden">
              Facturación = suma de valor de venta de órdenes del cliente. Ticket promedio =
              facturación / órdenes. Última interacción = la fecha más reciente entre órdenes,
              cotizaciones o actualización del cliente.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
