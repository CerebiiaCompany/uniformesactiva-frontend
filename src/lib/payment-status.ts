/**
 * Resolución de estado de pago para listados y detalle.
 * - SI / pagado: pago total registrado con evidencia (quién/cuándo/medio o abono cerrado).
 * - PARCIAL: abono registrado con evidencia (no cubre el total).
 * - NO: sin pago real o flags inconsistentes (p.ej. pagado=true sin detalle).
 */

export type PaymentStatus = "pagado" | "parcial" | "no_pagado";

export type PaymentDetalleLike = {
  medio_pago?: string | null;
  fecha_registro?: string | null;
  registrado_por_nombre?: string | null;
  monto_abono?: number | string | null;
  monto_total?: number | string | null;
  saldo_pendiente?: number | string | null;
  abono_detalle?: {
    medio_pago?: string | null;
    fecha_registro?: string | null;
    registrado_por_nombre?: string | null;
    monto_abono?: number | string | null;
    saldo_pendiente?: number | string | null;
  } | null;
} | null | undefined;

export type PaymentSubjectLike = {
  estado_pago?: string | null;
  pagado?: boolean | null;
  detalle_abono?: PaymentDetalleLike;
  valor_venta_proyectado?: number | string | null;
};

function hasText(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function asAmount(v: unknown): number {
  if (v == null || v === "") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Evidencia de que el pago/abono fue realmente registrado (no solo un flag). */
export function hasPaymentRegistrationEvidence(detalle: PaymentDetalleLike): boolean {
  if (!detalle || typeof detalle !== "object") return false;
  const snap = detalle.abono_detalle;
  return Boolean(
    hasText(detalle.medio_pago) ||
      hasText(detalle.fecha_registro) ||
      hasText(detalle.registrado_por_nombre) ||
      hasText(snap?.medio_pago) ||
      hasText(snap?.fecha_registro) ||
      hasText(snap?.registrado_por_nombre) ||
      (detalle.monto_abono != null && Number(detalle.monto_abono) > 0) ||
      (snap?.monto_abono != null && Number(snap.monto_abono) > 0)
  );
}

/**
 * Estado efectivo para UI / negocio.
 * SI solo con totalidad + evidencia; PARCIAL solo con abonos + evidencia.
 */
export function resolveEffectivePaymentStatus(entity: PaymentSubjectLike): PaymentStatus {
  const detalle = entity.detalle_abono;
  if (!hasPaymentRegistrationEvidence(detalle)) {
    return "no_pagado";
  }

  const raw = String(entity.estado_pago || "")
    .trim()
    .toLowerCase();
  const sale =
    asAmount(entity.valor_venta_proyectado) ||
    asAmount(detalle?.monto_total) ||
    0;
  const abono = asAmount(detalle?.monto_abono ?? detalle?.abono_detalle?.monto_abono);
  const saldo = asAmount(detalle?.saldo_pendiente);

  // Pago total marcado con evidencia (tras abono o directo)
  if (raw === "pagado" || entity.pagado) {
    // Inconsistencia: "pagado" pero el detalle solo refleja un abono abierto
    const onlyOpenPartial =
      Number.isFinite(saldo) &&
      saldo > 0 &&
      Number.isFinite(abono) &&
      abono > 0 &&
      sale > 0 &&
      abono + 0.009 < sale &&
      !detalle?.abono_detalle;
    if (onlyOpenPartial) {
      return "parcial";
    }
    return "pagado";
  }

  if (raw === "parcial") {
    return "parcial";
  }

  // Sin estado_pago claro: inferir por montos
  if (Number.isFinite(abono) && abono > 0 && sale > 0) {
    if (abono + 0.009 >= sale) return "pagado";
    return "parcial";
  }

  return "no_pagado";
}

export type PaymentBadgeKind = "si" | "parcial" | "no";

export function resolvePaymentBadge(entity: PaymentSubjectLike): PaymentBadgeKind {
  const status = resolveEffectivePaymentStatus(entity);
  if (status === "pagado") return "si";
  if (status === "parcial") return "parcial";
  return "no";
}

export function paymentBadgeLabel(kind: PaymentBadgeKind): string {
  if (kind === "si") return "SI";
  if (kind === "parcial") return "PARCIAL";
  return "NO";
}
