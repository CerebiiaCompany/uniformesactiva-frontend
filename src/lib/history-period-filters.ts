/** Filtros de periodo / pago para historial por pedido (paneles satélite y producción). */

export type HistoryPaymentFilter = "todos" | "paid" | "pending";

export type HistoryPeriodOption = {
  value: string;
  label: string;
};

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Meses recientes + "Todos". Por defecto el primero tras "Todos" suele ser el mes actual. */
export function buildHistoryPeriodOptions(now = new Date(), monthsBack = 11): HistoryPeriodOption[] {
  const options: HistoryPeriodOption[] = [{ value: "all", label: "Todos los periodos" }];
  for (let i = 0; i <= monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
    const pretty = label.charAt(0).toUpperCase() + label.slice(1);
    options.push({
      value,
      label: i === 0 ? `${pretty} (actual)` : pretty,
    });
  }
  options.push({ value: "year", label: `Año ${now.getFullYear()}` });
  options.push({ value: "last3", label: "Últimos 3 meses" });
  return options;
}

function toYearMonth(isoDate: string | null | undefined, fallbackToday = true): string | null {
  const raw = (isoDate || "").toString().slice(0, 10);
  if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
  if (!fallbackToday) return null;
  return currentMonthKey();
}

export function matchesHistoryPeriod(
  periodDate: string | null | undefined,
  period: string,
  now = new Date()
): boolean {
  if (!period || period === "all") return true;

  const ym = toYearMonth(periodDate, true);
  if (!ym) return true;

  if (period === "year") {
    return ym.startsWith(String(now.getFullYear()));
  }

  if (period === "last3") {
    const [y, m] = ym.split("-").map(Number);
    const item = new Date(y, m - 1, 1);
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return item >= start && item <= end;
  }

  // YYYY-MM concreto
  return ym === period;
}

export function matchesHistoryPayment(
  paymentStatus: "pending" | "paid" | string | undefined,
  filter: HistoryPaymentFilter
): boolean {
  if (filter === "todos") return true;
  if (filter === "paid") return paymentStatus === "paid";
  return paymentStatus !== "paid";
}
