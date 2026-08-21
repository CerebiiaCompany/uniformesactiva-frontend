import React, { useState, useMemo, useEffect, useRef, type ComponentType } from "react";
import {
  AlertTriangle,
  Boxes,
  DollarSign,
  PackageX,
  RefreshCw,
  Search,
  Building2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  Warehouse,
  TrendingUp,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-number";
import { useTNSInventario } from "@/hooks/useTNSInventario";
import {
  parseTNSNumber,
  parseTNSDescription,
  detectTNSCategory,
  clasificarArticuloTNS,
  getTNSMaterialComprasHistorial,
  getTNSMaterialVentasHistorial,
  COMMON_COLORS,
} from "@/services/tnsService";
import type {
  TNSInventarioItem,
  TopProductoInventario,
  TNSProveedorOferta,
  TNSCompraItem,
  TNSMaterialComprasHistorialResponse,
  TNSVentaItem,
  TNSMaterialVentasHistorialResponse,
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
    bg: "bg-red-50/70 dark:bg-red-950/20",
    border: "border-red-200/80 dark:border-red-800/50",
    text: "text-red-700 dark:text-red-300",
    iconBg: "bg-red-100 dark:bg-red-900/60",
    iconColor: "text-red-600 dark:text-red-400",
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

type StatusRingProps = {
  label: string;
  count: number;
  total: number;
  color: string;
  trackColor: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
};

function StatusRing({
  label,
  count,
  total,
  color,
  trackColor,
  icon: Icon,
  iconClassName,
}: StatusRingProps) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const animatedPct = useCountUp(pct, 1000);
  const size = 118;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedPct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3 min-w-0 w-full px-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <Icon className={cn("h-5 w-5", iconClassName)} />
          <span className="text-base tabular-nums font-bold leading-none">{count}</span>
        </div>
      </div>
      <div className="text-center px-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {total > 0 ? `${Math.round(pct)}% del inventario` : "Sin materiales"}
        </p>
      </div>
    </div>
  );
}

