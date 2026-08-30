import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, CreditCard, Loader2, Lock } from "lucide-react";
import { formatCurrency } from "@/lib/format-number";

function formatNumberWithDots(val: string | number): string {
  if (val === "" || val == null) return "";
  const digitsOnly = String(val).replace(/\D/g, "");
  if (!digitsOnly) return "";
  return new Intl.NumberFormat("es-CO").format(Number(digitsOnly));
}

function parseRawNumber(val: string): string {
  return val.replace(/\D/g, "");
}

type PaymentStatus = "pagado" | "parcial" | "no_pagado";

export interface DetalleAbonoPayload {
  monto_total?: number;
  monto_abono?: number;
  saldo_pendiente?: number;
  medio_pago: string;
  concepto?: string;
  fecha_limite_saldo?: string;
  registrado_por_id?: string;
  registrado_por_nombre?: string;
  fecha_registro?: string;
  abono_detalle?: {
    monto_total?: number;
    monto_abono?: number;
    saldo_pendiente?: number;
    medio_pago?: string;
    concepto?: string;
    fecha_limite_saldo?: string;
    registrado_por_id?: string;
    registrado_por_nombre?: string;
    fecha_registro?: string;
  };
}

/** Forma mínima compartida por órdenes y cotizaciones. */
export interface PaymentDetailSubject {
  id: string;
  cliente_nombre: string;
  estado_pago?: PaymentStatus;
  pagado?: boolean;
  detalle_abono?: Partial<DetalleAbonoPayload> | null;
  valor_venta_proyectado?: string | number | null;
}

interface OrderPaymentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** @deprecated Prefer `subject`. Se mantiene por compatibilidad con órdenes. */
  order?: PaymentDetailSubject | null;
  subject?: PaymentDetailSubject | null;
  entityNoun?: "orden" | "cotización";
  idPrefix?: string;
  onUpdatePayment: (
    id: string,
    payload: {
      estado_pago: PaymentStatus;
      detalle_abono?: DetalleAbonoPayload | null;
    }
  ) => Promise<{
    subject?: PaymentDetailSubject | null;
    order?: PaymentDetailSubject | null;
    errorMessage: string | null;
  }>;
  onUpdated?: (subject: PaymentDetailSubject) => void;
}

const MEDIO_PAGO_OPTIONS = [
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta de crédito/débito" },
  { value: "cheque", label: "Cheque" },
];

const MEDIO_PAGO_LABELS: Record<string, string> = Object.fromEntries(
  MEDIO_PAGO_OPTIONS.map((o) => [o.value, o.label])
);

function formatMoney(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === "") return "—";
  return `$${formatCurrency(value)}`;
}

