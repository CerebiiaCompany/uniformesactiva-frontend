import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck } from "lucide-react";
import { formatMoneyCop } from "@/lib/satellite-dashboard";

export type SatelliteRoundtripCostPayload = {
  amount: number;
  satelliteUserId: string;
  satelliteName: string;
  registeredAt: string;
  stage: string;
  stageLabel: string;
};

type SatelliteRoundtripCostDialogProps = {
  open: boolean;
  satelliteName: string;
  orderShortId?: string;
  customerName?: string;
  stageLabel?: string;
  saving?: boolean;
  onConfirm: (payload: SatelliteRoundtripCostPayload) => void | Promise<void>;
};

/**
 * Modal obligatorio tras asignar un satélite: captura el costo de domicilio ida y vuelta.
 */
export function SatelliteRoundtripCostDialog({
  open,
  satelliteName,
  orderShortId,
  customerName,
  stageLabel,
  saving = false,
  onConfirm,
}: SatelliteRoundtripCostDialogProps) {
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open) setAmount("");
  }, [open]);

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  const handleConfirm = async () => {
    if (!valid || saving) return;
    await onConfirm({
      amount: parsed,
      satelliteUserId: "",
      satelliteName,
      registeredAt: new Date().toISOString(),
      stage: "",
      stageLabel: stageLabel || "Domicilio ida y vuelta",
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* Obligatorio: no se cierra sin confirmar el valor */
      }}
    >
      <DialogContent
        className="sm:max-w-[440px] [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Costo domicilio ida y vuelta
          </DialogTitle>
          <DialogDescription className="text-xs">
            Indica el valor del domicilio (ida y vuelta) para el satélite{" "}
            <span className="font-semibold text-foreground">{satelliteName || "—"}</span>
            {orderShortId ? (
              <>
                {" "}
                · {orderShortId}
                {customerName ? ` · ${customerName}` : ""}
              </>
            ) : null}
            {stageLabel ? ` · ${stageLabel}` : null}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="roundtripCost" className="text-xs text-muted-foreground font-medium">
                Valor ida y vuelta (COP)
              </Label>
              <Input
                id="roundtripCost"
                type="number"
                min="0"
                step="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej: 25000"
                className="h-10 bg-background text-sm tabular-nums"
                autoFocus
                disabled={saving}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleConfirm();
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Costo a registrar</span>
              <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {valid ? formatMoneyCop(parsed) : "$0"}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Este valor aparecerá en Despacho → Domicilios (columna Costo) con la fecha y hora exactas
            del registro.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            size="sm"
            disabled={!valid || saving}
            onClick={() => void handleConfirm()}
            className="font-semibold"
          >
            {saving ? "Guardando…" : "Registrar domicilio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
