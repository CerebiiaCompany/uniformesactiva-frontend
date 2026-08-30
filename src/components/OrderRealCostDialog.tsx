import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Layers,
  Package,
  Shirt,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-number";
import type { OrderItem } from "@/hooks/useOrders";
import {
  getKanbanStageSoftPanelClass,
  getKanbanStageSoftTextClass,
  getKanbanStageTheme,
} from "@/lib/kanban-stage-theme";
import {
  computeOrderEstimatedLaborCost,
  computeRealAccumulatedCost,
  emptyRealCost,
  splitMaterialLines,
  type OrderRealCostBreakdown,
  type RealCostLine,
} from "@/lib/order-real-cost";
import {
  buildDeliveredMaterialsInfo,
  type DeliveredInfoLine,
  type DeliveredMaterialsInfo,
} from "@/lib/delivered-materials-info";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DeliveredMaterialsView = "pedido" | "prenda" | "variante";

type OrderRealCostDialogProps = {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderLabel?: string;
  estimatedCost: number;
  orderItems?: OrderItem[];
  breakdown: OrderRealCostBreakdown | null;
};

function money(value: number) {
  return `$${formatCurrency(value)}`;
}

type SummaryCardTheme = {
  icon: LucideIcon | ComponentType<{ className?: string }>;
  panel: string;
  border: string;
  accent: string;
  label: string;
  value: string;
  iconWrap: string;
};

function HandsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M10 10V4.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M13 10V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M7 11v2.5a3.5 3.5 0 0 0 3.5 3.5H11" />
      <path d="M16 11v2.5a3.5 3.5 0 0 1-3.5 3.5H13" />
      <path d="M11 17v2.5" />
      <path d="M13 17v2.5" />
    </svg>
  );
}

function SewingMachineIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 9h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" />
      <path d="M16 9V6.5a1.5 1.5 0 0 1 1.5-1.5H19" />
      <circle cx="9.5" cy="14" r="1.25" />
      <path d="M9.5 15.25V18" />
      <path d="M7 6h2.5" />
      <path d="M19 5v2" />
    </svg>
  );
}

/** Paleta alineada al diseño: rojo marca + pasteles Kanban (Producción). */
const SUMMARY_CARD_THEMES: Record<string, SummaryCardTheme> = {
  "Materiales entregados": {
    icon: Package,
    panel: "bg-primary/[0.05]",
    border: "border-primary/15",
    accent: "bg-primary",
    label: "text-foreground/90",
    value: "text-primary",
    iconWrap: "bg-primary/10 text-primary border border-primary/15",
  },
  "Mano de obra": {
    icon: HandsIcon,
    panel: "bg-[#F4F7F3]/95",
    border: "border-[#A8BFA3]/45",
    accent: "bg-[#A8BFA3]",
    label: "text-[#4F6B4A]",
    value: "text-[#3D5638]",
    iconWrap: "bg-[#F4F7F3] text-[#4F6B4A] border border-[#A8BFA3]/40",
  },
  Satélites: {
    icon: SewingMachineIcon,
    panel: "bg-[#F6F4F9]/95",
    border: "border-[#B7A8C9]/45",
    accent: "bg-[#B7A8C9]",
    label: "text-[#6B5A82]",
    value: "text-[#5A4A72]",
    iconWrap: "bg-[#F6F4F9] text-[#6B5A82] border border-[#B7A8C9]/40",
  },
  "Envíos y domicilios": {
    icon: Truck,
    panel: "bg-[#F5F6F7]/95",
    border: "border-[#A8B0B8]/45",
    accent: "bg-[#A8B0B8]",
    label: "text-[#4F5963]",
    value: "text-[#3D4650]",
    iconWrap: "bg-[#F5F6F7] text-[#4F5963] border border-[#A8B0B8]/40",
  },
};