function formatDateTime(iso: string | undefined | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function formatDateOnly(value: string | undefined | null) {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-CO");
}

function medioLabel(value: string | undefined | null) {
  if (!value) return "—";
  return MEDIO_PAGO_LABELS[value] || value;
}

function resolvePaymentStatus(entity: PaymentDetailSubject): PaymentStatus {
  if (entity.estado_pago === "parcial") return "parcial";
  if (entity.estado_pago === "pagado" || entity.pagado) return "pagado";
  return "no_pagado";
}

function getShortId(id: string, prefix: string) {
  return `${prefix}-${id.slice(-3).toUpperCase()}`;
}

export function OrderPaymentDetailDialog({
  open,
  onOpenChange,
  order,
  subject,
  entityNoun = "orden",
  idPrefix = "ORD",
  onUpdatePayment,
  onUpdated,
}: OrderPaymentDetailDialogProps) {
  const initial = subject ?? order ?? null;
  const [targetStatus, setTargetStatus] = useState<"" | PaymentStatus>("");
  const [abonoAmountRaw, setAbonoAmountRaw] = useState("");
  const [medioPago, setMedioPago] = useState("");
  const [conceptoAbono, setConceptoAbono] = useState("");
  const [fechaLimiteSaldo, setFechaLimiteSaldo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localSubject, setLocalSubject] = useState<PaymentDetailSubject | null>(initial);
  /** Flujo parcial → pagado: pide medio antes de confirmar. */
  const [confirmingPaidFromPartial, setConfirmingPaidFromPartial] = useState(false);
  const [enrichingAudit, setEnrichingAudit] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLocalSubject(initial);
    setTargetStatus("");
    setAbonoAmountRaw("");
    setMedioPago("");
    setConceptoAbono("");
    setFechaLimiteSaldo("");
    setError(null);
    setSaving(false);
    setConfirmingPaidFromPartial(false);
    setEnrichingAudit(false);
  }, [open, initial]);

  // Completa auditoría faltante en pagos ya cerrados (datos viejos o migrados)
  useEffect(() => {
    if (!open || !initial) return;
    const status = resolvePaymentStatus(initial);
    if (status !== "pagado") return;
    const d = initial.detalle_abono || {};
    if (d.registrado_por_nombre && d.fecha_registro) return;
    if (!d.medio_pago) return;

    let cancelled = false;
    setEnrichingAudit(true);
    (async () => {
      const result = await onUpdatePayment(initial.id, {
        estado_pago: "pagado",
        detalle_abono: { medio_pago: d.medio_pago },
      });
      if (cancelled) return;
      setEnrichingAudit(false);
      const updated = result.subject ?? result.order;
      if (updated) {
        setLocalSubject(updated);
        onUpdated?.(updated);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Solo al abrir / cambiar de registro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const current = localSubject || initial;
  const status = current ? resolvePaymentStatus(current) : "no_pagado";
  const abono = current?.detalle_abono || {};
  const saleValue = Number(current?.valor_venta_proyectado || 0);
  const abonoAmount = Number(abonoAmountRaw) || 0;
  const saldoPendiente = Math.max(0, Math.round((saleValue - abonoAmount) * 100) / 100);

  const showPartialForm = targetStatus === "parcial";

  const canSavePartial = useMemo(() => {
    return (
      abonoAmount > 0 &&
      abonoAmount < saleValue &&
      Boolean(medioPago) &&
      Boolean(conceptoAbono.trim()) &&
      Boolean(fechaLimiteSaldo)
    );
  }, [abonoAmount, saleValue, medioPago, conceptoAbono, fechaLimiteSaldo]);

  if (!current) return null;

  const resetFormFields = () => {
    setTargetStatus("");
    setAbonoAmountRaw("");
    setMedioPago("");
    setConceptoAbono("");
    setFechaLimiteSaldo("");
    setConfirmingPaidFromPartial(false);
  };

  const applyUpdate = async (payload: {
    estado_pago: PaymentStatus;
    detalle_abono?: DetalleAbonoPayload | null;
  }) => {
    setSaving(true);
    setError(null);
    const result = await onUpdatePayment(current.id, payload);
    setSaving(false);
    const updated = result.subject ?? result.order;
    if (!updated) {
      setError(result.errorMessage || "No se pudo actualizar el pago.");
      return;
    }
    setLocalSubject(updated);
    onUpdated?.(updated);
    resetFormFields();
  };

  const getLoggedUserAudit = () => {
    let loggedUser: any = null;
    try {
      const raw = localStorage.getItem("user");
      if (raw) loggedUser = JSON.parse(raw);
    } catch {
      // ignore
    }
    const id = loggedUser?.id ? String(loggedUser.id) : "";
    const nombre =
      `${loggedUser?.first_name || ""} ${loggedUser?.last_name || ""}`.trim() ||
      loggedUser?.username ||
      (current as any).tomada_por ||
      "";
    const fecha = new Date().toISOString();
    return { id, nombre, fecha };
  };

  const handleConfirmPaid = async () => {
    if (!medioPago) {
      setError("Indica el medio de pago.");
      return;
    }
    const audit = getLoggedUserAudit();
    const prev = current.detalle_abono;
    const hasPreviousPartial = Boolean(prev?.monto_abono || prev?.saldo_pendiente);

    await applyUpdate({
      estado_pago: "pagado",
      detalle_abono: {
        medio_pago: medioPago,
        registrado_por_id: audit.id,
        registrado_por_nombre: audit.nombre,
        fecha_registro: audit.fecha,
        ...(hasPreviousPartial
          ? {
              abono_detalle: {
                monto_abono: prev?.monto_abono,
                saldo_pendiente: prev?.saldo_pendiente,
                medio_pago: prev?.medio_pago,
                concepto: prev?.concepto,
                fecha_limite_saldo: prev?.fecha_limite_saldo,
                registrado_por_id: prev?.registrado_por_id,
                registrado_por_nombre: prev?.registrado_por_nombre,
                fecha_registro: prev?.fecha_registro,
              },
            }
          : {}),
      },
    });
  };

  const handleSaveFromSelect = async () => {
    if (!targetStatus) return;

    if (targetStatus === "pagado") {
      await handleConfirmPaid();
      return;
    }

    if (targetStatus === "no_pagado") {
      await applyUpdate({ estado_pago: "no_pagado", detalle_abono: null });
      return;
    }

    if (!saleValue || saleValue <= 0) {
      setError(`La ${entityNoun} no tiene valor de venta para calcular el abono.`);
      return;
    }
    if (!canSavePartial) {
      setError("Completa todos los campos del abono.");
      return;
    }

    const audit = getLoggedUserAudit();
    await applyUpdate({
      estado_pago: "parcial",
      detalle_abono: {
        monto_total: saleValue,
        monto_abono: abonoAmount,
        saldo_pendiente: saldoPendiente,
        medio_pago: medioPago,
        concepto: conceptoAbono.trim(),
        fecha_limite_saldo: fechaLimiteSaldo,
        registrado_por_id: audit.id,
        registrado_por_nombre: audit.nombre,
        fecha_registro: audit.fecha,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Detalle de pago
            <span className="font-normal text-muted-foreground text-sm">
              — {getShortId(current.id, idPrefix)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Estado de pago
              </p>
              <p className="text-sm font-semibold mt-0.5">{current.cliente_nombre}</p>
            </div>
            <Badge
              variant="secondary"
              className={
                status === "pagado"
                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                  : status === "parcial"
                    ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                    : "bg-red-100 text-red-800 hover:bg-red-100"
              }
            >
              {status === "pagado"
                ? "Pagado"
                : status === "parcial"
                  ? "Pagado parcial"
                  : "No pagado"}
            </Badge>
          </div>

          {status === "no_pagado" && (
            <div className="rounded-lg border border-dashed px-4 py-5 text-center space-y-1">
              <CreditCard className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">Sin pagos registrados</p>
              <p className="text-xs text-muted-foreground">
                Esta {entityNoun} aún no tiene abonos ni pago completo.
              </p>
              <p className="text-xs text-muted-foreground pt-2">
                Valor de venta:{" "}
                <span className="tabular-nums text-foreground">
                  {formatMoney(saleValue)}
                </span>
              </p>
            </div>
          )}

          {status === "pagado" && (() => {
            const totalDeuda = Number(abono.monto_total ?? saleValue) || saleValue;
            const snap = abono.abono_detalle;
            const hadPartial =
              Boolean(snap?.monto_abono) ||
              (abono.monto_abono != null &&
                Number(abono.monto_abono) > 0 &&
                Number(abono.monto_abono) < totalDeuda);
            const abonoMonto = Number(snap?.monto_abono ?? abono.monto_abono) || 0;
            const saldoTrasAbono =
              Number(
                snap?.saldo_pendiente ??
                  abono.saldo_pendiente ??
                  Math.max(0, totalDeuda - abonoMonto)
              ) || 0;
            const montoPagoFinal = hadPartial
              ? saldoTrasAbono > 0
                ? saldoTrasAbono
                : Math.max(0, totalDeuda - abonoMonto)
              : totalDeuda;

            return (
              <div className="space-y-4">
                {/* 1. Resumen (solo si hubo abono previo; pago directo solo muestra registro final) */}
                {hadPartial && (
                  <div className="rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-3 space-y-2">
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      Pago completo
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Monto total</span>
                      <span className="tabular-nums">
                        {formatMoney(totalDeuda)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Monto pagado</span>
                      <span className="tabular-nums">
                        {formatMoney(totalDeuda)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Saldo pendiente</span>
                      <span className="tabular-nums">$0</span>
                    </div>
                  </div>
                )}

                {/* 2. Registro de abono (solo si hubo pago parcial previo) */}
                {hadPartial && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Registro de abono
                    </h4>
                    <div className="rounded-lg border divide-y">
                      <DetailRow
                        label="Recibido por"
                        value={snap?.registrado_por_nombre || abono.registrado_por_nombre || "—"}
                      />
                      <DetailRow
                        label="Fecha y hora de abono"
                        value={formatDateTime(snap?.fecha_registro || abono.fecha_registro)}
                      />
                      <DetailRow
                        label="Monto del abono"
                        value={formatMoney(abonoMonto)}
                        emphasize
                      />
                      <DetailRow
                        label="Saldo pendiente"
                        value={formatMoney(saldoTrasAbono)}
                        warn
                      />
                      <DetailRow
                        label="Medio de pago de abono"
                        value={medioLabel(snap?.medio_pago || abono.medio_pago)}
                      />
                      <DetailRow
                        label="Concepto"
                        value={snap?.concepto || abono.concepto || "—"}
                        multiline
                      />
                      <DetailRow
                        label="Fecha límite de pago"
                        value={formatDateOnly(
                          snap?.fecha_limite_saldo || abono.fecha_limite_saldo
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* 3. Registro de pago completado */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Registro de pago completado
                  </h4>
                  <div className="rounded-lg border divide-y">
                    <DetailRow
                      label="Registrado por"
                      value={
                        enrichingAudit
                          ? "Completando..."
                          : abono.registrado_por_nombre || "—"
                      }
                    />
                    <DetailRow
                      label="Fecha y hora del pago"
                      value={
                        enrichingAudit
                          ? "Completando..."
                          : formatDateTime(abono.fecha_registro)
                      }
                    />
                    <DetailRow
                      label="Medio de pago"
                      value={medioLabel(abono.medio_pago)}
                    />
                    {hadPartial && (
                      <DetailRow
                        label="Saldo que estaba pendiente"
                        value={formatMoney(saldoTrasAbono)}
                        warn
                      />
                    )}
                    <DetailRow
                      label="Monto pagado"
                      value={formatMoney(montoPagoFinal)}
                      emphasize
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {status === "parcial" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Registro de abono
                </h4>
                <div className="rounded-lg border divide-y">
                  <DetailRow
                    label="Recibido por"
                    value={abono.registrado_por_nombre || "—"}
                  />
                  <DetailRow
                    label="Fecha y hora de abono"
                    value={formatDateTime(abono.fecha_registro)}
                  />
                  <DetailRow
                    label="Monto del abono"
                    value={formatMoney(abono.monto_abono)}
                    emphasize
                  />
                  <DetailRow
                    label="Saldo pendiente"
                    value={formatMoney(
                      abono.saldo_pendiente ??
                        (Number(abono.monto_total ?? saleValue) || 0) -
                          (Number(abono.monto_abono) || 0)
                    )}
                    warn
                  />
                  <DetailRow
                    label="Medio de pago de abono"
                    value={medioLabel(abono.medio_pago)}
                  />
                  <DetailRow
                    label="Concepto"
                    value={abono.concepto || "—"}
                    multiline
                  />
                  <DetailRow
                    label="Fecha límite de pago"
                    value={formatDateOnly(abono.fecha_limite_saldo)}
                  />
                </div>
              </div>
            </div>
          )}

          <Separator />

          {status === "pagado" ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-3 flex items-start gap-2.5 dark:bg-emerald-950/20 dark:border-emerald-900/40">
              <Lock className="h-4 w-4 text-emerald-700/70 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-emerald-800/90 dark:text-emerald-300">
                  Pago cerrado
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  El estado pagado es definitivo. No se puede volver a cambiar.
                </p>
              </div>
            </div>
          ) : (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cambiar estado de pago
            </h4>

            {status === "parcial" && !confirmingPaidFromPartial && (
              <Button
                className="w-full"
                onClick={() => {
                  setConfirmingPaidFromPartial(true);
                  setMedioPago("");
                  setError(null);
                }}
                disabled={saving}
              >
                Marcar como pagado
              </Button>
            )}

            {confirmingPaidFromPartial && (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3 space-y-3 dark:bg-emerald-950/10 dark:border-emerald-900/40">
                <p className="text-xs font-semibold">Confirmar pago del saldo pendiente</p>
                <div className="space-y-1">
                  <Label className="text-[11px]">
                    Medio de pago <span className="text-destructive">*</span>
                  </Label>
                  <Select value={medioPago} onValueChange={setMedioPago}>
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue placeholder="Transferencia, efectivo, tarjeta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MEDIO_PAGO_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Se guardará automáticamente quién registra el pago y la fecha/hora exacta.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={saving}
                    onClick={() => {
                      setConfirmingPaidFromPartial(false);
                      setMedioPago("");
                      setError(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleConfirmPaid}
                    disabled={saving || !medioPago}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      "Confirmar pagado"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {status !== "parcial" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nuevo estado</Label>
                  <Select
                    value={targetStatus || undefined}
                    onValueChange={(v) => {
                      setTargetStatus(v as PaymentStatus);
                      setError(null);
                      setMedioPago("");
                      if (v !== "parcial") {
                        setAbonoAmountRaw("");
                        setConceptoAbono("");
                        setFechaLimiteSaldo("");
                      }
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecciona un estado..." />
                    </SelectTrigger>
                    <SelectContent>
                      {status === "no_pagado" && (
                        <>
                          <SelectItem value="pagado">Pagado</SelectItem>
                          <SelectItem value="parcial">Pagado parcial</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {targetStatus === "pagado" && (
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3 space-y-3 dark:bg-emerald-950/10 dark:border-emerald-900/40">
                    <p className="text-xs font-semibold">Detalle del pago completo</p>
                    <div className="space-y-1">
                      <Label className="text-[11px]">
                        Medio de pago <span className="text-destructive">*</span>
                      </Label>
                      <Select value={medioPago} onValueChange={setMedioPago}>
                        <SelectTrigger className="h-9 bg-background">
                          <SelectValue placeholder="Transferencia, efectivo, tarjeta..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MEDIO_PAGO_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Se guardará automáticamente quién registra el pago y la fecha/hora exacta.
                    </p>
                  </div>
                )}

                {showPartialForm && (
                  <div className="rounded-xl border border-red-200/90 bg-red-50/40 p-3.5 space-y-3 dark:bg-red-950/20 dark:border-red-900/40">
                    <p className="text-xs font-semibold text-red-950 dark:text-red-300">Detalle financiero del abono</p>
                    <div className="grid grid-cols-1 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Monto total de la deuda</Label>
                        <Input readOnly value={formatMoney(saleValue)} className="h-9 bg-muted/50 tabular-nums" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">
                          Monto del abono <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberWithDots(abonoAmountRaw)}
                          onChange={(e) => setAbonoAmountRaw(parseRawNumber(e.target.value))}
                          placeholder="0"
                          className="h-9 tabular-nums"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Saldo pendiente</Label>
                        <Input
                          readOnly
                          value={
                            saleValue > 0 && abonoAmount > 0
                              ? formatMoney(saldoPendiente)
                              : formatMoney(saleValue)
                          }
                          className="h-9 bg-muted/50 tabular-nums text-red-700 dark:text-red-400 font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">
                          Medio de pago <span className="text-destructive">*</span>
                        </Label>
                        <Select value={medioPago} onValueChange={setMedioPago}>
                          <SelectTrigger className="h-9 bg-background">
                            <SelectValue placeholder="Selecciona..." />
                          </SelectTrigger>
                          <SelectContent>
                            {MEDIO_PAGO_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">
                          Concepto <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          value={conceptoAbono}
                          onChange={(e) => setConceptoAbono(e.target.value)}
                          placeholder="Ej. Abono del 50% para inicio"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">
                          Fecha límite del saldo <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="date"
                          value={fechaLimiteSaldo}
                          onChange={(e) => setFechaLimiteSaldo(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Quién recibe el abono y la fecha/hora se registran al guardar.
                      </p>
                    </div>
                  </div>
                )}

                {targetStatus && !confirmingPaidFromPartial && (
                  <Button
                    className={
                      targetStatus === "parcial"
                        ? "w-full bg-red-500 hover:bg-red-600 text-white font-medium shadow-xs transition-colors"
                        : "w-full"
                    }
                    onClick={handleSaveFromSelect}
                    disabled={
                      saving ||
                      (targetStatus === "parcial" && !canSavePartial) ||
                      (targetStatus === "pagado" && !medioPago)
                    }
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : targetStatus === "pagado" ? (
                      "Confirmar pago completo"
                    ) : targetStatus === "no_pagado" ? (
                      "Confirmar no pagado"
                    ) : (
                      "Guardar pago parcial"
                    )}
                  </Button>
                )}
              </>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
  emphasize,
  warn,
  multiline,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  warn?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
      <span className="text-muted-foreground text-xs shrink-0 pt-0.5">{label}</span>
      <span
        className={
          multiline
            ? "text-right text-sm font-medium leading-snug"
            : emphasize
              ? "tabular-nums text-primary font-semibold"
              : warn
                ? "tabular-nums text-red-700 dark:text-red-400 font-semibold"
                : "tabular-nums text-right"
        }
      >
        {value}
      </span>
    </div>
  );
}