function formatAxisTick(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${Math.round(value / 1000).toLocaleString("es-CO")}k`;
  }
  return `$${formatCurrency(Math.round(value))}`;
}

type HorizontalBarRow = {
  id: string;
  name: string;
  value: number;
  formattedValue?: string;
  subtext?: string;
};

function HorizontalGradientBarChart({
  rows,
  isCurrency = true,
  gradientClass = "from-emerald-600 via-emerald-500 to-emerald-400",
  shadowClass = "shadow-[0_6px_16px_-8px_rgba(16,185,129,0.65)]",
  onRowClick,
}: {
  rows: HorizontalBarRow[];
  isCurrency?: boolean;
  gradientClass?: string;
  shadowClass?: string;
  onRowClick?: (row: HorizontalBarRow) => void;
}) {
  const maxValue = useMemo(() => {
    if (!rows || rows.length === 0) return 0;
    const max = Math.max(...rows.map((r) => Number(r.value) || 0));
    return max > 0 ? max : 1;
  }, [rows]);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [rows]);

  const ticks = useMemo(() => {
    if (maxValue <= 0) return [0];
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => (maxValue * i) / steps);
  }, [maxValue]);

  if (rows.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Sin datos para graficar.
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full overflow-hidden">
      <div className="relative w-full">
        <div className="pointer-events-none absolute inset-y-0 left-[8.5rem] right-0 sm:left-44">
          {ticks.map((tick, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-6 border-l border-dashed border-border/70"
              style={{ left: `${(i / (ticks.length - 1 || 1)) * 100}%` }}
            />
          ))}
        </div>

        <ul className="relative space-y-3.5 w-full">
          {rows.map((row, index) => {
            const rawPct = maxValue > 0 ? (Number(row.value) / maxValue) * 100 : 0;
            const widthPct = Math.min(100, Math.max(2, isNaN(rawPct) ? 0 : rawPct));

            return (
              <li
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "grid grid-cols-[8.5rem_1fr] sm:grid-cols-[11rem_1fr] items-center gap-3 w-full",
                  onRowClick && "cursor-pointer group"
                )}
                title={onRowClick ? `Filtrar por ${row.name}` : row.name}
              >
                <div className="truncate text-right pr-1" title={row.name}>
                  <p className="truncate text-xs font-medium text-foreground">{row.name}</p>
                  {row.subtext && (
                    <p className="truncate text-[10px] text-muted-foreground font-normal">
                      {row.subtext}
                    </p>
                  )}
                </div>

                <div className="group relative h-7 w-full overflow-hidden rounded-r-full">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 overflow-hidden rounded-r-full",
                      "bg-gradient-to-r",
                      gradientClass,
                      shadowClass,
                      "transition-all duration-700 ease-out",
                      "group-hover:brightness-105"
                    )}
                    style={{
                      width: ready ? `${widthPct}%` : "0%",
                      maxWidth: "100%",
                      transitionDelay: `${index * 60}ms`,
                    }}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)] opacity-60" />
                  </div>
                  <span
                    className="pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 translate-x-2 rounded-md bg-foreground/90 px-1.5 py-0.5 text-[10px] tabular-nums text-background opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100"
                    style={{ left: `min(${widthPct}%, calc(100% - 4.5rem))` }}
                  >
                    {row.formattedValue ||
                      (isCurrency
                        ? `$${formatCurrency(Math.round(row.value))}`
                        : `${Number(row.value).toLocaleString("es-CO", { maximumFractionDigits: 2 })} un.`)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="relative mt-3 flex justify-between pl-[8.5rem] sm:pl-44 text-[10px] tabular-nums text-muted-foreground">
          {ticks.map((tick, i) => (
            <span
              key={i}
              className={cn(i === 0 && "translate-x-0", i === ticks.length - 1 && "text-right")}
            >
              {isCurrency ? formatAxisTick(tick) : Math.round(tick).toLocaleString("es-CO")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatStockDisplay(val: number | string | undefined | null): string {
  const num = parseTNSNumber(val);
  return num.toFixed(2);
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

export function TNSInventarioTab() {
  const {
    items,
    summary,
    totalCount,
    totalPages,
    page,
    pageSize,
    params,
    loading,
    summaryLoading,
    refreshing,
    error,
    lastUpdated,
    updateFilters,
    clearFilters,
    setPage,
    setPageSize,
    forceSync,
  } = useTNSInventario(true);

  const [analyticsView, setAnalyticsView] = useState<"bodegas" | "top_valor" | "top_stock" | "stock_bajo">("bodegas");
  const [bodegaMetric, setBodegaMetric] = useState<"costo" | "stock">("costo");
  const [selectedItemDetail, setSelectedItemDetail] = useState<TNSInventarioItem | null>(null);

  const [activeModalTab, setActiveModalTab] = useState<"info" | "proveedores" | "compras" | "ventas">("info");
  const [comprasHistorialData, setComprasHistorialData] = useState<TNSMaterialComprasHistorialResponse | null>(null);
  const [comprasLoading, setComprasLoading] = useState<boolean>(false);

  const [ventasHistorialData, setVentasHistorialData] = useState<TNSMaterialVentasHistorialResponse | null>(null);
  const [ventasLoading, setVentasLoading] = useState<boolean>(false);

  const [comprasSearchFactura, setComprasSearchFactura] = useState<string>("");
  const [comprasSearchProveedor, setComprasSearchProveedor] = useState<string>("");
  const [comprasFechaDesde, setComprasFechaDesde] = useState<string>("");
  const [comprasFechaHasta, setComprasFechaHasta] = useState<string>("");

  const [ventasSearchFactura, setVentasSearchFactura] = useState<string>("");
  const [ventasSearchCliente, setVentasSearchCliente] = useState<string>("");
  const [ventasFechaDesde, setVentasFechaDesde] = useState<string>("");
  const [ventasFechaHasta, setVentasFechaHasta] = useState<string>("");

  useEffect(() => {
    if (!selectedItemDetail) {
      setComprasHistorialData(null);
      setVentasHistorialData(null);
      setActiveModalTab("info");
      setComprasSearchFactura("");
      setComprasSearchProveedor("");
      setComprasFechaDesde("");
      setComprasFechaHasta("");
      setVentasSearchFactura("");
      setVentasSearchCliente("");
      setVentasFechaDesde("");
      setVentasFechaHasta("");
      return;
    }
    let isMounted = true;
    setComprasLoading(true);
    getTNSMaterialComprasHistorial(selectedItemDetail.prod_Dist_Cod)
      .then((res) => {
        if (isMounted) {
          setComprasHistorialData(res);
        }
      })
      .catch((err) => {
        console.error("Error al cargar historial de compras del material TNS:", err);
      })
      .finally(() => {
        if (isMounted) {
          setComprasLoading(false);
        }
      });

    setVentasLoading(true);
    getTNSMaterialVentasHistorial(selectedItemDetail.prod_Dist_Cod)
      .then((res) => {
        if (isMounted) {
          setVentasHistorialData(res);
        }
      })
      .catch((err) => {
        console.error("Error al cargar historial de ventas del material TNS:", err);
      })
      .finally(() => {
        if (isMounted) {
          setVentasLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedItemDetail]);

  const [tipoMateriaFilter, setTipoMateriaFilter] = useState<string>("TODOS");
  const [colorInputVal, setColorInputVal] = useState<string>(params.color || "");

  useEffect(() => {
    setColorInputVal(params.color || "");
  }, [params.color]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if ((params.color || "") !== colorInputVal.trim()) {
        updateFilters({ color: colorInputVal.trim() });
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [colorInputVal, params.color, updateFilters]);

  const processedItems = useMemo(() => {
    return items.map((m) => {
      const parsed = parseTNSDescription(m.prod_Dist_Desc);
      const clasificacion = clasificarArticuloTNS(m);
      return {
        ...m,
        materialBaseName: parsed.name,
        materialColor: parsed.color,
        category: clasificacion.categoria,
        requiere_revision: clasificacion.requiere_revision,
        metodo_clasificacion: clasificacion.metodo_clasificacion,
      };
    });
  }, [items]);

  // Conteos dinámicos por cada categoría sobre el 100% de los materiales cargados
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      TODOS: processedItems.length,
      Telas: 0,
      Accesorios: 0,
      Prendas: 0,
      Empaque: 0,
      Insumos: 0,
    };
    processedItems.forEach((item) => {
      if (counts[item.category] !== undefined) {
        counts[item.category]++;
      }
    });
    return counts;
  }, [processedItems]);

  const availableColors = useMemo(() => {
    const set = new Set<string>(COMMON_COLORS);
    processedItems.forEach((item) => {
      if (item.materialColor && item.materialColor.trim()) {
        set.add(item.materialColor.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [processedItems]);

  const displayItems = useMemo(() => {
    return processedItems.filter((item) => {
      if (tipoMateriaFilter !== "TODOS") {
        if (item.category.toUpperCase() !== tipoMateriaFilter.toUpperCase()) {
          return false;
        }
      }
      if (colorInputVal.trim()) {
        const q = colorInputVal.trim().toLowerCase();
        const matchColor = item.materialColor.toLowerCase().includes(q);
        const matchDesc = (item.prod_Dist_Desc || "").toLowerCase().includes(q);
        if (!matchColor && !matchDesc) {
          return false;
        }
      }
      return true;
    });
  }, [processedItems, tipoMateriaFilter, colorInputVal]);

  const availableBodegas = useMemo(() => {
    if (!summary?.distribucion_bodegas) return [];
    return summary.distribucion_bodegas.filter((b) => b.bodega_desc);
  }, [summary]);

  // Filas para la gráfica horizontal de bodegas
  const bodegaRows: HorizontalBarRow[] = useMemo(() => {
    if (!summary?.distribucion_bodegas) return [];
    return [...summary.distribucion_bodegas]
      .sort((a, b) => (bodegaMetric === "costo" ? b.total_costo - a.total_costo : b.total_stock - a.total_stock))
      .slice(0, 6)
      .map((b) => ({
        id: b.bodega_cod,
        name: b.bodega_desc || b.bodega_cod,
        value: bodegaMetric === "costo" ? b.total_costo : b.total_stock,
        formattedValue:
          bodegaMetric === "costo"
            ? `$${formatCurrency(Math.round(b.total_costo))}`
            : `${Math.round(b.total_stock).toLocaleString("es-CO")} un.`,
        subtext: `${b.total_items} ítems`,
      }));
  }, [summary, bodegaMetric]);

  // Filas para la gráfica horizontal de Top Mayor Valor
  const topValorRows: HorizontalBarRow[] = useMemo(() => {
    if (!summary?.top_mayor_valor) return [];
    return summary.top_mayor_valor.slice(0, 6).map((p) => {
      const parsed = parseTNSDescription(p.descripcion);
      return {
        id: p.codigo,
        name: parsed.name,
        value: p.costo_stock,
        formattedValue: `$${formatCurrency(Math.round(p.costo_stock))}`,
        subtext: `${p.codigo}${parsed.color ? ` • ${parsed.color}` : ""} • ${Math.round(p.cant_stock).toLocaleString("es-CO")} ${p.unidad}`,
      };
    });
  }, [summary]);

  // Filas para la gráfica horizontal de Top Stock Alto
  const topStockAltoRows: HorizontalBarRow[] = useMemo(() => {
    if (!summary?.top_stock_alto) return [];
    return summary.top_stock_alto.slice(0, 6).map((p) => {
      const parsed = parseTNSDescription(p.descripcion);
      return {
        id: p.codigo,
        name: parsed.name,
        value: p.cant_stock,
        formattedValue: `${Math.round(p.cant_stock).toLocaleString("es-CO")} ${p.unidad}`,
        subtext: `${p.codigo}${parsed.color ? ` • ${parsed.color}` : ""} • ${p.bodega_desc || p.bodega_cod}`,
      };
    });
  }, [summary]);

  // Filas para la gráfica horizontal de Stock Crítico / Bajo
  const topStockBajoRows: HorizontalBarRow[] = useMemo(() => {
    if (!summary?.top_stock_bajo) return [];
    return summary.top_stock_bajo.slice(0, 6).map((p) => {
      const parsed = parseTNSDescription(p.descripcion);
      return {
        id: p.codigo,
        name: parsed.name,
        value: p.cant_stock,
        formattedValue: `${Math.round(p.cant_stock).toLocaleString("es-CO")} ${p.unidad}`,
        subtext: `${p.codigo}${parsed.color ? ` • ${parsed.color}` : ""} • ${p.bodega_desc || p.bodega_cod}`,
      };
    });
  }, [summary]);

  // Métricas para los Status Rings de estado de materiales TNS
  const totalRegistros = summary?.total_registros ?? 0;
  const countAgotados = summary?.sin_stock ?? 0;
  const countStockBajo = summary?.stock_bajo_count ?? 0;
  const countOptimo = Math.max(0, (summary?.con_stock ?? 0) - countStockBajo);

  const hasAnyFilterActive = Boolean(
    params.search ||
      params.color ||
      (params.bodega && params.bodega !== "TODAS") ||
      (params.estado && params.estado !== "TODOS") ||
      (params.stock_status && params.stock_status !== "todos") ||
      (params.ordenar_por && params.ordenar_por !== "stock_desc") ||
      tipoMateriaFilter !== "TODOS" ||
      colorInputVal.trim() !== ""
  );

  const handleClearAllFilters = () => {
    clearFilters();
    setTipoMateriaFilter("TODOS");
    setColorInputVal("");
  };

  // Facturas de compra filtradas en el modal
  const filteredFacturasList = useMemo(() => {
    const list = comprasHistorialData?.compras_historial || [];
    return list.filter((f) => {
      if (comprasSearchFactura.trim()) {
        const q = comprasSearchFactura.trim().toLowerCase();
        const matchFact = (f.numfactura || "").toLowerCase().includes(q);
        const matchCod = (f.codarticulo || "").toLowerCase().includes(q);
        if (!matchFact && !matchCod) return false;
      }
      if (comprasSearchProveedor.trim()) {
        const q = comprasSearchProveedor.trim().toLowerCase();
        const matchNom = (f.nomtercero || "").toLowerCase().includes(q);
        const matchNit = (f.codtercero || "").toLowerCase().includes(q);
        if (!matchNom && !matchNit) return false;
      }
      if (comprasFechaDesde) {
        const fecha = formatTNSDate(f.fechafactu);
        if (fecha !== "—" && fecha < comprasFechaDesde) return false;
      }
      if (comprasFechaHasta) {
        const fecha = formatTNSDate(f.fechafactu);
        if (fecha !== "—" && fecha > comprasFechaHasta) return false;
      }
      return true;
    });
  }, [comprasHistorialData, comprasSearchFactura, comprasSearchProveedor, comprasFechaDesde, comprasFechaHasta]);

  const hasFacturaFiltersActive = Boolean(
    comprasSearchFactura.trim() ||
      comprasSearchProveedor.trim() ||
      comprasFechaDesde ||
      comprasFechaHasta
  );

  // Facturas de venta filtradas en el modal
  const filteredVentasList = useMemo(() => {
    const list = ventasHistorialData?.ventas_historial || [];
    return list.filter((v) => {
      if (ventasSearchFactura.trim()) {
        const q = ventasSearchFactura.trim().toLowerCase();
        const matchFact = (v.numfactura || "").toLowerCase().includes(q);
        const matchCod = (v.codarticulo || "").toLowerCase().includes(q);
        if (!matchFact && !matchCod) return false;
      }
      if (ventasSearchCliente.trim()) {
        const q = ventasSearchCliente.trim().toLowerCase();
        const { nombre, rol, nit } = parseTNSCliente(v);
        const vendedor = parseTNSVendedor(v).toLowerCase();
        const matchNom = nombre.toLowerCase().includes(q);
        const matchRol = rol.toLowerCase().includes(q);
        const matchNit = nit.toLowerCase().includes(q);
        const matchVen = vendedor.includes(q);
        if (!matchNom && !matchRol && !matchNit && !matchVen) return false;
      }
      if (ventasFechaDesde) {
        const fecha = formatTNSDate(v.fechafactu || v.fecha);
        if (fecha !== "—" && fecha < ventasFechaDesde) return false;
      }
      if (ventasFechaHasta) {
        const fecha = formatTNSDate(v.fechafactu || v.fecha);
        if (fecha !== "—" && fecha > ventasFechaHasta) return false;
      }
      return true;
    });
  }, [ventasHistorialData, ventasSearchFactura, ventasSearchCliente, ventasFechaDesde, ventasFechaHasta]);

  const hasVentaFiltersActive = Boolean(
    ventasSearchFactura.trim() ||
      ventasSearchCliente.trim() ||
      ventasFechaDesde ||
      ventasFechaHasta
  );

  const stockFilterOptions = [
    { label: "Todos", value: "todos", count: totalRegistros },
    { label: "Con Stock", value: "con_stock", count: summary?.con_stock },
    { label: "Agotados", value: "agotado", count: countAgotados },
    { label: "Stock Bajo", value: "stock_bajo", count: countStockBajo },
    { label: "Stock Alto", value: "stock_alto", count: summary?.stock_alto_count },
  ];

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- */}
      {/* 1. TARJETAS SUPERIORES DE MÉTRICAS (ESTILO INVENTORYOVERVIEW) */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total productos en TNS"
          value={totalRegistros}
          icon={Boxes}
          tone="optimal"
          subtitle={`${summary?.con_stock ?? 0} con stock • ${summary?.sin_stock ?? 0} sin stock`}
        />
        <SummaryCard
          title="Stock bajo (alerta reposición)"
          value={countStockBajo}
          icon={AlertTriangle}
          tone="low"
          subtitle="Productos con existencia ≤ 10"
        />
        <SummaryCard
          title="Agotados (sin existencias)"
          value={countAgotados}
          icon={PackageX}
          tone="out"
          subtitle="Productos con existencia 0"
        />
        <SummaryCard
          title="Valor total de inventario TNS"
          value={summary?.total_costo_stock ?? 0}
          formatValue={(n) => `$${formatCurrency(Math.round(n))}`}
          icon={DollarSign}
          tone="value"
          subtitle={`Disp: $${formatCurrency(Math.round(summary?.total_costo_disponible ?? 0))}`}
        />
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. GRÁFICAS Y ANALÍTICA (ESTILO IDÉNTICO AL PROYECTO) */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)] gap-4">
        {/* Status Rings de Estado de Materiales TNS */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">
                Estado de materiales TNS
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Distribución del inventario: óptimo, stock bajo y agotados.
              </p>
            </div>
            {lastUpdated && (
              <span className="text-[11px] text-muted-foreground font-mono shrink-0 pt-0.5">
                Sinc: {lastUpdated.toLocaleTimeString("es-CO")}
              </span>
            )}
          </CardHeader>
          <CardContent className="px-4 sm:px-8 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10 lg:gap-16 py-6 sm:py-8 place-items-center">
              <StatusRing
                label="Óptimo"
                count={countOptimo}
                total={totalRegistros}
                color="#10b981"
                trackColor="rgba(16, 185, 129, 0.15)"
                icon={Boxes}
                iconClassName="text-emerald-600"
              />
              <StatusRing
                label="Stock bajo"
                count={countStockBajo}
                total={totalRegistros}
                color="#ef4444"
                trackColor="rgba(239, 68, 68, 0.15)"
                icon={AlertTriangle}
                iconClassName="text-red-600"
              />
              <StatusRing
                label="Agotado"
                count={countAgotados}
                total={totalRegistros}
                color="#71717a"
                trackColor="rgba(113, 113, 122, 0.18)"
                icon={PackageX}
                iconClassName="text-zinc-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Gráfica Horizontal de Barras (Bodegas y Tops) */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">
                {analyticsView === "bodegas" && "Distribución por bodega"}
                {analyticsView === "top_valor" && "Top productos por valor"}
                {analyticsView === "top_stock" && "Top productos por existencias"}
                {analyticsView === "stock_bajo" && "Productos con stock crítico"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {analyticsView === "bodegas" &&
                  "Existencias y valor monetario consolidado por bodega en TNS."}
                {analyticsView === "top_valor" &&
                  "Artículos con mayor costo total valorizado en inventario."}
                {analyticsView === "top_stock" &&
                  "Artículos con mayor cantidad de existencias físicas."}
                {analyticsView === "stock_bajo" &&
                  "Artículos que requieren orden de compra o reposición inmediata."}
              </p>
            </div>

            {/* Selectores de vista analítica */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setAnalyticsView("bodegas")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-colors",
                  analyticsView === "bodegas"
                    ? "bg-red-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                Bodegas
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsView("top_valor")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-colors",
                  analyticsView === "top_valor"
                    ? "bg-red-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                Mayor valor
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsView("top_stock")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-colors",
                  analyticsView === "top_stock"
                    ? "bg-red-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                Stock alto
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsView("stock_bajo")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-colors",
                  analyticsView === "stock_bajo"
                    ? "bg-red-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                Stock bajo
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-1 pb-4">
            {analyticsView === "bodegas" && (
              <div className="space-y-2">
                <div className="flex justify-end gap-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setBodegaMetric("costo")}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded border transition-colors",
                      bodegaMetric === "costo"
                        ? "bg-foreground text-background font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Por valor ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBodegaMetric("stock")}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded border transition-colors",
                      bodegaMetric === "stock"
                        ? "bg-foreground text-background font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Por cantidad
                  </button>
                </div>
                <HorizontalGradientBarChart
                  rows={bodegaRows}
                  isCurrency={bodegaMetric === "costo"}
                  gradientClass="from-blue-600 via-blue-500 to-blue-400"
                  shadowClass="shadow-[0_6px_16px_-8px_rgba(59,130,246,0.65)]"
                  onRowClick={(row) => updateFilters({ bodega: row.name })}
                />
              </div>
            )}

            {analyticsView === "top_valor" && (
              <HorizontalGradientBarChart
                rows={topValorRows}
                isCurrency={true}
                gradientClass="from-emerald-600 via-emerald-500 to-emerald-400"
                shadowClass="shadow-[0_6px_16px_-8px_rgba(16,185,129,0.65)]"
                onRowClick={(row) => updateFilters({ search: row.id })}
              />
            )}

            {analyticsView === "top_stock" && (
              <HorizontalGradientBarChart
                rows={topStockAltoRows}
                isCurrency={false}
                gradientClass="from-indigo-600 via-indigo-500 to-indigo-400"
                shadowClass="shadow-[0_6px_16px_-8px_rgba(99,102,241,0.65)]"
                onRowClick={(row) => updateFilters({ search: row.id })}
              />
            )}

            {analyticsView === "stock_bajo" && (
              <HorizontalGradientBarChart
                rows={topStockBajoRows}
                isCurrency={false}
                gradientClass="from-red-600 via-red-500 to-red-400"
                shadowClass="shadow-[0_6px_16px_-8px_rgba(239,68,68,0.65)]"
                onRowClick={(row) => updateFilters({ search: row.id })}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. TABLA DE MATERIALES TNS (ESTILO CARD IDÉNTICO)     */}
      {/* ---------------------------------------------------- */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight">
              Materiales y productos en TNS
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Consulta en tiempo real sincronizada con el ERP TNS.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => forceSync()}
              disabled={loading || refreshing || summaryLoading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", (refreshing || loading) && "animate-spin")} />
              {refreshing ? "Sincronizando..." : "Actualizar desde TNS"}
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Píldoras de Filtro por Categorías / Tipo de Materia (Telas, Insumos, etc.) */}
          <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b">
            {[
              { id: "TODOS", label: "Todas las categorías", count: categoryCounts.TODOS },
              { id: "Telas", label: "Telas", count: categoryCounts.Telas },
              { id: "Accesorios", label: "Insumos y Accesorios", count: categoryCounts.Accesorios },
              { id: "Prendas", label: "Prendas", count: categoryCounts.Prendas },
              { id: "Empaque", label: "Empaque", count: categoryCounts.Empaque },
              { id: "Insumos", label: "Otros Insumos", count: categoryCounts.Insumos },
            ].map((cat) => {
              const isSelected = tipoMateriaFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setTipoMateriaFilter(cat.id)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5",
                    isSelected
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  <span>{cat.label}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                      isSelected
                        ? "bg-white/25 text-white"
                        : "bg-background text-muted-foreground"
                    )}
                  >
                    {cat.count.toLocaleString("es-CO")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Barra de Búsqueda y Filtros de Bodega/Color/Stock/Estado/Orden */}
          <div className="flex flex-wrap items-center gap-2.5 px-6 py-3 border-b bg-muted/20">
            {/* Input de Búsqueda */}
            <div className="flex-1 min-w-[180px] max-w-xs relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por código o nombre..."
                className="w-full border rounded-md pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                value={params.search || ""}
                onChange={(e) => updateFilters({ search: e.target.value })}
              />
            </div>

            {/* Selector de Bodega */}
            <div className="w-[175px]">
              <Select
                value={params.bodega || "TODAS"}
                onValueChange={(val) => updateFilters({ bodega: val })}
              >
                <SelectTrigger className="h-8 text-xs bg-background truncate">
                  <SelectValue placeholder="Todas las bodegas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">
                    Todas las bodegas ({totalRegistros.toLocaleString("es-CO")})
                  </SelectItem>
                  {availableBodegas.map((b) => (
                    <SelectItem key={b.bodega_cod} value={b.bodega_desc || b.bodega_cod}>
                      {b.bodega_desc || b.bodega_cod} ({b.total_items.toLocaleString("es-CO")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Color */}
            <div className="w-[160px] relative">
              <input
                type="text"
                placeholder="Filtrar por color..."
                className="w-full border rounded-md pl-2.5 pr-6 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground font-mono"
                value={colorInputVal}
                onChange={(e) => setColorInputVal(e.target.value)}
                list="tns-color-suggestions"
              />
              {colorInputVal && (
                <button
                  type="button"
                  onClick={() => {
                    setColorInputVal("");
                    updateFilters({ color: "" });
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Borrar color"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <datalist id="tns-color-suggestions">
                {availableColors.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {/* Selector de Nivel de Stock */}
            <div className="w-[140px]">
              <Select
                value={params.stock_status || "todos"}
                onValueChange={(val) => updateFilters({ stock_status: val })}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Nivel de stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los niveles</SelectItem>
                  <SelectItem value="con_stock">Con Stock (&gt; 0)</SelectItem>
                  <SelectItem value="agotado">Agotados (0)</SelectItem>
                  <SelectItem value="stock_bajo">Stock Bajo (≤ 10)</SelectItem>
                  <SelectItem value="stock_alto">Stock Alto (≥ 50)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selector de Estado */}
            <div className="w-[110px]">
              <Select
                value={params.estado || "TODOS"}
                onValueChange={(val) => updateFilters({ estado: val })}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selector de Orden */}
            <div className="w-[140px]">
              <Select
                value={params.ordenar_por || "stock_desc"}
                onValueChange={(val) => updateFilters({ ordenar_por: val })}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock_desc">Mayor Stock</SelectItem>
                  <SelectItem value="stock_asc">Menor Stock</SelectItem>
                  <SelectItem value="costo_desc">Mayor Costo</SelectItem>
                  <SelectItem value="costo_asc">Menor Costo</SelectItem>
                  <SelectItem value="nombre_asc">Nombre (A-Z)</SelectItem>
                  <SelectItem value="codigo_asc">Código (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasAnyFilterActive && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>

          {/* Error si aplica */}
          {error && (
            <div className="m-4 p-3 rounded-md bg-destructive/10 text-destructive text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => forceSync()}
                className="underline font-semibold hover:opacity-80"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Tabla */}
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Cargando materiales desde TNS...
            </div>
          ) : displayItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No se encontraron materiales en TNS con los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <Table className="min-w-[1150px]">
                <TableHeader>
                  <TableRow>
                    {/* 1. Código */}
                    <TableHead className="whitespace-nowrap min-w-[95px]">Código</TableHead>
                    {/* 2. Material / Producto */}
                    <TableHead className="whitespace-nowrap min-w-[210px]">Material / Producto</TableHead>
                    {/* 3. Color */}
                    <TableHead className="whitespace-nowrap min-w-[110px]">Color</TableHead>
                    {/* 4. Unidad */}
                    <TableHead className="whitespace-nowrap min-w-[65px]">Unidad</TableHead>
                    {/* 5. Categoría */}
                    <TableHead className="whitespace-nowrap min-w-[90px]">Categoría</TableHead>
                    {/* 6. Proveedor Principal */}
                    <TableHead className="whitespace-nowrap min-w-[200px]">Proveedor Principal</TableHead>
                    {/* 7. Bodega */}
                    <TableHead className="whitespace-nowrap min-w-[130px]">Bodega</TableHead>
                    {/* 8. Stock */}
                    <TableHead className="whitespace-nowrap text-right min-w-[85px]">Stock</TableHead>
                    {/* 9. Costo Total */}
                    <TableHead className="whitespace-nowrap text-right min-w-[105px]">Costo Total</TableHead>
                    {/* 10. Estado */}
                    <TableHead className="whitespace-nowrap min-w-[80px]">Estado</TableHead>
                    {/* 11. Nivel Stock */}
                    <TableHead className="whitespace-nowrap text-right min-w-[95px]">Nivel Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.map((m, idx) => {
                    const stock = parseTNSNumber(m.cant_Stock);
                    const costoStock = parseTNSNumber(m.costo_Stock);

                    const isOut = stock <= 0;
                    const isLow = stock > 0 && stock <= 10;
                    const isOptimal = stock > 10;

                    return (
                      <TableRow
                        key={`${m.prod_Dist_Cod}-${m.bodega_Cod || idx}`}
                        onClick={() => {
                          setSelectedItemDetail(m);
                          setActiveModalTab("info");
                        }}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isLow && "bg-red-50/90 hover:bg-red-50",
                          isOut && "bg-zinc-50 hover:bg-zinc-100/80"
                        )}
                      >
                        {/* 1. Código */}
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {m.prod_Dist_Cod}
                        </TableCell>

                        {/* 2. Material / Nombre Base */}
                        <TableCell className="font-medium max-w-[220px]">
                          <div className="truncate text-foreground font-semibold" title={m.materialBaseName}>
                            {m.materialBaseName}
                          </div>
                          {m.prod_Prov_Cod && (
                            <div className="text-[11px] text-muted-foreground font-mono truncate">
                              Ref: {m.prod_Prov_Cod}
                            </div>
                          )}
                        </TableCell>

                        {/* 3. Color extraído */}
                        <TableCell className="max-w-[130px]">
                          {m.materialColor ? (
                            <span
                              className="inline-flex items-center rounded-md bg-muted/90 px-2 py-0.5 text-xs font-semibold text-foreground font-mono truncate max-w-[120px]"
                              title={m.materialColor}
                            >
                              {m.materialColor}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        {/* 4. Unidad */}
                        <TableCell className="text-xs whitespace-nowrap">
                          {m.prd_UnidadInventario || "UND"}
                        </TableCell>

                        {/* 5. Categoría / Tipo de materia */}
                        <TableCell className="whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            {m.category}
                          </span>
                        </TableCell>

                        {/* 6. Proveedor Principal (con interacción directa a compras/cotizaciones) */}
                        <TableCell
                          className="max-w-[210px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItemDetail(m);
                            setActiveModalTab("proveedores");
                          }}
                        >
                          {m.proveedor_principal ? (
                            <div className="space-y-0.5 group/prov cursor-pointer">
                              <div
                                className="truncate text-xs font-semibold text-foreground group-hover/prov:text-red-600 group-hover/prov:underline transition-colors"
                                title={`${m.proveedor_principal} • Clic para ver compras e historial`}
                              >
                                {m.proveedor_principal}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {m.ultimo_costo_compra != null && m.ultimo_costo_compra > 0 && (
                                  <span className="text-[10px] text-muted-foreground tabular-nums">
                                    ${formatCurrency(Math.round(m.ultimo_costo_compra))} / {m.prd_UnidadInventario || "und"}
                                  </span>
                                )}
                                {m.ultima_compra_fecha && (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    • {m.ultima_compra_fecha}
                                  </span>
                                )}
                                {m.proveedores && m.proveedores.length > 1 && (
                                  <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.2 text-[10px] font-semibold text-blue-700">
                                    +{m.proveedores.length - 1} prov.
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        {/* 7. Bodega */}
                        <TableCell className="max-w-[140px]">
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground truncate max-w-[130px]">
                            {m.bodega_Desc || m.bodega_Cod}
                          </span>
                        </TableCell>

                        {/* 8. Stock */}
                        <TableCell
                          className={cn(
                            "text-right tabular-nums whitespace-nowrap",
                            isLow && "text-red-600 font-semibold",
                            isOut && "text-zinc-500",
                            isOptimal && "text-foreground font-medium"
                          )}
                        >
                          {formatStockDisplay(stock)}
                        </TableCell>

                        {/* 9. Costo Total */}
                        <TableCell className="text-right tabular-nums font-semibold text-foreground whitespace-nowrap">
                          ${formatCurrency(Math.round(costoStock))}
                        </TableCell>

                        {/* 10. Estado */}
                        <TableCell className="whitespace-nowrap">
                          {m.inventario_Estado === "Activo" ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                              Inactivo
                            </span>
                          )}
                        </TableCell>

                        {/* 11. Nivel Stock Badge */}
                        <TableCell className="text-right whitespace-nowrap">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                              <PackageX className="h-3.5 w-3.5" />
                              Agotado
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Stock bajo
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Óptimo
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pie de tabla con conteo de materiales y filtros aplicados */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-t bg-card text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Mostrando <strong className="text-foreground">{displayItems.length.toLocaleString("es-CO")}</strong>{" "}
                {displayItems.length === 1 ? "material" : "materiales"}
                {displayItems.length !== processedItems.length && (
                  <> de <strong className="text-foreground">{processedItems.length.toLocaleString("es-CO")}</strong> en total</>
                )}
              </span>
              {tipoMateriaFilter !== "TODOS" && (
                <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-2.5 py-0.5 text-[11px] font-medium border border-red-200 dark:border-red-800/40">
                  Categoría: {tipoMateriaFilter} ({displayItems.length})
                </span>
              )}
              {params.bodega && params.bodega !== "TODAS" && (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium">
                  Bodega: {params.bodega}
                </span>
              )}
              {colorInputVal && (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium font-mono">
                  Color: {colorInputVal}
                </span>
              )}
            </div>

            <div className="text-[11px] text-muted-foreground">
              {loading ? "Cargando inventario..." : "Inventario completo cargado desde TNS"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- */}
      {/* 4. DIÁLOGO DETALLE DEL PRODUCTO E HISTORIAL COMPRAS   */}
      {/* ---------------------------------------------------- */}
      <Dialog
        open={Boolean(selectedItemDetail)}
        onOpenChange={(open) => !open && setSelectedItemDetail(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2 border-b">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded">
                {selectedItemDetail?.prod_Dist_Cod}
              </span>
              {selectedItemDetail && (
                <span className="text-xs rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">
                  {detectTNSCategory(selectedItemDetail)}
                </span>
              )}
              <span className="text-xs rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-medium">
                {selectedItemDetail?.inventario_Estado || "Activo"}
              </span>
            </div>

            <DialogTitle className="text-base mt-2 font-semibold text-foreground">
              {selectedItemDetail && parseTNSDescription(selectedItemDetail.prod_Dist_Desc).name}
            </DialogTitle>

            {selectedItemDetail && parseTNSDescription(selectedItemDetail.prod_Dist_Desc).color && (
              <div className="text-xs text-muted-foreground font-mono">
                Color: <strong className="text-foreground">{parseTNSDescription(selectedItemDetail.prod_Dist_Desc).color}</strong>
              </div>
            )}

            {/* Pestañas de Navegación dentro del Modal */}
            <div className="flex items-center gap-1.5 pt-3">
              <button
                type="button"
                onClick={() => setActiveModalTab("info")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  activeModalTab === "info"
                    ? "bg-red-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                Resumen & Stock
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab("proveedores")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  activeModalTab === "proveedores"
                    ? "bg-red-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                Proveedores & Precios
                {comprasHistorialData?.proveedores?.length
                  ? ` (${comprasHistorialData.proveedores.length})`
                  : selectedItemDetail?.proveedores?.length
                  ? ` (${selectedItemDetail.proveedores.length})`
                  : ""}
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab("compras")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  activeModalTab === "compras"
                    ? "bg-red-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                Historial de Compras
                {comprasHistorialData?.compras_historial?.length
                  ? ` (${comprasHistorialData.compras_historial.length})`
                  : ""}
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab("ventas")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  activeModalTab === "ventas"
                    ? "bg-red-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                Historial de Ventas
                {ventasHistorialData?.ventas_historial?.length
                  ? ` (${ventasHistorialData.ventas_historial.length})`
                  : ""}
              </button>
            </div>
          </DialogHeader>

          {selectedItemDetail && (
            <div className="py-2 text-xs">
              {/* PESTAÑA 1: RESUMEN Y STOCK */}
              {activeModalTab === "info" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-muted/40 p-3 rounded-lg border">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Proveedor Principal</span>
                      <span className="font-semibold text-foreground truncate block" title={selectedItemDetail.proveedor_principal || "—"}>
                        {selectedItemDetail.proveedor_principal || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Último Costo Compra</span>
                      <span className="font-semibold text-foreground">
                        {selectedItemDetail.ultimo_costo_compra != null && selectedItemDetail.ultimo_costo_compra > 0
                          ? `$${formatCurrency(Math.round(selectedItemDetail.ultimo_costo_compra))}`
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Última Compra</span>
                      <span className="text-foreground">
                        {formatTNSDate(selectedItemDetail.ultima_compra_fecha)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Bodega</span>
                      <span className="font-semibold text-foreground">
                        {selectedItemDetail.bodega_Desc || selectedItemDetail.bodega_Cod}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Unidad de Medida</span>
                      <span className="font-semibold text-foreground">
                        {selectedItemDetail.prd_UnidadInventario}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Código Proveedor</span>
                      <span className="font-mono text-foreground">
                        {selectedItemDetail.prod_Prov_Cod || "—"}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-muted-foreground block text-[11px]">Descripción Completa en TNS</span>
                      <span className="text-foreground block font-mono text-[11px]">
                        {selectedItemDetail.prod_Dist_Desc}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-card border rounded-lg">
                      <span className="text-muted-foreground block text-[11px]">Existencia Stock Físico</span>
                      <span className="text-base font-bold text-foreground">
                        {formatStockDisplay(selectedItemDetail.cant_Stock)}{" "}
                        {selectedItemDetail.prd_UnidadInventario}
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-1">
                        Valorizado: ${formatCurrency(Math.round(parseTNSNumber(selectedItemDetail.costo_Stock)))}
                      </span>
                    </div>

                    <div className="p-3 bg-card border rounded-lg">
                      <span className="text-muted-foreground block text-[11px]">Cantidad Disponible</span>
                      <span className="text-base font-bold text-emerald-600">
                        {formatStockDisplay(selectedItemDetail.cant_Disponible)}{" "}
                        {selectedItemDetail.prd_UnidadInventario}
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-1">
                        Valorizado: ${formatCurrency(Math.round(parseTNSNumber(selectedItemDetail.costo_Disponible)))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* PESTAÑA 2: PROVEEDORES & COMPARATIVA DE PRECIOS */}
              {activeModalTab === "proveedores" && (
                <div className="space-y-3">
                  {comprasLoading ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Cargando proveedores y cotizaciones de compra...
                    </div>
                  ) : (
                    (() => {
                      const proveedoresList =
                        comprasHistorialData?.proveedores ||
                        selectedItemDetail.proveedores ||
                        [];

                      if (proveedoresList.length === 0) {
                        return (
                          <div className="p-8 text-center text-muted-foreground border rounded-lg bg-muted/20">
                            No se registran compras históricas ni proveedores para este material en TNS.
                          </div>
                        );
                      }

                      return (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Proveedor</TableHead>
                                <TableHead>NIT</TableHead>
                                <TableHead className="text-right">Último Costo Unit.</TableHead>
                                <TableHead>Última Factura</TableHead>
                                <TableHead>Fecha Compra</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {proveedoresList.map((p, idx) => {
                                const isPrincipal =
                                  (comprasHistorialData?.proveedor_principal &&
                                    p.nombre.toLowerCase().includes(comprasHistorialData.proveedor_principal.toLowerCase())) ||
                                  (selectedItemDetail.proveedor_principal &&
                                    p.nombre.toLowerCase().includes(selectedItemDetail.proveedor_principal.toLowerCase())) ||
                                  idx === 0;

                                return (
                                  <TableRow key={`${p.nit}-${idx}`}>
                                    <TableCell className="font-medium max-w-[200px]">
                                      <div className="truncate" title={p.nombre}>
                                        {p.nombre}
                                      </div>
                                      {isPrincipal && (
                                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-700 mt-0.5">
                                          Proveedor Principal
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="font-mono text-muted-foreground">
                                      {p.nit || "—"}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-semibold text-foreground">
                                      {p.ultimo_costo_unitario != null && p.ultimo_costo_unitario > 0
                                        ? `$${formatCurrency(Math.round(p.ultimo_costo_unitario))}`
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="font-mono text-muted-foreground">
                                      {p.num_factura || "—"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground whitespace-nowrap">
                                      {formatTNSDate(p.ultima_compra)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {/* PESTAÑA 3: HISTORIAL DE FACTURAS DE COMPRA */}
              {activeModalTab === "compras" && (
                <div className="space-y-3">
                  {/* Barra de Filtros interactiva para Facturas */}
                  <div className="p-3 bg-muted/40 border rounded-lg space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {/* Filtro Factura / Código */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Factura o código..."
                          value={comprasSearchFactura}
                          onChange={(e) => setComprasSearchFactura(e.target.value)}
                          className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-600"
                        />
                      </div>

                      {/* Filtro Proveedor / NIT */}
                      <div className="relative">
                        <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Proveedor o NIT..."
                          value={comprasSearchProveedor}
                          onChange={(e) => setComprasSearchProveedor(e.target.value)}
                          className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-600"
                        />
                      </div>

                      {/* Filtro Fecha Desde */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">Desde:</span>
                        <input
                          type="date"
                          value={comprasFechaDesde}
                          onChange={(e) => setComprasFechaDesde(e.target.value)}
                          className="h-8 w-full rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-600"
                        />
                      </div>

                      {/* Filtro Fecha Hasta */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">Hasta:</span>
                        <input
                          type="date"
                          value={comprasFechaHasta}
                          onChange={(e) => setComprasFechaHasta(e.target.value)}
                          className="h-8 w-full rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-600"
                        />
                      </div>
                    </div>

                    {/* Resumen de resultados y botón limpiar */}
                    <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground border-t border-border/50">
                      <span>
                        Mostrando <strong>{filteredFacturasList.length}</strong> de{" "}
                        <strong>{comprasHistorialData?.compras_historial?.length || 0}</strong> facturas
                      </span>

                      {hasFacturaFiltersActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setComprasSearchFactura("");
                            setComprasSearchProveedor("");
                            setComprasFechaDesde("");
                            setComprasFechaHasta("");
                          }}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-medium"
                        >
                          <X className="h-3 w-3" />
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  </div>

                  {comprasLoading ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Cargando historial detallado de facturas de compra...
                    </div>
                  ) : filteredFacturasList.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground border rounded-lg bg-muted/20">
                      {hasFacturaFiltersActive
                        ? "No se encontraron facturas que coincidan con los filtros aplicados."
                        : "No se encontraron facturas de compra registradas para este artículo."}
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden max-h-[380px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Factura</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">Costo Unit.</TableHead>
                            <TableHead className="text-right">Total Neto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredFacturasList.map((f, idx) => {
                            const cant = parseTNSNumber(f.cantidad);
                            const unitCost = parseTNSNumber(f.costoprome || f.valorbase);
                            const neto = parseTNSNumber(f.neto);

                            return (
                              <TableRow key={`${f.numfactura}-${idx}`}>
                                <TableCell className="text-muted-foreground whitespace-nowrap font-mono text-xs">
                                  {formatTNSDate(f.fechafactu)}
                                </TableCell>
                                <TableCell className="font-mono font-medium text-foreground whitespace-nowrap">
                                  {f.numfactura || "—"}
                                </TableCell>
                                <TableCell className="max-w-[200px]">
                                  <div className="truncate font-medium text-foreground" title={f.nomtercero}>
                                    {f.nomtercero}
                                  </div>
                                  {f.codtercero && (
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                      NIT: {f.codtercero}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium text-foreground whitespace-nowrap">
                                  {cant.toLocaleString("es-CO")} {f.unidad || "UND"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                                  ${formatCurrency(Math.round(unitCost))}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold text-foreground whitespace-nowrap">
                                  ${formatCurrency(Math.round(neto))}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* PESTAÑA 4: HISTORIAL DE VENTAS */}
              {activeModalTab === "ventas" && (
                <div className="space-y-3">
                  {/* Barra de Filtros Internos del Historial de Ventas */}
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                      {/* Filtro Factura / Código */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Factura o código..."
                          value={ventasSearchFactura}
                          onChange={(e) => setVentasSearchFactura(e.target.value)}
                          className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-600"
                        />
                      </div>

                      {/* Filtro Cliente / NIT */}
                      <div className="relative">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Cliente o NIT..."
                          value={ventasSearchCliente}
                          onChange={(e) => setVentasSearchCliente(e.target.value)}
                          className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-600"
                        />
                      </div>

                      {/* Filtro Fecha Desde */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">Desde:</span>
                        <input
                          type="date"
                          value={ventasFechaDesde}
                          onChange={(e) => setVentasFechaDesde(e.target.value)}
                          className="h-8 w-full rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-600"
                        />
                      </div>

                      {/* Filtro Fecha Hasta */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">Hasta:</span>
                        <input
                          type="date"
                          value={ventasFechaHasta}
                          onChange={(e) => setVentasFechaHasta(e.target.value)}
                          className="h-8 w-full rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-600"
                        />
                      </div>
                    </div>

                    {/* Resumen de resultados y botón limpiar */}
                    <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground border-t border-border/50">
                      <span>
                        Mostrando <strong>{filteredVentasList.length}</strong> de{" "}
                        <strong>{ventasHistorialData?.ventas_historial?.length || 0}</strong> ventas registradas
                      </span>

                      {hasVentaFiltersActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setVentasSearchFactura("");
                            setVentasSearchCliente("");
                            setVentasFechaDesde("");
                            setVentasFechaHasta("");
                          }}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-medium"
                        >
                          <X className="h-3 w-3" />
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  </div>

                  {ventasLoading ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Cargando historial detallado de facturas de venta...
                    </div>
                  ) : filteredVentasList.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground border rounded-lg bg-muted/20">
                      {hasVentaFiltersActive
                        ? "No se encontraron ventas que coincidan con los filtros aplicados."
                        : "No se encontraron facturas de venta registradas para este artículo."}
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden max-h-[380px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Factura</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Rol / Producción</TableHead>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">Valor Base</TableHead>
                            <TableHead className="text-right">Total Neto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredVentasList.map((v, idx) => {
                            const cant = parseTNSNumber(v.cantidad);
                            const base = parseTNSNumber(v.valorbase);
                            const neto = parseTNSNumber(v.neto);
                            const { nombre: clienteNombre, rol: clienteRol, nit: clienteNit } = parseTNSCliente(v);
                            const vendedorNombre = parseTNSVendedor(v);

                            return (
                              <TableRow key={`${v.numfactura}-${idx}`}>
                                <TableCell className="text-muted-foreground whitespace-nowrap font-mono text-xs">
                                  {formatTNSDate(v.fechafactu || v.fecha)}
                                </TableCell>
                                <TableCell className="font-mono font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                                  {v.numfactura || "—"}
                                </TableCell>
                                <TableCell className="max-w-[180px]">
                                  <div className="truncate font-medium text-foreground" title={clienteNombre}>
                                    {clienteNombre}
                                  </div>
                                  {clienteNit && (
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                      NIT: {clienteNit}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {clienteRol !== "—" ? (
                                    <span className="inline-flex items-center rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                                      {clienteRol}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="max-w-[160px]">
                                  <div className="truncate font-medium text-foreground" title={vendedorNombre}>
                                    {vendedorNombre}
                                  </div>
                                  {v.codven && vendedorNombre !== `Cod: ${v.codven}` && (
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                      Cod: {v.codven}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium text-foreground whitespace-nowrap">
                                  {cant.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {v.unidad || selectedItemDetail.prd_UnidadInventario || "UND"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                                  ${formatCurrency(Math.round(base))}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                  ${formatCurrency(Math.round(neto))}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
