import { cn } from "@/lib/utils";

export type StatusType =
  | "draft" | "sent" | "approved" | "rejected"
  | "pending" | "in_production" | "delivered"
  | "design" | "cutting" | "sewing" | "embroidery" | "quality" | "printing" | "dispatch"
  | "inactive"
  | "in_review"
  | "ordered";

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "bg-muted text-muted-foreground" },
  sent: { label: "Enviada", className: "bg-info/15 text-info" },
  approved: { label: "Aprobada", className: "bg-success/15 text-success" },
  rejected: { label: "Rechazada", className: "bg-destructive/15 text-destructive" },
  pending: { label: "Pendiente", className: "bg-warning/15 text-warning" },
  in_production: { label: "En producción", className: "bg-info/15 text-info" },
  delivered: { label: "Entregado", className: "bg-success/15 text-success" },
  design: { label: "Diseño", className: "bg-info/15 text-info" },
  cutting: { label: "Corte", className: "bg-warning/15 text-warning" },
  sewing: { label: "Confección", className: "bg-accent/15 text-accent" },
  embroidery: { label: "Bordado", className: "bg-primary/15 text-primary" },
  quality: { label: "Calidad", className: "bg-success/15 text-success" },
  printing: { label: "Estampado", className: "bg-warning/15 text-warning" },
  dispatch: { label: "Despacho", className: "bg-muted text-muted-foreground" },
  inactive: { label: "Inactiva", className: "bg-gray-100 text-gray-500 border border-gray-200" },
  in_review: { label: "En revisión", className: "bg-yellow-100 text-yellow-800 border border-yellow-200" },
  ordered: { label: "Ordenado", className: "bg-green-100 text-green-800 border border-green-200" },
};

/** Estados largos: se parten en 2 líneas para no aplastar la columna */
const multilineLabels: Partial<Record<StatusType, [string, string]>> = {
  in_production: ["En", "producción"],
  in_review: ["En", "revisión"],
};

interface StatusBadgeProps {
  status: StatusType;
  /** Compacta el badge (útil en tablas densas) */
  compact?: boolean;
}

export function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  const lines = multilineLabels[status];

  if (compact && lines) {
    return (
      <span
        className={cn(
          "inline-flex flex-col items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold leading-[1.2] text-center min-w-[5.25rem]",
          config.className
        )}
      >
        <span>{lines[0]}</span>
        <span>{lines[1]}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap",
        compact ? "text-xs px-2.5 py-1 leading-tight" : "text-xs px-2.5 py-1",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
