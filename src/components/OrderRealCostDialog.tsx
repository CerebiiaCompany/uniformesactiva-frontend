import { Calculator, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-number";
import { KanbanStageChip } from "@/components/KanbanStageChip";
import {
  emptyRealCost,
  type OrderRealCostBreakdown,
  type RealCostLine,
} from "@/lib/order-real-cost";

type OrderRealCostDialogProps = {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderLabel?: string;
  estimatedCost: number;
  breakdown: OrderRealCostBreakdown | null;
};

function money(value: number) {
  return `$${formatCurrency(value)}`;
}

function isUnassignedName(name?: string | null) {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  return n === "sin asignar" || n === "sin asignar (producción)";
}

function CategoryBlock({
  title,
  amount,
  lines,
  defaultOpen,
}: {
  title: string;
  amount: number;
  lines: RealCostLine[];
  defaultOpen?: boolean;
}) {
  const visibleLines = lines.filter(
    (l) => l.userId || !isUnassignedName(l.userName) || l.actorKind === "provider"
  );
  if (!visibleLines.length && amount <= 0) return null;
  return (
    <details open={defaultOpen} className="rounded-xl border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-sm tabular-nums text-foreground">{money(amount)}</span>
      </summary>
      {visibleLines.length > 0 ? (
        <div className="border-t px-4 py-2.5 space-y-2">
          {visibleLines.map((line, idx) => {
            const baseLabel = (line.label || "").replace(/^\[[^\]]+\]\s*/, "");
            return (
              <div
                key={`${line.label}-${idx}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 text-sm"
              >
                <div className="min-w-0 space-y-1">
                  <span className="text-muted-foreground break-words leading-snug block">
                    {baseLabel}
                  </span>
                  {line.userName && !isUnassignedName(line.userName) ? (
                    <span className="text-[11px] text-muted-foreground/80 block">
                      {line.userName}
                    </span>
                  ) : null}
                </div>
                <span className="tabular-nums shrink-0 text-right">
                  {money(line.amount)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </details>
  );
}

export function OrderRealCostDialog({
  open,
  onClose,
  orderId,
  orderLabel,
  estimatedCost,
  breakdown,
}: OrderRealCostDialogProps) {
  if (!open) return null;

  const data = breakdown || emptyRealCost(orderId);
  const diff = data.total - (Number(estimatedCost) || 0);
  const shortId = orderLabel || `ORD-${orderId.slice(0, 3).toUpperCase()}`;

  const categories = [
    { title: "Materiales entregados", amount: data.materials, lines: data.materialsLines },
    { title: "Mano de obra", amount: data.labor, lines: data.laborLines },
    { title: "Satélites", amount: data.satellites, lines: data.satelliteLines },
    { title: "Envíos y domicilios", amount: data.shipping, lines: data.shippingLines },
  ];

  const byUser = (data.byUser || []).filter(
    (u) => u.userId && !isUnassignedName(u.userName)
  );
  const openCategory =
    categories.find((c) => c.lines.length > 0 || c.amount > 0)?.title || "Satélites";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3 sticky top-0 bg-background z-10 border-b">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-red-600 shrink-0" />
              <h2 className="text-base font-bold text-foreground">
                Costo real — {shortId}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-xl">
              Acumulado por capa del Kanban y por usuario (producción / satélite) que cargó
              materiales, mano de obra o talleres.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 hover:bg-red-700"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 sm:px-6 pb-6 pt-4 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categories.map((cat) => (
              <div
                key={cat.title}
                className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm bg-card"
              >
                <span className="text-foreground">{cat.title}</span>
                <span className="tabular-nums shrink-0">{money(cat.amount)}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border bg-muted/20 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">Costo real acumulado</span>
              <span className="text-base text-red-600 tabular-nums">
                {money(data.total)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Costo estimado de la orden</span>
              <span className="tabular-nums text-muted-foreground">{money(estimatedCost)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {diff <= 0 ? "Ahorro vs estimado" : "Sobrecosto vs estimado"}
              </span>
              <span
                className={cn(
                  "tabular-nums",
                  diff <= 0 ? "text-emerald-600" : "text-red-600"
                )}
              >
                {money(Math.abs(diff))}
              </span>
            </div>
          </div>

          {byUser.length > 0 ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Por usuario / taller</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Quién generó cada peso en las capas del Kanban.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {byUser.map((user) => (
                  <details
                    key={user.userId}
                    open={byUser.length <= 3}
                    className="rounded-xl border bg-card"
                  >
                    <summary className="cursor-pointer list-none px-4 py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0 space-y-1.5 flex-1">
                        <span className="text-sm font-semibold text-foreground block">
                          {user.userName}
                        </span>
                        {(user.stages || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.stages.map((stage) => (
                              <KanbanStageChip
                                key={`${user.userId}-${stage.key}`}
                                label={stage.label || stage.key}
                                stageKey={stage.key}
                                className="text-[10px] font-semibold px-2 py-0.5"
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <span className="text-sm tabular-nums shrink-0 pt-0.5">
                        {money(user.amount)}
                      </span>
                    </summary>
                    <div className="border-t px-4 py-3 space-y-2.5">
                      {user.lines.map((line, idx) => {
                        const baseLabel = (line.label || "").replace(/^\[[^\]]+\]\s*/, "");
                        return (
                          <div
                            key={`${user.userId}-${idx}`}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 text-sm"
                          >
                            <span className="text-muted-foreground break-words leading-snug min-w-0">
                              {baseLabel}
                            </span>
                            <span className="tabular-nums shrink-0 text-right">
                              {money(line.amount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Por categoría</h3>
            <div className="grid grid-cols-1 gap-3">
              {categories.map((cat) => (
                <CategoryBlock
                  key={`detail-${cat.title}`}
                  title={cat.title}
                  amount={cat.amount}
                  lines={cat.lines}
                  defaultOpen={cat.title === openCategory && cat.amount > 0}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
