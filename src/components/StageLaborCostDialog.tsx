import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";
import type { ProductionOrder } from "@/data/mockData";
import { formatMoneyCop } from "@/lib/satellite-dashboard";

type StageLaborCostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: ProductionOrder | null;
  stageKey: string;
  stageLabel: string;
  onSave: (data: { enabled: boolean; perUnit: number | null }) => void | Promise<void>;
  saving?: boolean;
};

export function StageLaborCostDialog({
  open,
  onOpenChange,
  card,
  stageKey,
  stageLabel,
  onSave,
  saving = false,
}: StageLaborCostDialogProps) {
  const [perUnit, setPerUnit] = useState("");

  useEffect(() => {
    if (!open || !card) return;
    const stageConf = card.stageLaborConfig?.[stageKey];
    if (
      stageConf !== undefined &&
      stageConf.enabled &&
      stageConf.perUnit != null &&
      Number.isFinite(Number(stageConf.perUnit)) &&
      Number(stageConf.perUnit) > 0
    ) {
      setPerUnit(String(stageConf.perUnit));
    } else {
      // Siempre en blanco/limpio para cada nueva capa individual
      setPerUnit("");
    }
  }, [open, card, stageKey]);

  const quantity = Number(card?.quantity) || 1;
  const numPerUnit = Number(perUnit) || 0;
  const totalEstimado = numPerUnit > 0 ? quantity * numPerUnit : 0;

  const handleSave = () => {
    const parsed = Number(perUnit);
    const validPerUnit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    onSave({
      enabled: validPerUnit != null && validPerUnit > 0,
      perUnit: validPerUnit,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-red-600" />
            Costo de mano de obra · {stageLabel}
          </DialogTitle>
          {card ? (
            <p className="text-xs text-muted-foreground">
              ORD-{card.orderId ? String(card.orderId).slice(0, 3) : "—"} · {card.customerName} ({quantity} uds)
            </p>
          ) : null}
        </DialogHeader>

        <div className="py-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="perUnitInput" className="text-xs text-muted-foreground font-medium">
                  Costo por unidad
                </Label>
                <div className="relative">
                  <Input
                    id="perUnitInput"
                    type="number"
                    min="0"
                    step="100"
                    value={perUnit}
                    onChange={(e) => setPerUnit(e.target.value)}
                    placeholder="0"
                    className="h-10 bg-background text-sm tabular-nums"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <p className="text-xs text-muted-foreground font-medium">Total estimado</p>
                <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 min-h-[40px] flex items-center">
                  {formatMoneyCop(totalEstimado)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={handleSave}
            disabled={saving}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
