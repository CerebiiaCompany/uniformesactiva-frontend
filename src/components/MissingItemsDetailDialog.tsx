import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KanbanStageChip } from "@/components/KanbanStageChip";
import type { SatelliteMissingItem } from "@/hooks/useSatellites";
import { workStatusLabel } from "@/lib/satellite-dashboard";
import { PackageX } from "lucide-react";

export type MissingOrderDetailView = {
  orderCode: string;
  customerName: string;
  description?: string;
  quantity?: number;
  stageKey?: string;
  stageLabel?: string;
  workStatus?: string;
  observations?: string;
  missingItems?: SatelliteMissingItem[];
  garmentLines?: { id: string; name: string; size?: string; expected: number }[];
};

type Props = {
  open: boolean;
  order: MissingOrderDetailView | null;
  onClose: () => void;
};

export function MissingItemsDetailDialog({ open, order, onClose }: Props) {
  const missing = order?.missingItems || [];
  const garments = order?.garmentLines || [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="h-4 w-4 text-amber-700" />
            Detalle del pedido
            {order?.orderCode ? ` · ${order.orderCode}` : ""}
          </DialogTitle>
          {order ? (
            <p className="text-sm text-muted-foreground">
              {order.customerName}
              {order.description ? ` · ${order.description}` : ""}
              {order.quantity ? ` · ${order.quantity} uds` : ""}
            </p>
          ) : null}
        </DialogHeader>

        {order ? (
          <div className="space-y-4 py-1">
            <div className="flex flex-wrap gap-1.5">
              {order.stageLabel ? (
                <KanbanStageChip
                  stageKey={order.stageKey || "stage"}
                  label={order.stageLabel}
                  className="text-[10px] px-2 py-0.5"
                />
              ) : null}
              {order.workStatus ? (
                <span className="inline-flex rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-medium">
                  {workStatusLabel(order.workStatus as "recibido_faltantes") ||
                    order.workStatus}
                </span>
              ) : null}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-950">
                Prendas con faltantes
              </p>
              {missing.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  El administrador marcó el pedido con faltantes, pero no dejó
                  desglose de prendas.
                  {order.observations
                    ? " Revisa las observaciones abajo."
                    : ""}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {missing.map((item, idx) => (
                    <li
                      key={`${item.id || item.name}-${idx}`}
                      className="flex items-start justify-between gap-2 rounded-md bg-background/80 border px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.size ? `Talla ${item.size}` : "Sin talla"}
                          {item.expected != null
                            ? ` · Esperadas: ${item.expected}`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-amber-800">
                        Faltan {item.missing}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {garments.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pedido completo
                </p>
                <ul className="rounded-lg border divide-y max-h-36 overflow-y-auto">
                  {garments.map((g) => (
                    <li
                      key={g.id}
                      className="flex justify-between gap-2 px-3 py-1.5 text-xs"
                    >
                      <span className="truncate">
                        {g.name}
                        {g.size ? ` · ${g.size}` : ""}
                      </span>
                      <span className="tabular-nums text-muted-foreground shrink-0">
                        {g.expected} uds
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {order.observations ? (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Observaciones del administrador
                </p>
                <p className="text-sm rounded-lg border bg-muted/30 px-3 py-2 whitespace-pre-wrap">
                  {order.observations}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
