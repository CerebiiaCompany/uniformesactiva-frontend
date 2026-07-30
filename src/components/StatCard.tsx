import { useEffect, useRef, useState } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  /** Número a animar, o texto estático si no hay conteo. */
  value: string | number;
  /** Formatea el número durante/después del conteo (p. ej. moneda). */
  formatValue?: (n: number) => string;
  /** Sufijo estático tras el número animado (p. ej. " días", "%"). */
  suffix?: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  variant?: "default" | "accent" | "success" | "warning" | "destructive";
  /** Duración del recuento en ms. */
  countDurationMs?: number;
}

const variantStyles = {
  default: "bg-card border-border",
  accent: "bg-accent/10 border-accent/20",
  success: "bg-success/10 border-success/20",
  warning: "bg-warning/10 border-warning/20",
  destructive: "bg-destructive/10 border-destructive/20",
};

const iconStyles = {
  default: "text-primary",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function useCountUp(target: number | null, durationMs: number) {
  const [display, setDisplay] = useState(0);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (target == null || Number.isNaN(target)) {
      setDisplay(0);
      return;
    }

    if (reducedMotion.current || durationMs <= 0) {
      setDisplay(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = easeOutCubic(progress);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return display;
}

function resolveNumericTarget(value: string | number): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function StatCard({
  title,
  value,
  formatValue,
  suffix = "",
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  countDurationMs = 1100,
}: StatCardProps) {
  const numericTarget = resolveNumericTarget(value);
  const animated = useCountUp(numericTarget, countDurationMs);

  const renderedValue =
    numericTarget != null
      ? `${formatValue ? formatValue(animated) : Math.round(animated).toLocaleString("es-CO")}${suffix}`
      : String(value);

  return (
    <div
      className={cn(
        "rounded-lg border p-4 animate-fade-in origin-center",
        "transition-transform duration-300 ease-out will-change-transform",
        "hover:scale-[1.04] hover:z-10 hover:shadow-md",
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
            {renderedValue}
          </p>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p
              className={cn(
                "text-xs font-medium",
                trend.positive ? "text-success" : "text-destructive"
              )}
            >
              {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}% vs mes anterior
            </p>
          )}
        </div>
        <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconStyles[variant])} />
      </div>
    </div>
  );
}
