import { cn } from "@/lib/utils";

type StatusType =
  | "draft" | "sent" | "approved" | "rejected"
  | "pending" | "in_production" | "delivered"
  | "design" | "cutting" | "sewing" | "embroidery" | "quality" | "printing" | "dispatch";

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
};

export function StatusBadge({ status }: { status: StatusType }) {
  const config = statusConfig[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", config.className)}>
      {config.label}
    </span>
  );
}
