import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Boxes, DollarSign, PackageX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-number";
import type { Material } from "@/hooks/useGetMaterials";
import type { TNSInventarioSummary } from "@/types/tns";

type StockBucket = "optimal" | "low" | "out";

export type InventoryMaterialStats = {
  total: number;
  optimal: number;
  low: number;
  out: number;
  totalValue: number;
};

type MaterialValueRow = {
  id: string;
  name: string;
  value: number;
};

function toNumber(value: number | string | undefined | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function classifyMaterialStock(material: Pick<Material, "stock" | "min_stock">): StockBucket {
  const stock = toNumber(material.stock);
  const minStock = toNumber(material.min_stock);
  if (stock <= 0) return "out";
  // Foto de referencia: stock bajo cuando stock <= mínimo
  if (stock <= minStock) return "low";
  return "optimal";
}

export function computeInventoryStats(materials: Material[]): InventoryMaterialStats {
  let optimal = 0;
  let low = 0;
  let out = 0;
  let totalValue = 0;

  for (const m of materials) {
    const stock = toNumber(m.stock);
    const unitCost = toNumber(m.unit_cost);
    totalValue += stock * unitCost;

    const bucket = classifyMaterialStock(m);
    if (bucket === "out") out += 1;
    else if (bucket === "low") low += 1;
    else optimal += 1;
  }

  return {
    total: materials.length,
    optimal,
    low,
    out,
    totalValue,
  };
}

/** Mismas métricas que el módulo Inventario TNS (óptimo / bajo / agotado). */
export function computeInventoryStatsFromTnsSummary(
  summary: TNSInventarioSummary | null | undefined
): InventoryMaterialStats {
  if (!summary) {
    return { total: 0, optimal: 0, low: 0, out: 0, totalValue: 0 };
  }
  const out = Number(summary.sin_stock) || 0;
  const low = Number(summary.stock_bajo_count) || 0;
  const conStock = Number(summary.con_stock) || 0;
  const optimal = Math.max(0, conStock - low);
  const totalFromBuckets = optimal + low + out;
  const total =
    Number(summary.total_registros) > 0
      ? Number(summary.total_registros)
      : totalFromBuckets;

  return {
    total,
    optimal,
    low,
    out,
    totalValue: Number(summary.total_costo_stock) || 0,
  };
}

export function computeTopMaterialsByValue(materials: Material[], limit = 6): MaterialValueRow[] {
  return materials
    .map((m) => ({
      id: m.id,
      name: m.name,
      value: toNumber(m.stock) * toNumber(m.unit_cost),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function useCountUp(target: number, durationMs = 900) {
  const [display, setDisplay] = useState(0);
  const reducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (reducedMotion.current || durationMs <= 0) {
      setDisplay(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setDisplay(target);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return display;
}

type SummaryCardProps = {
  title: string;
  value: number;
  formatValue?: (n: number) => string;
  icon: ComponentType<{ className?: string }>;
  tone: "optimal" | "low" | "out" | "value";
};

const toneStyles = {
  optimal: {
    iconWrap: "bg-emerald-500/15 text-emerald-600",
    value: "text-foreground",
  },
  low: {
    iconWrap: "bg-red-500/15 text-red-600",
    value: "text-foreground",
  },
  out: {
    iconWrap: "bg-zinc-400/20 text-zinc-500",
    value: "text-foreground",
  },
  value: {
    iconWrap: "bg-red-500/10 text-red-600",
    value: "text-foreground",
  },
} as const;

function SummaryCard({ title, value, formatValue, icon: Icon, tone }: SummaryCardProps) {
  const animated = useCountUp(value);
  const styles = toneStyles[tone];

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition-transform duration-300 hover:scale-[1.02] hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground leading-snug">{title}</p>
          <p className={cn("text-2xl tabular-nums tracking-tight", styles.value)}>
            {formatValue ? formatValue(animated) : Math.round(animated).toLocaleString("es-CO")}
          </p>
        </div>
        <div className={cn("rounded-full p-2.5 shrink-0", styles.iconWrap)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

type StatusRingProps = {
  label: string;
  count: number;
  total: number;
  color: string;
  trackColor: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
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
          <span className="text-base tabular-nums leading-none">{count}</span>
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

function TopMaterialsByValueChart({ rows }: { rows: MaterialValueRow[] }) {
  const maxValue = rows[0]?.value ?? 0;
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
        Sin valor de inventario para graficar.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative pl-[7.5rem] sm:pl-36">
        <div className="pointer-events-none absolute inset-y-0 left-[7.5rem] right-0 sm:left-36">
          {ticks.map((tick, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-6 border-l border-dashed border-border/70"
              style={{ left: `${(i / (ticks.length - 1 || 1)) * 100}%` }}
            />
          ))}
        </div>

        <ul className="relative space-y-3.5">
          {rows.map((row, index) => {
            const widthPct = maxValue > 0 ? (row.value / maxValue) * 100 : 0;
            return (
              <li key={row.id} className="grid grid-cols-[7.5rem_1fr] sm:grid-cols-[9rem_1fr] items-center gap-3">
                <p
                  className="truncate text-right text-xs font-medium text-muted-foreground"
                  title={row.name}
                >
                  {row.name}
                </p>
                <div className="group relative h-7">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 overflow-hidden rounded-r-full",
                      "bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400",
                      "shadow-[0_6px_16px_-8px_rgba(16,185,129,0.65)]",
                      "transition-all duration-700 ease-out",
                      "group-hover:brightness-105"
                    )}
                    style={{
                      width: ready ? `${Math.max(widthPct, 2)}%` : "0%",
                      transitionDelay: `${index * 60}ms`,
                    }}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)] opacity-60" />
                  </div>
                  <span
                    className="pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 translate-x-2 rounded-md bg-foreground/90 px-1.5 py-0.5 text-[10px] tabular-nums text-background opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100"
                    style={{ left: `min(${Math.max(widthPct, 2)}%, calc(100% - 4.5rem))` }}
                  >
                    ${formatCurrency(Math.round(row.value))}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="relative mt-3 flex justify-between pl-0 text-[10px] tabular-nums text-muted-foreground">
          {ticks.map((tick, i) => (
            <span key={i} className={cn(i === 0 && "translate-x-0", i === ticks.length - 1 && "text-right")}>
              {formatAxisTick(tick)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

type InventoryMaterialStatusRingsProps = {
  /** Preferido: métricas del resumen TNS (módulo Inventario). */
  stats?: InventoryMaterialStats | null;
  /** @deprecated Inventario local — el proyecto usa TNS. */
  materials?: Material[];
  isLoading?: boolean;
  /** Enlace opcional al inventario completo */
  showInventoryLink?: boolean;
};

/** Gráficas circulares de estado (óptimo / bajo / agotado) — reutilizable en Dashboard. */
export function InventoryMaterialStatusRings({
  stats: statsProp,
  materials,
  isLoading,
  showInventoryLink = false,
}: InventoryMaterialStatusRingsProps) {
  const stats = useMemo(() => {
    if (statsProp) return statsProp;
    return computeInventoryStats(materials || []);
  }, [statsProp, materials]);

  if (isLoading && stats.total === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold tracking-tight">Estado de materiales</CardTitle>
          <p className="text-xs text-muted-foreground">Cargando inventario TNS…</p>
        </CardHeader>
        <CardContent>
          <div className="h-[160px] rounded-lg bg-muted/40 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (stats.total === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold tracking-tight">Estado de materiales</CardTitle>
          <p className="text-xs text-muted-foreground">
            Distribución del inventario: óptimo, stock bajo y agotados.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="rounded-full bg-muted p-3 text-muted-foreground">
            <Boxes className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-foreground">Sin datos de inventario TNS</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            El inventario se consulta en tiempo real desde el ERP TNS. Verifica la conexión
            o actualiza desde el módulo Inventario.
          </p>
          {showInventoryLink ? (
            <Link
              to="/inventory"
              className="text-xs font-medium text-primary hover:underline mt-1"
            >
              Ir a inventario
            </Link>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  // Porcentajes alineados al módulo Inventario TNS (sobre total de registros)
  const ringTotal = Math.max(1, stats.total || stats.optimal + stats.low + stats.out);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg font-semibold tracking-tight">Estado de materiales</CardTitle>
          <p className="text-xs text-muted-foreground">
            Distribución del inventario TNS: óptimo, stock bajo y agotados.
          </p>
        </div>
        {showInventoryLink ? (
          <Link
            to="/inventory"
            className="text-xs font-medium text-primary hover:underline shrink-0 pt-0.5"
          >
            Ver inventario
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="px-4 sm:px-8 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10 lg:gap-16 py-6 sm:py-8 place-items-center">
          <StatusRing
            label="Óptimo"
            count={stats.optimal}
            total={ringTotal}
            color="#10b981"
            trackColor="rgba(16, 185, 129, 0.15)"
            icon={Boxes}
            iconClassName="text-emerald-600"
          />
          <StatusRing
            label="Stock bajo"
            count={stats.low}
            total={ringTotal}
            color="#ef4444"
            trackColor="rgba(239, 68, 68, 0.15)"
            icon={AlertTriangle}
            iconClassName="text-red-600"
          />
          <StatusRing
            label="Agotado"
            count={stats.out}
            total={ringTotal}
            color="#71717a"
            trackColor="rgba(113, 113, 122, 0.18)"
            icon={PackageX}
            iconClassName="text-zinc-500"
          />
        </div>
      </CardContent>
    </Card>
  );
}

type InventoryOverviewProps = {
  materials: Material[];
  isLoading?: boolean;
};

export function InventoryOverview({ materials, isLoading }: InventoryOverviewProps) {
  const stats = useMemo(() => computeInventoryStats(materials), [materials]);
  const topByValue = useMemo(() => computeTopMaterialsByValue(materials, 6), [materials]);
  const hasInventory = stats.total > 0;

  if (isLoading && materials.length === 0) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-xl border bg-muted/40" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-[280px] rounded-xl border bg-muted/40" />
          <div className="h-[280px] rounded-xl border bg-muted/40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasInventory ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Materiales en estado óptimo"
            value={stats.optimal}
            icon={Boxes}
            tone="optimal"
          />
          <SummaryCard title="Stock bajo" value={stats.low} icon={AlertTriangle} tone="low" />
          <SummaryCard title="Agotados" value={stats.out} icon={PackageX} tone="out" />
          <SummaryCard
            title="Valor total de inventario"
            value={stats.totalValue}
            formatValue={(n) => `$${formatCurrency(Math.round(n))}`}
            icon={DollarSign}
            tone="value"
          />
        </div>
      ) : null}

      {hasInventory ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)] gap-4">
          <InventoryMaterialStatusRings materials={materials} />

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold tracking-tight">Top materiales por valor</CardTitle>
              <p className="text-xs text-muted-foreground">
                Del mayor al menor valor en inventario (stock × costo unitario).
              </p>
            </CardHeader>
            <CardContent className="pt-1 pb-4">
              <TopMaterialsByValueChart rows={topByValue} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="rounded-full bg-muted p-3 text-muted-foreground">
              <Boxes className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">Inventario vacío</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Agrega materiales al inventario para ver indicadores y gráficas de stock,
              valor y estado.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
