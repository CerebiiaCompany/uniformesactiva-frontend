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
  ClipboardList,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Package,
  Search,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-number";
import { matchesReportSearch } from "@/lib/report-search";
import { exportInventoryReportCsv, getInventoryReport } from "@/services/reportsService";
import type { InventoryReportResponse } from "@/types/reports";

const fmtMoney = (value: number) => `$${formatCurrency(value)}`;
const fmtQty = (value: number) =>
  value.toLocaleString("es-CO", { maximumFractionDigits: 2 });

export default function InventoryReportPage() {
  const [data, setData] = useState<InventoryReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [categoriaFilter, setCategoriaFilter] = useState("todos");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getInventoryReport({
      categoria: categoriaFilter,
      estado: estadoFilter,
    })
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
  }, [categoriaFilter, estadoFilter]);

  const summary = data?.summary;
  const allRows = data?.rows ?? [];
  const rows = useMemo(
    () =>
      allRows.filter((row) =>
        matchesReportSearch(
          search,
          row.codigo,
          row.material,
          row.categoria,
          row.proveedor_ref,
          row.estado
        )
      ),
    [allRows, search]
  );
  const showInitialLoader = loading && !data;

  const categorias = useMemo(() => {
    const set = new Set(allRows.map((r) => r.categoria).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [allRows]);

  return (
    <AppLayout
      title="Reporte de Inventario"
      subtitle="Inventario general TNS: existencias, mínimos, categoría, valorización y proveedor de referencia"
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
              onClick={() => exportInventoryReportCsv(rows)}
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
            Cargando reporte de inventario…
          </div>
        ) : error || summary?.tns_disponible === false ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">
              {error ||
                summary?.mensaje ||
                "No se pudo cargar el inventario general desde TNS. Verifica la conexión con el ERP."}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title="MATERIALES"
                value={summary?.materiales_total ?? 0}
                icon={Package}
              />
              <StatCard
                title="VALOR DEL INVENTARIO"
                value={summary?.valor_inventario ?? 0}
                formatValue={(n) => fmtMoney(n)}
                icon={DollarSign}
                variant="success"
              />
              <StatCard
                title="EN STOCK BAJO"
                value={summary?.stock_bajo ?? 0}
                icon={TrendingUp}
                variant="destructive"
              />
              <StatCard
                title="MOVIMIENTOS"
                value={summary?.movimientos_total ?? 0}
                icon={ClipboardList}
                variant="accent"
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
                    <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                      <SelectTrigger className="h-9 w-full sm:w-[140px]">
                        <SelectValue placeholder="Categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas</SelectItem>
                        {categorias.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                      <SelectTrigger className="h-9 w-full sm:w-[140px]">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="ok">OK</SelectItem>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {rows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No hay materiales para los filtros seleccionados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Material</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead>Unidad</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Mínimo</TableHead>
                          <TableHead className="text-right">Costo unit.</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Proveedores</TableHead>
                          <TableHead>Proveedor ref.</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono font-semibold">{row.codigo}</TableCell>
                            <TableCell>{row.material}</TableCell>
                            <TableCell>{row.categoria}</TableCell>
                            <TableCell>{row.unidad}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtQty(row.stock)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtQty(row.minimo)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtMoney(row.costo_unitario)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {fmtMoney(row.valor)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{row.proveedores}</TableCell>
                            <TableCell>{row.proveedor_ref}</TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                  row.stock_bajo
                                    ? "bg-red-100 text-red-800 border border-red-200"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                )}
                              >
                                {row.estado}
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
              Fuente: inventario transaccional TNS (ERP) — stock, costos y bodegas reales de la
              empresa. Los mínimos locales de costos se aplican solo cuando hay coincidencia por
              código o nombre; si no hay mínimo configurado, Pendiente = sin stock o stock ≤ 10
              unidades. Movimientos = líneas de compras TNS (últimos 2 años).
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
