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
import { PackageCheck } from "lucide-react";
import { formatMoneyCop } from "@/lib/satellite-dashboard";

export type DispatchDeliveryCostPayload = {
  amount: number;
  registeredAt: string;
};

type DispatchDeliveryCostDialogProps = {
  open: boolean;
  orderShortId?: string;
  customerName?: string;
  productName?: string;
  saving?: boolean;
  onCancel: () => void;
  onConfirm: (payload: DispatchDeliveryCostPayload) => void | Promise<void>;
};

/**
 * Modal al marcar un pedido como entregado: captura el costo de despacho
 * que se suma en el desglose «Despacho y domicilios».
 */
export function DispatchDeliveryCostDialog({
  open,
  orderShortId,
  customerName,
  productName,
  saving = false,
  onCancel,
  onConfirm,
}: DispatchDeliveryCostDialogProps) {
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open) setAmount("");
  }, [open]);

  const parsed = amount.trim() === "" ? NaN : Number(amount);
  const valid = Number.isFinite(parsed) && parsed >= 0;

  const handleConfirm = async () => {
    if (!valid || saving) return;
    await onConfirm({
      amount: parsed,
      registeredAt: new Date().toISOString(),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-emerald-600" />
            Costo de despacho
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ingresa el costo de despacho/entrega antes de marcar el pedido como entregado
            {orderShortId ? (
              <>
                {" "}
                · <span className="font-semibold text-foreground">{orderShortId}</span>
                {customerName ? ` · ${customerName}` : ""}
                {productName ? ` · ${productName}` : ""}
              </>
            ) : null}
            . El valor se guarda como <strong>Despacho a cliente</strong> en el desglose
            de <strong>Despacho y domicilios</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dispatchCost" className="text-xs text-muted-foreground font-medium">
                Costo de despacho (COP)
              </Label>
              <Input
                id="dispatchCost"
                type="number"
                min="0"
                step="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej: 15000"
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
              <span className="text-muted-foreground">A sumar en desglose</span>
              <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {valid ? formatMoneyCop(parsed) : "$0"}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Puedes dejar 0 si no hubo costo de despacho. Con valor &gt; 0 aparecerá también en
            Despacho → Domicilios.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!valid || saving}
            onClick={() => void handleConfirm()}
            className="font-semibold bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? "Guardando…" : "Confirmar y marcar entregado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
