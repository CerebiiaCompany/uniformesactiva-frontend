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
  Download,
  FileText,
  Loader2,
  Package,
  Search,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-number";
import { matchesReportSearch } from "@/lib/report-search";
import { exportPurchasesReportCsv, getPurchasesReport } from "@/services/reportsService";
import type { PurchasesReportResponse } from "@/types/reports";

const fmtMoney = (value: number) => `$${formatCurrency(value)}`;
const fmtQty = (value: number) =>
  value.toLocaleString("es-CO", { maximumFractionDigits: 2 });

export default function PurchasesReportPage() {
  const [data, setData] = useState<PurchasesReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getPurchasesReport()
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
        matchesReportSearch(search, row.proveedor, row.nit, row.ultima_compra)
      ),
    [allRows, search]
  );
  const showInitialLoader = loading && !data;

  return (
    <AppLayout
      title="Compras por Proveedor"
      subtitle="Trazabilidad de entradas de material: cantidades, montos y última compra"
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
              onClick={() => exportPurchasesReportCsv(rows)}
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
            Cargando reporte de compras…
          </div>
        ) : error || summary?.tns_disponible === false ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">
              {error ||
                summary?.mensaje ||
                "No se pudo cargar compras desde TNS. Verifica la conexión con el ERP."}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title="PROVEEDORES"
                value={summary?.proveedores_total ?? 0}
                icon={ShoppingCart}
              />
              <StatCard
                title="COMPRAS REGISTRADAS"
                value={summary?.compras_registradas ?? 0}
                icon={FileText}
                variant="accent"
              />
              <StatCard
                title="MONTO COMPRADO"
                value={summary?.monto_comprado ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={TrendingUp}
                variant="success"
              />
              <StatCard
                title="MATERIALES DISTINTOS"
                value={summary?.materiales_distintos ?? 0}
                icon={Package}
              />
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
                <CardTitle className="text-base font-semibold">
                  Detalle ({rows.length} {rows.length === 1 ? "registro" : "registros"})
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="text-right">Materiales</TableHead>
                        <TableHead className="text-right">Entradas</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">Particip.</TableHead>
                        <TableHead className="text-right">Última compra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                            No hay compras registradas en TNS para el criterio seleccionado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.proveedor}</TableCell>
                            <TableCell className="text-right">{row.materiales}</TableCell>
                            <TableCell className="text-right">{row.entradas}</TableCell>
                            <TableCell className="text-right">{fmtQty(row.cantidad)}</TableCell>
                            <TableCell className="text-right">{fmtMoney(row.monto)}</TableCell>
                            <TableCell className="text-right">
                              {row.participacion_pct.toLocaleString("es-CO", {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              })}
                              %
                            </TableCell>
                            <TableCell className="text-right">{row.ultima_compra || "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground print:hidden">
              Fuente: ComprasDetalladas TNS (entradas de material, últimos 2 años). Montos y
              cantidades reflejan el inventario real registrado en el ERP.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
