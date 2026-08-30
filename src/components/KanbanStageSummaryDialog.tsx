import React, { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Package,
  History,
  AlertCircle,
  Clock,
  DollarSign,
  User,
  Calendar,
  Layers,
  FileText,
  AlertTriangle,
} from "lucide-react";
import type { ProductionOrder } from "@/data/mockData";
import type { KanbanEtapa } from "@/hooks/useKanbanEtapas";

function formatMoneyCop(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatStageHistoryDate(dateStr?: string | null): string {
  if (!dateStr) return "Fecha no registrada";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);

  const day = d.getDate();
  const months = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const month = months[d.getMonth()] || "";
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "p.m." : "a.m.";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hourStr = String(hours).padStart(2, "0");

  return `${day} ${month} ${year} · ${hourStr}:${minutes} ${ampm}`;
}

export interface KanbanStageSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: KanbanEtapa | null;
  orders: ProductionOrder[];
  targetOrder?: ProductionOrder | null;
  targetOrderId?: string | null;
}

export function KanbanStageSummaryDialog({
  open,
  onOpenChange,
  stage,
  orders,
  targetOrder,
  targetOrderId,
}: KanbanStageSummaryDialogProps) {
  const stageKey = stage?.key || "";
  const stageLabel = stage?.label || stageKey;

  // 1. Todas las órdenes asociadas a esta capa
  const allStageOrders = useMemo(() => {
    if (!stageKey) return [];

    return orders.filter((order) => {
      if (order.stage === stageKey) return true;
      if (order.stageHistory && order.stageHistory.some((h) => h.stage === stageKey)) return true;
      if (order.stageAssignees && order.stageAssignees[stageKey]) return true;
      if (order.costLedger && order.costLedger.some((e) => e.stage === stageKey)) return true;
      return false;
    });
  }, [orders, stageKey]);

  // 2. Selección de orden (prioriza targetOrder / targetOrderId, luego la primera de la lista)
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const initialId =
      targetOrder?.id ||
      targetOrder?.orderId ||
      targetOrderId ||
      allStageOrders[0]?.id ||
      allStageOrders[0]?.orderId ||
      "";
    setSelectedOrderId(initialId);
  }, [open, targetOrder, targetOrderId, allStageOrders]);

  // 3. Filtrar estrictamente la orden seleccionada
  const relevantOrders = useMemo(() => {
    if (!selectedOrderId) {
      return allStageOrders.length > 0 ? [allStageOrders[0]] : [];
    }

    const matches = allStageOrders.filter(
      (order) =>
        order.id === selectedOrderId ||
        order.orderId === selectedOrderId ||
        (selectedOrderId.startsWith("ORD-") && `ORD-${order.orderId.slice(0, 3)}` === selectedOrderId) ||
        (order.orderId && selectedOrderId.includes(order.orderId.slice(0, 3)))
    );

    return matches.length > 0 ? matches : allStageOrders.length > 0 ? [allStageOrders[0]] : [];
  }, [allStageOrders, selectedOrderId]);

  const activeTarget = relevantOrders[0] || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        <DialogHeader className="p-5 pb-3 border-b border-border/80 pr-12">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Resumen de tareas — {stageLabel}
            {activeTarget ? (
              <span className="text-sm font-normal text-muted-foreground">
                (ORD-{activeTarget.orderId.slice(0, 3)})
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Historial de tareas, costos de mano de obra y materiales en la capa{" "}
            <strong>{stageLabel}</strong>
            {activeTarget ? (
              <> para el pedido <strong>ORD-{activeTarget.orderId.slice(0, 3)}</strong></>
            ) : null}.
          </DialogDescription>
        </DialogHeader>

        {allStageOrders.length > 1 && (
          <div className="px-5 py-2 bg-muted/40 border-b flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-muted-foreground shrink-0">
              Ver resumen del pedido:
            </span>
            <Select
              value={selectedOrderId || activeTarget?.id || activeTarget?.orderId || ""}
              onValueChange={(val) => setSelectedOrderId(val)}
            >
              <SelectTrigger className="h-8 text-xs font-medium bg-background max-w-[340px]">
                <SelectValue placeholder="Seleccionar pedido" />
              </SelectTrigger>
              <SelectContent>
                {allStageOrders.map((o) => (
                  <SelectItem key={o.id || o.orderId} value={o.id || o.orderId} className="text-xs">
                    ORD-{o.orderId.slice(0, 3)} · {o.customerName || "Cliente"} ({o.quantity} uds)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Lista de tarjetas con scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {relevantOrders.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed rounded-xl border-border/80 bg-muted/20">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold text-foreground">
                No hay tareas registradas en {stageLabel}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Las órdenes asignadas a esta capa o que hayan transitado por ella aparecerán aquí
                con su detalle de mano de obra e historial.
              </p>
            </div>
          ) : (
            relevantOrders.map((order) => {
              const isCurrent = order.stage === stageKey;
              const quantity = Number(order.quantity) || 0;

              // Responsable asignado en esta etapa
              const stageAssigneeObj =
                order.stageAssignees?.[stageKey] ||
                order.stageAssignees?.[`${stageKey}__satellite`] ||
                order.stageAssignees?.[`${stageKey}__production`] ||
                (order.stageAssignees
                  ? Object.entries(order.stageAssignees).find(
                      ([k, v]) =>
                        (k === stageKey || k.startsWith(`${stageKey}__`) || k.startsWith(stageKey)) &&
                        Boolean(v?.name && v.name !== "Sin asignar")
                    )?.[1]
                  : undefined);

              const stageLedgerEntry = (order.costLedger || []).find(
                (e) =>
                  (e.stage === stageKey || e.stageLabel?.toLowerCase() === stageLabel.toLowerCase()) &&
                  (e.category === "labor" || e.category === "satellite") &&
                  Boolean(e.userName && e.userName !== "Sin asignar")
              );

              const stageAssignee =
                stageAssigneeObj?.name ||
                stageLedgerEntry?.userName ||
                (isCurrent
                  ? order.satelliteAssignee || order.assignee || order.satelliteName
                  : null) ||
                "Sin asignar";

              // Cálculo de mano de obra para esta etapa
              const stageConfig = order.stageLaborConfig?.[stageKey];
              let unitLabor = 0;
              let liveLaborTotal = 0;

              if (stageConfig !== undefined) {
                if (
                  stageConfig.enabled &&
                  stageConfig.perUnit != null &&
                  Number(stageConfig.perUnit) > 0
                ) {
                  unitLabor = Number(stageConfig.perUnit);
                  liveLaborTotal = quantity * unitLabor;
                }
              } else if (isCurrent && order.laborCostEnabled && order.laborCostPerUnit != null) {
                unitLabor = Number(order.laborCostPerUnit) || 0;
                liveLaborTotal = unitLabor > 0 ? quantity * unitLabor : 0;
              }

              // Entradas en ledger para esta capa
              const ledgerEntries = (order.costLedger || []).filter(
                (e) => e.stage === stageKey && (e.category === "labor" || e.category === "satellite")
              );
              const ledgerTotal = ledgerEntries.reduce(
                (sum, e) => sum + (Number(e.amount) || 0),
                0
              );

              // Costo de satélite si aplica
              const satelliteCost =
                isCurrent && order.satelliteCost != null && Number(order.satelliteCost) > 0
                  ? Number(order.satelliteCost)
                  : 0;

              const totalLaborCost =
                liveLaborTotal > 0
                  ? liveLaborTotal
                  : ledgerTotal > 0
                    ? ledgerTotal
                    : satelliteCost > 0
                      ? satelliteCost
                      : 0;

              const finalUnitLabor =
                unitLabor > 0
                  ? unitLabor
                  : totalLaborCost > 0 && quantity > 0
                    ? totalLaborCost / quantity
                    : 0;

              // Historial de entrada a esta fase
              const stageHistoryEntry = (order.stageHistory || []).find(
                (h) => h.stage === stageKey
              );
              const historyDate = stageHistoryEntry?.enteredAt || order.createdAt;

              // Materiales solicitados
              const requestedMaterials = order.requestedMaterials || [];

              // Novedades registradas
              const novedades = order.novedades || [];

              return (
                <div
                  key={order.id}
                  className="rounded-xl border border-border/80 bg-card p-4 shadow-sm space-y-3.5 transition-all hover:border-border"
                >
                  {/* Encabezado: Cantidad, Título y Código */}
                  <div>
                    <h4 className="text-base font-bold text-foreground leading-snug">
                      {quantity} {order.items || "Prendas de confección"}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                      <span className="font-semibold text-foreground/80">{order.id}</span> ·{" "}
                      {order.customerName || "Cliente no especificado"}
                    </p>
                  </div>

                  <div className="h-px bg-border/60" />

                  {/* Grid de métricas clave */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Responsable</span>
                      <span className="font-semibold text-foreground">{stageAssignee}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Cantidad</span>
                      <span className="font-semibold text-foreground">{quantity} uds</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Entrega</span>
                      <span className="font-semibold text-foreground">
                        {order.dueDate || "Sin fecha"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Días en etapa</span>
                      <span className="font-semibold text-foreground">
                        {order.daysInStage != null ? `${order.daysInStage}d` : "1d"}
                      </span>
                    </div>
                  </div>

                  {/* Sección Mano de Obra por Capa */}
                  <div className="rounded-lg bg-muted/40 border border-border/60 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Mano de obra en {stageLabel}:
                      </span>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {formatMoneyCop(totalLaborCost)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground flex-wrap gap-2 pt-0.5 border-t border-border/40">
                      <span>
                        Costo por unidad:{" "}
                        <strong className="text-foreground">
                          {finalUnitLabor > 0
                            ? `${formatMoneyCop(finalUnitLabor)} / ud`
                            : "No especificado"}
                        </strong>
                      </span>
                      {stageAssignee && stageAssignee !== "Sin asignar" && (
                        <span>
                          Cobrado por: <strong className="text-foreground">{stageAssignee}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Materiales solicitados */}
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold flex items-center gap-1.5 text-foreground">
                      <span className="text-red-500 font-bold">🧶</span> Materiales solicitados
                    </p>
                    {requestedMaterials.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground pl-4">
                        Sin solicitudes de material.
                      </p>
                    ) : (
                      <ul className="space-y-1 pl-4">
                        {requestedMaterials.map((mat, idx) => (
                          <li
                            key={mat.materialId || idx}
                            className="text-[11px] text-foreground/90 flex items-center gap-1.5"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                            <span>
                              {mat.materialName}:{" "}
                              <strong className="text-foreground">
                                {mat.quantity} {(mat as any).unit || "uds"}
                              </strong>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Novedades si existen */}
                  {novedades.length > 0 && (
                    <div className="space-y-1.5 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                      <p className="font-semibold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        Novedades ({novedades.length})
                      </p>
                      <div className="space-y-1 pl-4">
                        {novedades.map((nov) => (
                          <div key={nov.id} className="text-[11px]">
                            <span className="font-medium text-amber-900 dark:text-amber-200">
                              {nov.autorNombre}
                            </span>{" "}
                            <span className="text-muted-foreground text-[10px]">
                              ({formatStageHistoryDate(nov.createdAt)}):
                            </span>{" "}
                            <span className="text-foreground">{nov.texto}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Paso por esta fase */}
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold flex items-center gap-1.5 text-foreground">
                      <History className="h-3.5 w-3.5 text-red-500" />
                      Paso por esta fase
                    </p>
                    <p className="text-[11px] text-muted-foreground pl-4">
                      {formatStageHistoryDate(historyDate)} · {isCurrent ? "en curso" : "finalizado"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pie del modal */}
        <DialogFooter className="p-4 border-t border-border/80 flex items-center justify-end bg-muted/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9 px-4 font-medium"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
