import { cn } from "@/lib/utils";
import type { FactoryVariantRow } from "@/lib/order-fields";

interface FactoryVariantBreakdownProps {
  variants: FactoryVariantRow[];
  /** denser layout for narrow kanban cards */
  compact?: boolean;
  className?: string;
}

export function FactoryVariantBreakdown({
  variants,
  compact = false,
  className,
}: FactoryVariantBreakdownProps) {
  if (!variants.length) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        Sin variantes en el pedido
      </p>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {variants.map((v) => (
        <div
          key={v.variantId}
          className={cn(
            "rounded-md border border-border/60 bg-muted/30",
            compact ? "px-2 py-1.5" : "px-2.5 py-2"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <p className="text-[10px] text-muted-foreground truncate">
                Línea:{" "}
                <span className="font-medium text-foreground">{v.linea}</span>
              </p>
              <p className={cn("font-semibold text-foreground truncate", compact ? "text-[11px]" : "text-xs")}>
                {v.producto}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                Variante:{" "}
                <span className="font-medium text-foreground">{v.variante}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                Color:{" "}
                <span className="font-medium text-foreground">{v.color}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn("font-bold tabular-nums text-primary", compact ? "text-xs" : "text-sm")}>
                {v.cantidad}
              </p>
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">uds</p>
            </div>
          </div>
          {v.tallas.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {v.tallas.map((t) => (
                <span
                  key={`${v.variantId}-${t.nombre}`}
                  className="inline-flex items-center rounded bg-background/80 border px-1.5 py-0.5 text-[9px] font-medium"
                >
                  {t.nombre}
                  <span className="ml-1 text-primary font-bold">×{t.cantidad}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