function SummaryMetricCard({
  title,
  amount,
}: {
  title: string;
  amount: number;
}) {
  const theme = SUMMARY_CARD_THEMES[title];
  const Icon = theme?.icon ?? Package;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border px-3.5 py-3 flex items-center gap-2.5 shadow-sm bg-card",
        "motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.04] hover:shadow-md hover:z-10",
        theme?.panel,
        theme?.border,
      )}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", theme?.accent ?? "bg-muted")} />
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ml-0.5",
          theme?.iconWrap ?? "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-sm font-medium leading-snug",
            theme?.label ?? "text-foreground"
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            "tabular-nums shrink-0 text-sm font-bold",
            theme?.value ?? "text-foreground"
          )}
        >
          {money(amount)}
        </span>
      </div>
    </div>
  );
}

function MaterialTable({
  lines,
  emptyMessage,
}: {
  lines: RealCostLine[];
  emptyMessage?: string;
}) {
  if (!lines.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {emptyMessage || "Sin registros."}
      </p>
    );
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material</TableHead>
          <TableHead className="text-right w-[120px]">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line, idx) => (
          <TableRow key={`${line.label}-${idx}`}>
            <TableCell className="align-top">
              <span className="text-sm text-foreground break-words leading-snug block">
                {line.label}
              </span>
              {line.userName && line.materialSource === "kanban_additional" ? (
                <span className="text-[11px] text-primary/90 block mt-0.5 font-medium">
                  Solicitado por {line.userName}
                  {line.stageLabel ? ` · ${line.stageLabel}` : ""}
                </span>
              ) : null}
              {line.detail ? (
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  {line.detail}
                </span>
              ) : null}
            </TableCell>
            <TableCell className="text-right tabular-nums align-top">
              {money(line.amount)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/30 font-medium">
          <TableCell>Total</TableCell>
          <TableCell className="text-right tabular-nums">{money(total)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function LaborStageCard({ line }: { line: RealCostLine }) {
  const stageKey = line.stage || line.stageLabel;
  const theme = getKanbanStageTheme(stageKey);
  const stageTitle = (line.stageLabel || line.stage || "Capa").trim();
  const personName = (line.userName || "Sin asignar").trim();

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden min-w-[140px] flex-1 max-w-[180px]",
        getKanbanStageSoftPanelClass(stageKey)
      )}
    >
      <div className={cn("h-1.5 w-full", theme?.bar || "bg-muted-foreground/30")} />
      <div className="px-3 py-3 text-center space-y-1">
        <p
          className={cn(
            "text-xs font-semibold leading-tight",
            getKanbanStageSoftTextClass(stageKey)
          )}
        >
          {stageTitle}
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug break-words">
          {personName}
        </p>
        <p className="text-sm font-bold tabular-nums text-foreground pt-1">
          {money(line.amount)}
        </p>
      </div>
    </div>
  );
}

function DetailCard({
  title,
  subtitle,
  headerExtra,
  children,
}: {
  title: string;
  subtitle?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/20 space-y-2.5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          ) : null}
        </div>
        {headerExtra}
      </div>
      <div className="px-2 py-1">{children}</div>
    </div>
  );
}

