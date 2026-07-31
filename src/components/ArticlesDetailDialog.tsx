import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Package } from "lucide-react";
import { FactoryVariantBreakdown } from "@/components/FactoryVariantBreakdown";
import type { FactoryVariantRow } from "@/lib/order-fields";

interface ArticlesDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ej. ORD-B3D · Dubo SAS */
  title: string;
  variants: FactoryVariantRow[];
  /** Texto plano si no hay ítems estructurados (p.ej. cotización antigua) */
  fallbackLines?: string[];
}

export function ArticlesDetailDialog({
  open,
  onOpenChange,
  title,
  variants,
  fallbackLines = [],
}: ArticlesDetailDialogProps) {
  const totalUnits = variants.reduce((s, v) => s + (v.cantidad || 0), 0);
  const hasVariants = variants.length > 0;
  const hasFallback = !hasVariants && fallbackLines.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary shrink-0" />
            <span className="min-w-0">
              Artículos
              <span className="block text-xs font-normal text-muted-foreground truncate mt-0.5">
                {title}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {hasVariants ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {variants.length} variante{variants.length === 1 ? "" : "s"} ·{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {totalUnits} uds
              </span>
            </p>
            <FactoryVariantBreakdown variants={variants} />
          </div>
        ) : hasFallback ? (
          <ul className="space-y-2">
            {fallbackLines.map((line, i) => (
              <li
                key={`${line}-${i}`}
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium"
              >
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay artículos registrados.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
