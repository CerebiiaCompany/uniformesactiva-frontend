import { useState, useEffect, useCallback, useMemo, useRef, ComponentType } from "react";
import {
  Search,
  RefreshCw,
  X,
  FileText,
  DollarSign,
  ShoppingBag,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-number";
import {
  getTNSVentasDetalladas,
  parseTNSNumber,
} from "@/services/tnsService";
import type {
  TNSVentaItem,
  TNSVentasSummary,
} from "@/types/tns";

// ----------------------------------------------------
// Helpers y Animación CountUp
// ----------------------------------------------------

function useCountUp(target: number, durationMs = 900) {
  const [display, setDisplay] = useState(0);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (reducedMotion.current) {
      setDisplay(target);
      return;
    }

    let start = 0;
    const startTime = performance.now();

    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const easeOutQuad = 1 - (1 - progress) * (1 - progress);
      const current = Math.round(start + (target - start) * easeOutQuad);
      setDisplay(current);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        setDisplay(target);
      }
    };

    requestAnimationFrame(frame);
  }, [target, durationMs]);

  return display;
}

type SummaryTone = "optimal" | "low" | "out" | "value";

const toneStyles: Record<
  SummaryTone,
  {
    bg: string;
    border: string;
    text: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  optimal: {
    bg: "bg-emerald-50/70 dark:bg-emerald-950/20",
    border: "border-emerald-200/80 dark:border-emerald-800/50",
    text: "text-emerald-700 dark:text-emerald-300",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/60",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  low: {
    bg: "bg-amber-50/70 dark:bg-amber-950/20",
    border: "border-amber-200/80 dark:border-amber-800/50",
    text: "text-amber-700 dark:text-amber-300",
    iconBg: "bg-amber-100 dark:bg-amber-900/60",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  out: {
    bg: "bg-zinc-50/80 dark:bg-zinc-900/30",
    border: "border-zinc-200/80 dark:border-zinc-800/60",
    text: "text-zinc-700 dark:text-zinc-300",
    iconBg: "bg-zinc-100 dark:bg-zinc-800",
    iconColor: "text-zinc-500 dark:text-zinc-400",
  },
  value: {
    bg: "bg-red-50/70 dark:bg-red-950/20",
    border: "border-red-200/80 dark:border-red-800/50",
    text: "text-red-700 dark:text-red-300",
    iconBg: "bg-red-100 dark:bg-red-900/60",
    iconColor: "text-red-600 dark:text-red-400",
  },
};

function SummaryCard({
  title,
  value,
  formatValue,
  icon: Icon,
  tone = "optimal",
  subtitle,
}: {
  title: string;
  value: number;
  formatValue?: (n: number) => string;
  icon: ComponentType<{ className?: string }>;
  tone?: SummaryTone;
  subtitle?: string;
}) {
  const animated = useCountUp(value);
  const cfg = toneStyles[tone];

  return (
    <Card className="shadow-sm transition-all duration-200 hover:shadow-md">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold tracking-tight mt-1 text-foreground">
              {formatValue ? formatValue(animated) : animated.toLocaleString("es-CO")}
            </p>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground mt-1 truncate">{subtitle}</p>
            )}
          </div>
          <div className={cn("p-2.5 rounded-full shrink-0", cfg.iconBg)}>
            <Icon className={cn("h-5 w-5", cfg.iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTNSDate(d?: string | null): string {
  if (!d) return "—";
  const clean = d.split("T")[0].split(" ")[0].trim();
  return clean || "—";
}

function parseTNSCliente(v: TNSVentaItem): { nombre: string; rol: string; nit: string } {
  const raw = v.nomcliente || v.nomtercero || v.cliente || v.nombre_cliente || "";
  const nit = v.codtercero || (v as any).nit || (v as any).codcliente || "";

  if (!raw.trim()) {
    return {
      nombre: "—",
      rol: v.produccion_rol || "—",
      nit,
    };
  }

  if (raw.includes("/")) {
    const parts = raw.split("/");
    const nombre = parts[0].trim() || "—";
    const rol = parts.slice(1).join("/").trim() || "—";
    return { nombre, rol, nit };
  }

  return {
    nombre: raw.trim(),
    rol: v.produccion_rol || "—",
    nit,
  };
}

function parseTNSVendedor(v: TNSVentaItem): string {
  const ven = v.nomven || v.vendedor || (v as any).nomvendedor || (v.codven ? `Cod: ${v.codven}` : "");
  return ven ? ven.trim() : "—";
}

export function TNSVentasDetalladasTab() {
  const [ventas, setVentas] = useState<TNSVentaItem[]>([]);
  const [summary, setSummary] = useState<TNSVentasSummary | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Parámetros de consulta
  const [search, setSearch] = useState<string>("");
  const [fechaInicial, setFechaInicial] = useState<string>("");
  const [fechaFinal, setFechaFinal] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const fetchVentas = useCallback(
    async (isForceRefresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getTNSVentasDetalladas({
          search: search.trim() || undefined,
          fecha_inicial: fechaInicial || undefined,
          fecha_final: fechaFinal || undefined,
          page,
          page_size: pageSize,
          force_refresh: isForceRefresh,
        });

        setVentas(res.data || []);
        setTotalCount(res.total_count || res.data?.length || 0);
        if (res.summary) {
          setSummary(res.summary);
        } else {
          // Calcular resumen si no vino en el payload
          const list = res.data || [];
          const totalCant = list.reduce((acc, curr) => acc + parseTNSNumber(curr.cantidad), 0);
          const totalNeto = list.reduce((acc, curr) => acc + parseTNSNumber(curr.neto), 0);
          setSummary({
            total_registros: res.total_count || list.length,
            total_cantidad_vendida: totalCant,
            total_ingresos_neto: totalNeto,
          });
        }
        setLastUpdated(new Date());
      } catch (err: any) {
        console.error("Error al cargar ventas detalladas de TNS:", err);
        setError(err.message || "No se pudo consultar las ventas detalladas.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, fechaInicial, fechaFinal, page, pageSize]
  );

  // Debounce para búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchVentas();
    }, 350);

    return () => clearTimeout(handler);
  }, [fetchVentas]);

  const handleForceSync = () => {
    setRefreshing(true);
    fetchVentas(true);
  };

  const handleClearFilters = () => {
    setSearch("");
    setFechaInicial("");
    setFechaFinal("");
    setPage(1);
  };

  const hasFiltersActive = Boolean(search.trim() || fechaInicial || fechaFinal);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- */}
      {/* 1. TARJETAS DE RESUMEN KPI DE VENTAS                  */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          title="Total Facturas / Registros"
          value={summary?.total_registros ?? totalCount}
          icon={FileText}
          tone="optimal"
          subtitle="Ventas registradas en TNS"
        />
        <SummaryCard
          title="Unidades / Metros Vendidos"
          value={summary?.total_cantidad_vendida ?? 0}
          formatValue={(n) => `${Number(n).toLocaleString("es-CO", { maximumFractionDigits: 1 })} un.`}
          icon={ShoppingBag}
          tone="low"
          subtitle="Volumen total despachado"
        />
        <SummaryCard
          title="Ingresos Netos Totales"
          value={summary?.total_ingresos_neto ?? 0}
          formatValue={(n) => `$${formatCurrency(Math.round(n))}`}
          icon={DollarSign}
          tone="value"
          subtitle="Facturación total neta"
        />
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. TABLA PRINCIPAL DE VENTAS DETALLADAS               */}
      {/* ---------------------------------------------------- */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight">
              Reporte de Ventas Detalladas TNS
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Detalle de productos facturados, clientes, unidades y valores según el ERP TNS.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lastUpdated && (
              <span className="text-[11px] text-muted-foreground font-mono hidden sm:inline-block">
                Sinc: {lastUpdated.toLocaleTimeString("es-CO")}
              </span>
            )}
            <button
              type="button"
              onClick={handleForceSync}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", (refreshing || loading) && "animate-spin")} />
              {refreshing ? "Sincronizando..." : "Actualizar desde TNS"}
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Barra de Filtros interactiva */}
          <div className="flex flex-wrap items-center gap-2.5 px-6 py-3 border-b bg-muted/20">
            {/* Input de Búsqueda */}
            <div className="flex-1 min-w-[200px] max-w-sm relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por código, descripción, cliente o factura..."
                className="w-full border rounded-md pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Fecha Desde */}
            <div className="flex items-center gap-1 bg-background border rounded-md px-2.5 py-1 text-xs">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground text-[11px]">Desde:</span>
              <input
                type="date"
                value={fechaInicial}
                onChange={(e) => {
                  setFechaInicial(e.target.value);
                  setPage(1);
                }}
                className="border-0 p-0 text-xs bg-transparent focus:outline-none text-foreground font-mono"
              />
            </div>

            {/* Fecha Hasta */}
            <div className="flex items-center gap-1 bg-background border rounded-md px-2.5 py-1 text-xs">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground text-[11px]">Hasta:</span>
              <input
                type="date"
                value={fechaFinal}
                onChange={(e) => {
                  setFechaFinal(e.target.value);
                  setPage(1);
                }}
                className="border-0 p-0 text-xs bg-transparent focus:outline-none text-foreground font-mono"
              />
            </div>

            {/* Botón Limpiar */}
            {hasFiltersActive && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-background hover:bg-muted border rounded-md transition-colors"
                title="Limpiar filtros"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar
              </button>
            )}
          </div>

          {/* Tabla de Resultados */}
          {loading && ventas.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-sm text-muted-foreground gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-red-600" />
              <span>Consultando ventas detalladas en ERP TNS...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-600 bg-red-50/50 dark:bg-red-950/20">
              <p className="font-semibold">Ocurrió un error al cargar las ventas</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          ) : ventas.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No se encontraron registros de ventas que coincidan con los filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-[11px]">
                    <TableHead className="w-[105px]">Factura</TableHead>
                    <TableHead className="w-[95px]">Fecha</TableHead>
                    <TableHead className="min-w-[180px]">Cliente</TableHead>
                    <TableHead className="w-[120px]">Rol / Producción</TableHead>
                    <TableHead className="min-w-[160px]">Vendedor</TableHead>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead className="min-w-[210px]">Descripción / Producto</TableHead>
                    <TableHead className="text-right w-[100px]">Cantidad</TableHead>
                    <TableHead className="text-right w-[115px]">Valor Base</TableHead>
                    <TableHead className="text-right w-[120px]">Total Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventas.map((v, idx) => {
                    const cant = parseTNSNumber(v.cantidad);
                    const base = parseTNSNumber(v.valorbase);
                    const neto = parseTNSNumber(v.neto);
                    const { nombre: clienteNombre, rol: clienteRol, nit: clienteNit } = parseTNSCliente(v);
                    const vendedorNombre = parseTNSVendedor(v);

                    return (
                      <TableRow key={`${v.numfactura}-${v.codarticulo}-${idx}`} className="text-xs hover:bg-muted/30">
                        {/* 1. Factura */}
                        <TableCell className="font-mono font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                          {v.numfactura || "—"}
                        </TableCell>

                        {/* 2. Fecha */}
                        <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                          {formatTNSDate(v.fechafactu || v.fecha)}
                        </TableCell>

                        {/* 3. Cliente */}
                        <TableCell>
                          <div className="truncate max-w-[200px]" title={clienteNombre}>
                            <p className="font-medium text-foreground truncate">{clienteNombre}</p>
                            {clienteNit && <p className="text-[10px] text-muted-foreground font-mono">NIT: {clienteNit}</p>}
                          </div>
                        </TableCell>

                        {/* 4. Rol / Producción */}
                        <TableCell>
                          {clienteRol !== "—" ? (
                            <span className="inline-flex items-center rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                              {clienteRol}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        {/* 5. Vendedor */}
                        <TableCell>
                          <div className="truncate max-w-[170px]" title={vendedorNombre}>
                            <p className="font-medium text-foreground truncate">{vendedorNombre}</p>
                            {v.codven && vendedorNombre !== `Cod: ${v.codven}` && (
                              <p className="text-[10px] text-muted-foreground font-mono">Cod: {v.codven}</p>
                            )}
                          </div>
                        </TableCell>

                        {/* 6. Código */}
                        <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                          {v.codarticulo || "—"}
                        </TableCell>

                        {/* 7. Descripción */}
                        <TableCell>
                          <div className="truncate max-w-[230px]" title={v.descriparticulo || ""}>
                            <p className="font-medium text-foreground truncate">{v.descriparticulo || "—"}</p>
                            {v.nomgrupoarticulo && (
                              <p className="text-[10px] text-muted-foreground truncate">{v.nomgrupoarticulo}</p>
                            )}
                          </div>
                        </TableCell>

                        {/* 8. Cantidad */}
                        <TableCell className="text-right tabular-nums font-semibold text-foreground whitespace-nowrap">
                          {cant.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {v.unidad || ""}
                        </TableCell>

                        {/* 9. Valor Base */}
                        <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          ${formatCurrency(Math.round(base))}
                        </TableCell>

                        {/* 10. Total Neto */}
                        <TableCell className="text-right tabular-nums font-bold text-foreground whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
                            ${formatCurrency(Math.round(neto))}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pie de tabla con Paginación */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-t bg-card text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Registros por página:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-[65px] text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>• Total: {totalCount.toLocaleString("es-CO")} ventas registradas</span>
            </div>

            <div className="flex items-center gap-2">
              <span>
                Página {page} de {totalPages}
              </span>

              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page <= 1 || loading}
                  className="p-1 rounded border hover:bg-muted disabled:opacity-40 transition-colors"
                  title="Primera página"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1 || loading}
                  className="p-1 rounded border hover:bg-muted disabled:opacity-40 transition-colors"
                  title="Página anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="p-1 rounded border hover:bg-muted disabled:opacity-40 transition-colors"
                  title="Página siguiente"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages || loading}
                  className="p-1 rounded border hover:bg-muted disabled:opacity-40 transition-colors"
                  title="Última página"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
