import { useMemo, useState, type ComponentType } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Package,
  Eye,
  Layers,
  Ruler,
  Palette,
  Shirt,
  Hash,
  DollarSign,
  Calculator,
  Scissors,
  Flower2,
  Loader2,
} from "lucide-react";
import { formatCurrency, parseApiNumber } from "@/lib/format-number";
import type { ArticleDetailLine } from "@/lib/order-fields";
import { sumApplicableCostLines } from "@/lib/cost-summary";
import { useGetCostSummary } from "@/hooks/useGetCostSummary";
import { useGetFabricCosts } from "@/hooks/useGetFabricCosts";
import { useGetLaborCosts } from "@/hooks/useGetLaborCosts";
import { useGetSupplyCosts } from "@/hooks/useGetSupplyCosts";
import { useGetExtraCosts } from "@/hooks/useGetExtraCosts";

interface ArticlesDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ej. ORD-B3D o Q-c7a */
  documentLabel: string;
  customerName?: string;
  lines: ArticleDetailLine[];
  /** Texto plano si no hay ítems estructurados (p.ej. cotización antigua) */
  fallbackLines?: string[];
}

function shortVariantId(id: string) {
  if (!id) return "—";
  const compact = id.replace(/-/g, "");
  return `#${compact.slice(0, 4)}`;
}

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$ ${formatCurrency(value)}`;
}

function DetailField({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-2.5 py-2 min-w-0">
      <div className="flex items-start gap-2">
        <Icon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground leading-none mb-1">{label}</p>
          <p className="text-xs font-semibold text-foreground truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

function CostField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums truncate">{value}</p>
    </div>
  );
}

function ArticleCostStructureDialog({
  open,
  onOpenChange,
  line,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line: ArticleDetailLine | null;
}) {
  const variantId = line?.variantId || "";
  const activeVariantId = open && variantId ? variantId : "";
  const { data: summary, isLoading: summaryLoading } = useGetCostSummary(
    activeVariantId || undefined
  );
  const { data: fabrics, isLoading: fabricsLoading } = useGetFabricCosts(activeVariantId);
  const { data: labors, isLoading: laborsLoading } = useGetLaborCosts(activeVariantId);
  const { data: supplies, isLoading: suppliesLoading } = useGetSupplyCosts(activeVariantId);
  const { data: extras, isLoading: extrasLoading } = useGetExtraCosts(activeVariantId);

  const sizeCost = useMemo(() => {
    if (!summary?.sizes?.length || !line) return null;
    const byId =
      line.tallaId &&
      summary.sizes.find((s) => s.talla_id && s.talla_id === line.tallaId);
    if (byId) return byId;
    const byName = summary.sizes.find(
      (s) =>
        s.talla_nombre &&
        line.size &&
        s.talla_nombre.trim().toLowerCase() === line.size.trim().toLowerCase()
    );
    return byName || null;
  }, [summary, line]);

  const consumptionTallaIds = useMemo(
    () => new Set((summary?.sizes || []).map((s) => s.talla_id).filter(Boolean)),
    [summary?.sizes]
  );

  const resolvedSizeId = sizeCost?.talla_id || line?.tallaId || null;

  const costs = useMemo(() => {
    const fabricPerGarment = parseApiNumber(
      sizeCost?.fabric_total ?? summary?.fabric_total ?? 0
    );
    const fabricPriceFromSummary = parseApiNumber(summary?.fabric_price_per_meter ?? 0);
    const principalFabric = fabrics?.find((f) => f.es_principal) || fabrics?.[0];
    const fabricPriceFromRecord = parseApiNumber(principalFabric?.price_per_meter ?? 0);
    const fabricPricePerMeter =
      fabricPriceFromSummary > 0 ? fabricPriceFromSummary : fabricPriceFromRecord;

    const suppliesFromSummary = parseApiNumber(
      sizeCost?.supplies_total ?? summary?.supplies_total ?? 0
    );
    const laborFromSummary = parseApiNumber(
      sizeCost?.labor_total ?? summary?.labor_total ?? 0
    );
    const extrasFromSummary = parseApiNumber(
      sizeCost?.extras_total ?? summary?.extras_total ?? 0
    );

    const suppliesFromLines =
      supplies?.length
        ? sumApplicableCostLines(supplies, resolvedSizeId, consumptionTallaIds)
        : null;
    const laborFromLines =
      labors?.length
        ? sumApplicableCostLines(labors, resolvedSizeId, consumptionTallaIds)
        : null;
    const extrasFromLines =
      extras?.length
        ? sumApplicableCostLines(extras, resolvedSizeId, consumptionTallaIds)
        : null;

    const suppliesUnit =
      suppliesFromSummary > 0
        ? suppliesFromSummary
        : suppliesFromLines != null && suppliesFromLines > 0
          ? suppliesFromLines
          : suppliesFromSummary;
    const laborUnit =
      laborFromSummary > 0
        ? laborFromSummary
        : laborFromLines != null && laborFromLines > 0
          ? laborFromLines
          : laborFromSummary;
    const extrasUnit =
      extrasFromSummary > 0
        ? extrasFromSummary
        : extrasFromLines != null && extrasFromLines > 0
          ? extrasFromLines
          : extrasFromSummary;

    const overallFromSummary = parseApiNumber(
      sizeCost?.overall_total ?? summary?.overall_total ?? 0
    );
    const composed = fabricPerGarment + suppliesUnit + laborUnit + extrasUnit;
    const overallUnit =
      overallFromSummary > 0
        ? overallFromSummary
        : line?.unitCost != null && line.unitCost > 0
          ? line.unitCost
          : composed;

    return {
      fabricPricePerMeter,
      fabricPerGarment,
      suppliesUnit,
      laborUnit,
      extrasUnit,
      overallUnit,
    };
  }, [
    sizeCost,
    summary,
    fabrics,
    supplies,
    labors,
    extras,
    resolvedSizeId,
    consumptionTallaIds,
    line?.unitCost,
  ]);

  const {
    fabricPricePerMeter,
    fabricPerGarment,
    suppliesUnit,
    laborUnit,
    extrasUnit,
    overallUnit,
  } = costs;
  const qty = line?.quantity || 0;

  const fabricRef =
    fabrics?.find((f) => f.es_principal)?.reference ||
    fabrics?.[0]?.reference ||
    (line?.material && line.material !== "—" ? line.material : "—");

  const consumptionMeters = parseApiNumber(
    sizeCost?.consumption ?? summary?.average_consumption ?? 0
  );

  const loading =
    summaryLoading || fabricsLoading || laborsLoading || suppliesLoading || extrasLoading;
  const titleProduct = line?.productType || "Artículo";
  const titleVariation = line?.variation && line.variation !== "—" ? line.variation : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-base pr-6">
            <Calculator className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="min-w-0">
              <span className="block truncate">
                {titleProduct}
                {titleVariation ? ` — ${titleVariation}` : ""}
              </span>
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                Estructura de costos y materiales · {qty} unidad
                {qty === 1 ? "" : "es"}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {!line ? null : loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando costos…
          </div>
        ) : (
          <div className="space-y-3">
            <section className="rounded-xl border border-border/70 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Tela</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CostField label="Referencia" value={fabricRef} />
                <CostField label="Color" value={line.color || "—"} />
                <CostField
                  label="Costo tela / metro"
                  value={money(fabricPricePerMeter)}
                />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Total tela</p>
                  <p className="text-sm font-semibold text-foreground tabular-nums truncate">
                    {money(fabricPerGarment)}
                  </p>
                  {consumptionMeters > 0 && fabricPricePerMeter > 0 ? (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {consumptionMeters.toLocaleString("es-CO", {
                        maximumFractionDigits: 3,
                      })}{" "}
                      m × {money(fabricPricePerMeter)}/m
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border/70 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Flower2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Insumos</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CostField label="Talla" value={line.size || "—"} />
                <CostField label="Estampado / Bordado" value={line.print || "—"} />
                <CostField label="Costo insumos / unidad" value={money(suppliesUnit)} />
                <CostField label="Total insumos" value={money(suppliesUnit * qty)} />
              </div>
            </section>

            <section className="rounded-xl border border-border/70 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Mano de obra</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CostField label="Costo MO / unidad" value={money(laborUnit)} />
                <CostField label="Total MO" value={money(laborUnit * qty)} />
                <CostField label="Costos extra / unidad" value={money(extrasUnit)} />
                <CostField label="Total extras" value={money(extrasUnit * qty)} />
              </div>
            </section>

            <div className="rounded-xl bg-primary/5 border border-primary/15 px-3.5 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Costo unitario total</span>
                <span className="font-semibold tabular-nums">{money(overallUnit)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  Subtotal ({qty} uds)
                </span>
                <span className="font-bold tabular-nums text-primary">
                  {money(overallUnit * qty)}
                </span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ArticleLineCard({
  line,
  onMoreDetails,
}: {
  line: ArticleDetailLine;
  onMoreDetails: () => void;
}) {
  return (
    <div className="space-y-2.5 py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary shrink-0">
            {line.productType}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {shortVariantId(line.variantId)}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1.5 text-[11px] px-2.5"
          onClick={onMoreDetails}
        >
          <Eye className="h-3.5 w-3.5" />
          Ver más detalles
        </Button>
      </div>

      <div className="rounded-lg border border-border/70 px-3 py-2">
        <p className="text-[10px] text-muted-foreground mb-0.5">Variación</p>
        <p className="text-sm font-semibold text-foreground">{line.variation}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <DetailField icon={Layers} label="Línea" value={line.material} />
        <DetailField icon={Ruler} label="Talla" value={line.size} />
        <DetailField icon={Palette} label="Color" value={line.color} />
        <DetailField icon={Shirt} label="Estampado" value={line.print} />
        <DetailField
          icon={Hash}
          label="Cantidad"
          value={`${line.quantity} uds`}
        />
        <DetailField
          icon={DollarSign}
          label="Costo unitario"
          value={money(line.unitCost)}
        />
      </div>
    </div>
  );
}

export function ArticlesDetailDialog({
  open,
  onOpenChange,
  documentLabel,
  customerName,
  lines,
  fallbackLines = [],
}: ArticlesDetailDialogProps) {
  const [selectedLine, setSelectedLine] = useState<ArticleDetailLine | null>(null);
  const [costOpen, setCostOpen] = useState(false);

  const totalUnits = lines.reduce((s, l) => s + (l.quantity || 0), 0);
  const hasLines = lines.length > 0;
  const hasFallback = !hasLines && fallbackLines.length > 0;

  const subtitle = [
    customerName?.trim(),
    totalUnits > 0 ? `${totalUnits} unidades totales` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) {
            setCostOpen(false);
            setSelectedLine(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 text-base pr-6">
              <Package className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="block">
                  Artículos
                  {documentLabel ? (
                    <span className="font-bold"> — {documentLabel}</span>
                  ) : null}
                </span>
                {subtitle ? (
                  <span className="block text-xs font-normal text-muted-foreground mt-0.5 truncate">
                    {subtitle}
                  </span>
                ) : null}
              </span>
            </DialogTitle>
          </DialogHeader>

          {hasLines ? (
            <div className="divide-y divide-border/60">
              {lines.map((line) => (
                <ArticleLineCard
                  key={line.key}
                  line={line}
                  onMoreDetails={() => {
                    setSelectedLine(line);
                    setCostOpen(true);
                  }}
                />
              ))}
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

      <ArticleCostStructureDialog
        open={costOpen}
        onOpenChange={(next) => {
          setCostOpen(next);
          if (!next) setSelectedLine(null);
        }}
        line={selectedLine}
      />
    </>
  );
}