function InfoMaterialRows({ lines }: { lines: DeliveredInfoLine[] }) {
  if (!lines.length) {
    return (
      <p className="text-sm text-muted-foreground py-3 text-center">
        Sin materiales de costeo para este grupo.
      </p>
    );
  }
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material</TableHead>
          <TableHead className="text-right w-[120px]">Valor ref.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line, idx) => (
          <TableRow key={`${line.label}-${idx}`}>
            <TableCell className="align-top">
              <span className="text-sm text-foreground break-words leading-snug block">
                {line.label}
              </span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                {line.detail}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums align-top">
              {money(line.amount)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/30 font-medium">
          <TableCell>Subtotal ref.</TableCell>
          <TableCell className="text-right tabular-nums">{money(total)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function DeliveredInfoByProduct({ info }: { info: DeliveredMaterialsInfo }) {
  if (!info.byProduct.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No hay prendas en la orden para desglosar.
      </p>
    );
  }
  return (
    <div className="space-y-3 px-1 py-2">
      {info.byProduct.map((product) => (
        <div key={product.key} className="rounded-lg border bg-muted/10 overflow-hidden">
          <div className="px-3 py-2.5 border-b bg-muted/20 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug">
                {product.productName}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {product.units.toLocaleString("es-CO")} uds · {product.variants.length}{" "}
                {product.variants.length === 1 ? "variante" : "variantes"}
              </p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground shrink-0">
              {money(product.total)}
            </span>
          </div>
          <InfoMaterialRows lines={product.lines} />
        </div>
      ))}
    </div>
  );
}

function DeliveredInfoByVariant({ info }: { info: DeliveredMaterialsInfo }) {
  if (!info.byVariant.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No hay variantes en la orden para desglosar.
      </p>
    );
  }
  return (
    <div className="space-y-3 px-1 py-2">
      {info.byVariant.map((variant) => (
        <div key={variant.key} className="rounded-lg border bg-muted/10 overflow-hidden">
          <div className="px-3 py-2.5 border-b bg-muted/20 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug">
                {variant.variantName}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {variant.productName} · {variant.units.toLocaleString("es-CO")} uds del pedido
              </p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground shrink-0">
              {money(variant.total)}
            </span>
          </div>
          <InfoMaterialRows lines={variant.lines} />
        </div>
      ))}
    </div>
  );
}

export function OrderRealCostDialog({
  open,
  onClose,
  orderId,
  orderLabel,
  estimatedCost,
  orderItems = [],
  breakdown,
}: OrderRealCostDialogProps) {
  const [estimatedLabor, setEstimatedLabor] = useState<number | null>(null);
  const [loadingLabor, setLoadingLabor] = useState(false);
  const [deliveredView, setDeliveredView] = useState<DeliveredMaterialsView>("pedido");
  const [deliveredInfo, setDeliveredInfo] = useState<DeliveredMaterialsInfo | null>(null);
  const [loadingDeliveredInfo, setLoadingDeliveredInfo] = useState(false);
  const [deliveredInfoError, setDeliveredInfoError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEstimatedLabor(null);
      setDeliveredView("pedido");
      setDeliveredInfo(null);
      setDeliveredInfoError(null);
      return;
    }
    setDeliveredInfo(null);
    setDeliveredInfoError(null);
    let cancelled = false;
    setLoadingLabor(true);
    void computeOrderEstimatedLaborCost(orderItems)
      .then((value) => {
        if (!cancelled) setEstimatedLabor(value);
      })
      .catch(() => {
        if (!cancelled) setEstimatedLabor(0);
      })
      .finally(() => {
        if (!cancelled) setLoadingLabor(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, orderId, orderItems]);

  useEffect(() => {
    if (!open || deliveredView === "pedido") return;
    let cancelled = false;
    setLoadingDeliveredInfo(true);
    setDeliveredInfoError(null);
    void buildDeliveredMaterialsInfo(orderItems)
      .then((info) => {
        if (!cancelled) setDeliveredInfo(info);
      })
      .catch(() => {
        if (!cancelled) {
          setDeliveredInfoError("No se pudo cargar el desglose informativo.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDeliveredInfo(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, deliveredView, orderId, orderItems]);

  const data = breakdown || emptyRealCost(orderId);
  const { delivered: deliveredMaterials, additional: additionalMaterials } = useMemo(
    () => splitMaterialLines(data.materialsLines),
    [data.materialsLines]
  );

  const materialsTotal = data.materials;
  const realAccumulated = computeRealAccumulatedCost(data);
  const estimated = Number(estimatedCost) || 0;
  const savings = estimated - realAccumulated;
  const shortId = orderLabel || `ORD-${orderId.slice(0, 3).toUpperCase()}`;

  const laborKanbanLines = useMemo(
    () =>
      [...data.laborLines].filter(
        (line) => line.category === "labor" || line.category === "mold" || !line.category
      ),
    [data.laborLines]
  );

  const summaryCards = [
    { title: "Materiales entregados", amount: materialsTotal },
    { title: "Mano de obra", amount: data.labor },
    { title: "Satélites", amount: data.satellites },
    { title: "Envíos y domicilios", amount: data.shipping },
  ];

  const deliveredSubtitle =
    deliveredView === "pedido"
      ? "Según costeo de variante × cantidad de la orden — base del costo real"
      : deliveredView === "prenda"
        ? "Vista informativa: materiales agrupados por prenda (no altera el costo real)"
        : "Vista informativa: qué y cuánto lleva cada variante (no altera el costo real)";

  const deliveredViewButtons = (
    <div className="flex flex-wrap gap-1.5">
      {(
        [
          { id: "pedido" as const, label: "Pedido", icon: Package },
          { id: "prenda" as const, label: "Por prenda", icon: Shirt },
          { id: "variante" as const, label: "Por variante", icon: Layers },
        ] as const
      ).map(({ id, label, icon: Icon }) => {
        const active = deliveredView === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setDeliveredView(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              active
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3 sticky top-0 bg-background z-10 border-b">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-red-600 shrink-0" />
              <h2 className="text-base font-bold text-foreground">
                Costo real — {shortId}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-2xl">
              Telas a precio TNS; insumos al precio del costeo de variante. Los materiales
              adicionales del Kanban se suman a materiales entregados.
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
          <div className="grid grid-cols-2 gap-3 p-1">
            {summaryCards.map((card) => (
              <SummaryMetricCard key={card.title} title={card.title} amount={card.amount} />
            ))}
          </div>

          <div className="rounded-xl border bg-muted/20 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Costo estimado de la orden</span>
              <span className="tabular-nums text-foreground">{money(estimated)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Costo aproximado de mano de obra (config. variante)
              </span>
              <span className="tabular-nums text-foreground">
                {loadingLabor ? "…" : money(estimatedLabor ?? 0)}
              </span>
            </div>
            <div className="border-t pt-3 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">
                  Costo real acumulado
                </span>
                <span className="text-base text-red-600 tabular-nums font-semibold">
                  {money(realAccumulated)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Suma materiales entregados (incluye adicionales del Kanban) y mano de obra
                registrada directamente por el usuario de producción o satélite en el tablero.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm border-t pt-3">
              <span className="text-muted-foreground">
                {savings >= 0 ? "Ahorro vs estimado" : "Sobrecosto vs estimado"}
              </span>
              <span
                className={cn(
                  "tabular-nums font-medium",
                  savings >= 0 ? "text-emerald-600" : "text-red-600"
                )}
              >
                {money(Math.abs(savings))}
              </span>
            </div>
          </div>

          <DetailCard
            title="Materiales entregados"
            subtitle={deliveredSubtitle}
            headerExtra={deliveredViewButtons}
          >
            {deliveredView === "pedido" ? (
              <MaterialTable
                lines={deliveredMaterials}
                emptyMessage="Sin materiales del costeo de variante."
              />
            ) : loadingDeliveredInfo ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Cargando desglose informativo…
              </p>
            ) : deliveredInfoError ? (
              <p className="text-sm text-red-600 py-4 text-center">{deliveredInfoError}</p>
            ) : deliveredView === "prenda" && deliveredInfo ? (
              <DeliveredInfoByProduct info={deliveredInfo} />
            ) : deliveredView === "variante" && deliveredInfo ? (
              <DeliveredInfoByVariant info={deliveredInfo} />
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sin datos para mostrar.
              </p>
            )}
          </DetailCard>

          {additionalMaterials.length > 0 ? (
            <DetailCard
              title="Materiales adicionales (Kanban)"
              subtitle="Solicitudes extra de producción o satélite — visibles para el administrador"
            >
              <MaterialTable lines={additionalMaterials} />
            </DetailCard>
          ) : (
            <DetailCard
              title="Materiales adicionales (Kanban)"
              subtitle="Solicitudes extra de producción o satélite"
            >
              <MaterialTable
                lines={[]}
                emptyMessage="Sin solicitudes adicionales registradas en el tablero de fábrica."
              />
            </DetailCard>
          )}

          <DetailCard
            title="Costo por mano de obra (Kanban)"
            subtitle="Valor cobrado por capa y responsable en producción"
          >
            {laborKanbanLines.length > 0 ? (
              <div className="flex flex-wrap gap-3 px-2 py-3 justify-center sm:justify-start">
                {laborKanbanLines.map((line, idx) => (
                  <LaborStageCard key={`${line.stage}-${line.userId}-${idx}`} line={line} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sin mano de obra registrada en el Kanban.
              </p>
            )}
          </DetailCard>
        </div>
      </div>
    </div>
  );
}
