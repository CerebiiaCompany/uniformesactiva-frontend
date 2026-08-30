import { useState, useEffect, useCallback, useMemo, useRef, ComponentType } from "react";
import {
  Search,
  RefreshCw,
  X,
  FileText,
  DollarSign,
  Receipt,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Copy,
  Check,
  Building2,
  User,
  ShieldCheck,
  Package,
  Layers,
  HelpCircle,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-number";
import {
  getTNSFacturas,
  getTNSFacturaDetalle,
  parseTNSNumber,
} from "@/services/tnsService";
import type {
  TNSFacturaItem,
  TNSFacturaDetalle,
  TNSFacturasSummary,
} from "@/types/tns";

// ----------------------------------------------------
// Hook de Animación CountUp
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
    <Card className="shadow-sm transition-all duration-200 hover:shadow-md border-border/80">
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

export function TNSFacturasTab() {
  const [facturas, setFacturas] = useState<TNSFacturaItem[]>([]);
  const [summary, setSummary] = useState<TNSFacturasSummary | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Parámetros de consulta y filtros
  const [search, setSearch] = useState<string>("");
  const [cliente, setCliente] = useState<string>("");
  const [numero, setNumero] = useState<string>("");
  const [fechaInicial, setFechaInicial] = useState<string>("");
  const [fechaFinal, setFechaFinal] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Estado para el modal de Detalle de Factura
  const [selectedKardexId, setSelectedKardexId] = useState<string | number | null>(null);
  const [detalleFactura, setDetalleFactura] = useState<TNSFacturaDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState<boolean>(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [copiedCufe, setCopiedCufe] = useState<boolean>(false);

  const fetchFacturas = useCallback(
    async (isForceRefresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getTNSFacturas({
          search: search.trim() || undefined,
          cliente: cliente.trim() || undefined,
          numero: numero.trim() || undefined,
          fecha_inicial: fechaInicial || undefined,
          fecha_final: fechaFinal || undefined,
          page,
          page_size: pageSize,
          force_refresh: isForceRefresh,
        });

        setFacturas(res.data || []);
        setTotalCount(res.total_count || res.data?.length || 0);

        if (res.summary) {
          setSummary(res.summary);
        } else {
          const list = res.data || [];
          const totalNeto = list.reduce(
            (acc, curr) => acc + parseTNSNumber(curr.valorNeto),
            0
          );
          setSummary({
            total_facturas: res.total_count || list.length,
            total_valor_neto: totalNeto,
          });
        }

        setLastUpdated(new Date());
      } catch (err: any) {
        console.error("Error al cargar facturas de TNS:", err);
        setError(
          err?.message ||
            "No fue posible consultar las facturas de venta de TNS. Verifique la conexión con el ERP."
        );
      } finally {
        setLoading(false);
      }
    },
    [search, cliente, numero, fechaInicial, fechaFinal, page, pageSize]
  );

  useEffect(() => {
    fetchFacturas();
  }, [fetchFacturas]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFacturas(true);
    setRefreshing(false);
  };

  const handleClearFilters = () => {
    setSearch("");
    setCliente("");
    setNumero("");
    setFechaInicial("");
    setFechaFinal("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search.trim() || cliente.trim() || numero.trim() || fechaInicial || fechaFinal
  );

  // Carga de Detalle de Factura
  const handleOpenDetalle = async (kardexId: string | number) => {
    setSelectedKardexId(kardexId);
    setLoadingDetalle(true);
    setErrorDetalle(null);
    setDetalleFactura(null);
    setCopiedCufe(false);

    try {
      const data = await getTNSFacturaDetalle(kardexId);
      setDetalleFactura(data);
    } catch (err: any) {
      console.error("Error al obtener detalle de factura TNS:", err);
      setErrorDetalle(
        err?.message || "No se pudo cargar el detalle completo de esta factura."
      );
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleCopyCufe = (cufeText?: string) => {
    if (!cufeText) return;
    navigator.clipboard.writeText(cufeText);
    setCopiedCufe(true);
    setTimeout(() => setCopiedCufe(false), 2000);
  };

  // Paginación
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalCount);

  // Métricas calculadas
  const promedioFactura = useMemo(() => {
    if (!summary || summary.total_facturas === 0) return 0;
    return summary.total_valor_neto / summary.total_facturas;
  }, [summary]);

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard
          title="Total Facturas de Venta"
          value={summary?.total_facturas || totalCount}
          icon={Receipt}
          tone="optimal"
          subtitle="Documentos de venta registrados en TNS"
        />
        <SummaryCard
          title="Valor Total Facturado (Neto)"
          value={summary?.total_valor_neto || 0}
          formatValue={(n) => formatCurrency(n)}
          icon={DollarSign}
          tone="value"
          subtitle="Suma de valor neto facturado"
        />
        <SummaryCard
          title="Promedio por Factura"
          value={promedioFactura}
          formatValue={(n) => formatCurrency(n)}
          icon={FileText}
          tone="low"
          subtitle="Ticket promedio de ventas"
        />
      </div>

      {/* Main Container Card */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="p-4 sm:p-5 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-red-600 dark:text-red-500" />
                Facturas de Ventas TNS
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Consulta en vivo de comprobantes fiscales, CUFE, clientes, vendedores y detalles de artículos.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {lastUpdated && (
                <span className="text-[11px] text-muted-foreground hidden md:inline-block">
                  Actualizado: {lastUpdated.toLocaleTimeString("es-CO")}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="h-9 gap-1.5 font-medium"
              >
                <RefreshCw
                  className={cn("h-4 w-4", (loading || refreshing) && "animate-spin text-red-600")}
                />
                <span className="hidden sm:inline">Refrescar TNS</span>
              </Button>
            </div>
          </div>

          {/* Filtros de Búsqueda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por cliente, NIT, vendedor o Kardex..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="N° Factura (ej: 2629)"
                value={numero}
                onChange={(e) => {
                  setNumero(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {numero && (
                <button
                  type="button"
                  onClick={() => setNumero("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <Calendar className="h-3.5 w-3.5" />
              </div>
              <input
                type="date"
                title="Fecha Inicial"
                value={fechaInicial}
                onChange={(e) => {
                  setFechaInicial(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-8 pr-2 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <Calendar className="h-3.5 w-3.5" />
              </div>
              <input
                type="date"
                title="Fecha Final"
                value={fechaFinal}
                onChange={(e) => {
                  setFechaFinal(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-8 pr-2 py-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <span>Filtros activos</span>
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-red-600 dark:text-red-400 hover:underline font-semibold flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Limpiar filtros
              </button>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="p-4 m-4 text-sm text-red-700 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchFacturas(true)}
                className="text-xs h-8"
              >
                Reintentar
              </Button>
            </div>
          )}

          {/* Tabla de Facturas */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold text-xs">Comprobante / N°</TableHead>
                  <TableHead className="font-bold text-xs">Fecha Emisión</TableHead>
                  <TableHead className="font-bold text-xs">Cliente / Tercero</TableHead>
                  <TableHead className="font-bold text-xs">Vendedor</TableHead>
                  <TableHead className="font-bold text-xs text-right">Valor Neto</TableHead>
                  <TableHead className="font-bold text-xs text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && facturas.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="py-6 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <RefreshCw className="h-4 w-4 animate-spin text-red-600" />
                          <span>Cargando facturas desde TNS ERP...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : facturas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Receipt className="h-10 w-10 text-muted-foreground/50" />
                        <p className="font-semibold text-sm">No se encontraron facturas de venta</p>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          {hasActiveFilters
                            ? "Intente ajustar los parámetros de búsqueda o limpiar los filtros."
                            : "No hay registros de facturas en el rango seleccionado."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  facturas.map((f, idx) => {
                    const prefijoNum = `${f.codigoPrefijo || ""}${f.numero}`;
                    const valorNetoNum = parseTNSNumber(f.valorNeto);

                    return (
                      <TableRow
                        key={f.kardexId || `${f.numero}-${idx}`}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="font-medium text-xs">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="font-mono bg-red-50/50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 text-xs px-2 py-0.5"
                            >
                              {prefijoNum || f.numero}
                            </Badge>
                            {f.codigoComprobante && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                ({f.codigoComprobante})
                              </span>
                            )}
                          </div>
                          {f.kardexId && (
                            <span className="text-[10px] text-muted-foreground block mt-0.5 font-mono">
                              Kardex: {f.kardexId}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs">
                          <div className="font-medium text-foreground">
                            {formatTNSDate(f.fecha)}
                          </div>
                          {f.hora && (
                            <span className="text-[11px] text-muted-foreground block">
                              {f.hora}
                            </span>
                          )}
                          {f.fechaAsentado && f.fechaAsentado !== f.fecha && (
                            <span className="text-[10px] text-muted-foreground block">
                              Asentado: {f.fechaAsentado}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs max-w-[260px]">
                          <div className="font-semibold text-foreground truncate" title={f.nombreTercero}>
                            {f.nombreTercero || "Cliente sin nombre"}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            NIT: {f.codigoTercero || "—"}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs max-w-[200px]">
                          <div className="text-foreground truncate" title={f.nombreVendedor || ""}>
                            {f.nombreVendedor || "—"}
                          </div>
                          {f.codigoVendedor && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              Cod: {f.codigoVendedor}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-right font-bold text-foreground font-mono">
                          {formatCurrency(valorNetoNum)}
                        </TableCell>

                        <TableCell className="text-xs text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetalle(f.kardexId)}
                            className="h-8 px-2.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Ver Detalle</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer & Pagination */}
          <div className="p-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>
                Mostrando <strong className="text-foreground">{startRow}</strong> -{" "}
                <strong className="text-foreground">{endRow}</strong> de{" "}
                <strong className="text-foreground">{totalCount}</strong> facturas
              </span>

              <div className="flex items-center gap-2">
                <span>Por página:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(1)}
                disabled={page <= 1 || loading}
                title="Primera página"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                title="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="px-3 py-1 text-xs font-semibold text-foreground">
                Página {page} de {totalPages}
              </span>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                title="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || loading}
                title="Última página"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalle Completo de Factura */}
      <Dialog
        open={selectedKardexId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedKardexId(null);
            setDetalleFactura(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader className="border-b border-border/60 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-red-600" />
                  Factura de Venta{" "}
                  <span className="font-mono text-red-600">
                    {detalleFactura
                      ? `${detalleFactura.codigoPrefijo || ""}${detalleFactura.numero}`
                      : selectedKardexId}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Kardex ID: <strong className="font-mono">{selectedKardexId}</strong> • Sincronizado desde TNS ERP
                </DialogDescription>
              </div>

              {detalleFactura?.estadoDian && (
                <Badge
                  className={cn(
                    "text-xs px-2.5 py-1 font-semibold",
                    detalleFactura.estadoDian.toUpperCase() === "EXITOSA"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                  DIAN: {detalleFactura.estadoDian}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {loadingDetalle ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-red-600" />
              <p className="text-sm font-medium text-muted-foreground">
                Consultando detalle completo de la factura en TNS...
              </p>
            </div>
          ) : errorDetalle ? (
            <div className="py-8 text-center text-red-600">
              <p className="font-semibold">{errorDetalle}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedKardexId && handleOpenDetalle(selectedKardexId)}
                className="mt-3 text-xs"
              >
                Reintentar
              </Button>
            </div>
          ) : detalleFactura ? (
            <div className="space-y-6 pt-2">
              {/* Información General y Terceros */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente / Facturar A */}
                <Card className="p-4 bg-muted/20 border-border/70">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    <Building2 className="h-4 w-4 text-red-600" />
                    Cliente / Facturado A
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    {detalleFactura.nombreTercero || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    NIT / Identificación: {detalleFactura.codigoTercero || "—"}
                  </p>
                  {detalleFactura.nombreDespachar && (
                    <div className="mt-2 pt-2 border-t border-border/40 text-xs">
                      <span className="text-muted-foreground">Despachar a: </span>
                      <span className="font-medium text-foreground">
                        {detalleFactura.nombreDespachar}
                      </span>
                      {detalleFactura.codigoDespachar && (
                        <span className="text-muted-foreground font-mono ml-1">
                          ({detalleFactura.codigoDespachar})
                        </span>
                      )}
                    </div>
                  )}
                </Card>

                {/* Datos de Emisión y Vendedor */}
                <Card className="p-4 bg-muted/20 border-border/70">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    <User className="h-4 w-4 text-red-600" />
                    Emisión & Comercial
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Fecha Factura:</span>
                      <span className="font-semibold text-foreground">
                        {detalleFactura.fecha || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Fecha Asentado:</span>
                      <span className="font-semibold text-foreground">
                        {detalleFactura.fechaAsentado || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Forma de Pago:</span>
                      <span className="font-semibold text-foreground">
                        {detalleFactura.formaPago === "CR" ? "Crédito (CR)" : detalleFactura.formaPago || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Comprobante:</span>
                      <span className="font-semibold text-foreground">
                        {detalleFactura.codigoComprobante || "FV"}
                      </span>
                    </div>
                  </div>
                  {detalleFactura.nombreVendedor && (
                    <div className="mt-2 pt-2 border-t border-border/40 text-xs">
                      <span className="text-muted-foreground">Vendedor: </span>
                      <span className="font-semibold text-foreground">
                        {detalleFactura.nombreVendedor}
                      </span>
                    </div>
                  )}
                </Card>
              </div>

              {/* CUFE y Observaciones */}
              {(detalleFactura.cufe || detalleFactura.observacion) && (
                <div className="space-y-3">
                  {detalleFactura.cufe && (
                    <div className="p-3 bg-muted/40 rounded-lg border border-border/60 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-muted-foreground block mb-0.5">
                          CUFE (Código Único de Factura Electrónica):
                        </span>
                        <p className="font-mono text-[11px] text-foreground truncate select-all">
                          {detalleFactura.cufe}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyCufe(detalleFactura.cufe)}
                        className="h-7 px-2 text-xs shrink-0 gap-1"
                      >
                        {copiedCufe ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {detalleFactura.observacion && (
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/50 text-xs">
                      <span className="font-bold text-muted-foreground block mb-0.5">
                        Observaciones:
                      </span>
                      <p className="text-foreground">{detalleFactura.observacion}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tabla de Artículos de la Factura */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-red-600" />
                  Artículos Facturados ({detalleFactura.detallesVenta?.length || 0})
                </h4>

                <div className="rounded-lg border border-border/70 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-bold text-xs">Código / Artículo</TableHead>
                        <TableHead className="font-bold text-xs text-center">Bodega</TableHead>
                        <TableHead className="font-bold text-xs text-right">Cantidad</TableHead>
                        <TableHead className="font-bold text-xs text-right">Valor Base</TableHead>
                        <TableHead className="font-bold text-xs text-right">% IVA</TableHead>
                        <TableHead className="font-bold text-xs text-right">Valor Neto</TableHead>
                        <TableHead className="font-bold text-xs text-right">Valor Parcial</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalleFactura.detallesVenta?.length ? (
                        detalleFactura.detallesVenta.map((item, i) => {
                          const cant = parseTNSNumber(item.cantidad);
                          const base = parseTNSNumber(item.valorBase);
                          const ivaPorc = parseTNSNumber(item.porcentaIva);
                          const neto = parseTNSNumber(item.valorNeto);
                          const parcial = parseTNSNumber(item.valorParcial);

                          return (
                            <TableRow key={i} className="hover:bg-muted/20">
                              <TableCell className="text-xs">
                                <span className="font-bold font-mono text-red-700 dark:text-red-400 block">
                                  {item.codigoArticulo}
                                </span>
                                <span className="text-foreground text-[11px]">
                                  {item.decripcionArticulo}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-center font-mono">
                                {item.codigoBodega || "00"}
                              </TableCell>
                              <TableCell className="text-xs text-right font-semibold">
                                {cant.toLocaleString("es-CO", {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                {formatCurrency(base)}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                {ivaPorc > 0 ? `${ivaPorc}%` : "0%"}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                {formatCurrency(neto)}
                              </TableCell>
                              <TableCell className="text-xs text-right font-bold text-foreground font-mono">
                                {formatCurrency(parcial)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="py-6 text-center text-muted-foreground text-xs">
                            No hay ítems registrados en los detalles de esta factura.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Totales de Liquidación */}
              <div className="flex justify-end pt-2">
                <Card className="w-full sm:w-80 p-4 bg-muted/30 border-border/80 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Valor Neto (Subtotal):</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatCurrency(parseTNSNumber(detalleFactura.valorNeto))}
                    </span>
                  </div>

                  {parseTNSNumber(detalleFactura.valorDescuentos) > 0 && (
                    <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                      <span>Descuentos:</span>
                      <span className="font-mono font-semibold">
                        - {formatCurrency(parseTNSNumber(detalleFactura.valorDescuentos))}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>IVA Liquidado:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatCurrency(parseTNSNumber(detalleFactura.netoIva))}
                    </span>
                  </div>

                  <div className="border-t border-border/60 pt-2 flex justify-between text-sm font-bold text-foreground">
                    <span>Total Factura:</span>
                    <span className="font-mono text-red-600 dark:text-red-400 text-base">
                      {formatCurrency(parseTNSNumber(detalleFactura.valorTotal))}
                    </span>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
