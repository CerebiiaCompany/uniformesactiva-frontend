import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getKanbanStageChipClass } from "@/lib/kanban-stage-theme";

type KanbanStageChipProps = {
  label: string;
  /** Key Kanban (design, cutting…) o label; se resuelve al color del tablero */
  stageKey?: string | null;
  className?: string;
  title?: string;
  children?: ReactNode;
};

/** Chip de capa con la misma paleta pastel del Kanban. */
export function KanbanStageChip({
  label,
  stageKey,
  className,
  title,
  children,
}: KanbanStageChipProps) {
  if (!label) return null;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        getKanbanStageChipClass(stageKey || label),
        className
      )}
    >
      {label}
      {children}
    </span>
  );
}
