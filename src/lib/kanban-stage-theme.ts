/**
 * Colores de capas alineados con el tablero Kanban (Production).
 * bar ≈ borde superior; header ≈ fondo suave de columna.
 */
export type KanbanStageTheme = {
  id: string;
  bar: string;
  header: string;
  column: string;
  /** Clases para chips/badges */
  chip: string;
  /** Panel de detalle (fondo + borde) */
  softPanel: string;
  /** Texto de título en paneles */
  softText: string;
};

export const KANBAN_STAGE_THEMES_BY_KEY: Record<string, KanbanStageTheme> = {
  design: {
    id: "design",
    bar: "bg-[#9EB6C8]",
    header: "bg-[#F4F7F9]",
    column: "bg-[#F7F9FB]",
    chip: "bg-[#F4F7F9] text-[#4A6578] border-[#9EB6C8]",
    softPanel: "bg-[#F4F7F9]/90 border-[#9EB6C8]/70",
    softText: "text-[#4A6578]",
  },
  cutting: {
    id: "cutting",
    bar: "bg-[#D4B59A]",
    header: "bg-[#FAF6F2]",
    column: "bg-[#FBF8F5]",
    chip: "bg-[#FAF6F2] text-[#8A6A4A] border-[#D4B59A]",
    softPanel: "bg-[#FAF6F2]/90 border-[#D4B59A]/70",
    softText: "text-[#8A6A4A]",
  },
  sewing: {
    id: "sewing",
    bar: "bg-[#A8BFA3]",
    header: "bg-[#F4F7F3]",
    column: "bg-[#F7FAF6]",
    chip: "bg-[#F4F7F3] text-[#4F6B4A] border-[#A8BFA3]",
    softPanel: "bg-[#F4F7F3]/90 border-[#A8BFA3]/70",
    softText: "text-[#4F6B4A]",
  },
  embroidery: {
    id: "embroidery",
    bar: "bg-[#B7A8C9]",
    header: "bg-[#F6F4F9]",
    column: "bg-[#F9F7FB]",
    chip: "bg-[#F6F4F9] text-[#6B5A82] border-[#B7A8C9]",
    softPanel: "bg-[#F6F4F9]/90 border-[#B7A8C9]/70",
    softText: "text-[#6B5A82]",
  },
  quality: {
    id: "quality",
    bar: "bg-[#8FBFB5]",
    header: "bg-[#F2F8F6]",
    column: "bg-[#F5FAF8]",
    chip: "bg-[#F2F8F6] text-[#3D6F66] border-[#8FBFB5]",
    softPanel: "bg-[#F2F8F6]/90 border-[#8FBFB5]/70",
    softText: "text-[#3D6F66]",
  },
  printing: {
    id: "printing",
    bar: "bg-[#C9A8A8]",
    header: "bg-[#F9F4F4]",
    column: "bg-[#FBF7F7]",
    chip: "bg-[#F9F4F4] text-[#7A5555] border-[#C9A8A8]",
    softPanel: "bg-[#F9F4F4]/90 border-[#C9A8A8]/70",
    softText: "text-[#7A5555]",
  },
  dispatch: {
    id: "dispatch",
    bar: "bg-[#A8B0B8]",
    header: "bg-[#F5F6F7]",
    column: "bg-[#F8F9FA]",
    chip: "bg-[#F5F6F7] text-[#4F5963] border-[#A8B0B8]",
    softPanel: "bg-[#F5F6F7]/90 border-[#A8B0B8]/70",
    softText: "text-[#4F5963]",
  },
};

const LABEL_TO_KEY: Record<string, string> = {
  diseño: "design",
  diseno: "design",
  design: "design",
  corte: "cutting",
  cutting: "cutting",
  costura: "sewing",
  confección: "sewing",
  confeccion: "sewing",
  sewing: "sewing",
  bordado: "embroidery",
  embroidery: "embroidery",
  calidad: "quality",
  quality: "quality",
  estampado: "printing",
  printing: "printing",
  despacho: "dispatch",
  dispatch: "dispatch",
  empaque: "dispatch",
};

export function resolveKanbanStageKey(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (KANBAN_STAGE_THEMES_BY_KEY[s]) return s;
  return LABEL_TO_KEY[s] || null;
}

export function getKanbanStageTheme(raw?: string | null): KanbanStageTheme | null {
  const key = resolveKanbanStageKey(raw);
  if (key && KANBAN_STAGE_THEMES_BY_KEY[key]) {
    return KANBAN_STAGE_THEMES_BY_KEY[key];
  }
  return null;
}

/** Clases Tailwind para chip de capa (mismo look que Kanban). */
export function getKanbanStageChipClass(raw?: string | null): string {
  const theme = getKanbanStageTheme(raw);
  if (theme) return theme.chip;
  return "bg-muted text-muted-foreground border-border";
}

/** Panel suave de capa (listados / detalle expandido). */
export function getKanbanStageSoftPanelClass(
  raw?: string | null,
  emphasized = false
): string {
  const theme = getKanbanStageTheme(raw);
  if (!theme) {
    return emphasized
      ? "bg-muted/40 border-border ring-1 ring-border/50"
      : "bg-muted/20 border-border";
  }
  return emphasized
    ? `${theme.softPanel} ring-1 ring-black/5`
    : theme.softPanel;
}

export function getKanbanStageSoftTextClass(raw?: string | null): string {
  const theme = getKanbanStageTheme(raw);
  return theme?.softText || "text-foreground";
}
