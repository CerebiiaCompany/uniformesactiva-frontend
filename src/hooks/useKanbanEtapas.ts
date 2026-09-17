import { useCallback, useState } from "react";
import { http, HttpError } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { isDispatchStageKey } from "@/lib/dispatch-module";

export interface KanbanEtapa {
  id: string;
  key: string;
  label: string;
  color_class: string;
  orden: number;
  is_system: boolean;
  activo: boolean;
}

export const DEFAULT_KANBAN_ETAPAS: KanbanEtapa[] = [
  { id: "stage-design", key: "design", label: "Diseño", color_class: "design", orden: 0, is_system: true, activo: true },
  { id: "stage-cutting", key: "cutting", label: "Corte", color_class: "cutting", orden: 1, is_system: true, activo: true },
  { id: "stage-sewing", key: "sewing", label: "Confección", color_class: "sewing", orden: 2, is_system: true, activo: true },
  { id: "stage-embroidery", key: "embroidery", label: "Bordado", color_class: "embroidery", orden: 3, is_system: true, activo: true },
  { id: "stage-printing", key: "printing", label: "Estampado", color_class: "printing", orden: 4, is_system: true, activo: true },
  { id: "stage-quality", key: "quality", label: "Calidad", color_class: "quality", orden: 5, is_system: true, activo: true },
  { id: "stage-dispatch", key: "dispatch", label: "Para Despacho", color_class: "dispatch", orden: 6, is_system: true, activo: true },
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedKanbanEtapaId(id: string | null | undefined): boolean {
  return UUID_RE.test(String(id || "").trim());
}

/** Deja «Para Despacho» siempre al final sin cambiar keys. */
export function pinDispatchStageLast<T extends { key: string }>(list: T[]): T[] {
  const movable = list.filter((e) => !isDispatchStageKey(e.key));
  const fixed = list.filter((e) => isDispatchStageKey(e.key));
  return [...movable, ...fixed];
}

function resolveError(err: unknown, fallback: string) {
  if (err instanceof HttpError && err.message?.trim()) return err.message;
  if (err instanceof Error && err.message?.trim()) return err.message;
  return fallback;
}

export function useKanbanEtapas() {
  const [etapas, setEtapas] = useState<KanbanEtapa[]>(DEFAULT_KANBAN_ETAPAS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEtapas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await http<KanbanEtapa[]>(endpoints.orders.kanbanEtapas());
      // Solo usar defaults locales si la API no devolvió nada (evitar IDs fake en reorder)
      const list =
        Array.isArray(data) && data.length > 0
          ? pinDispatchStageLast(
              [...data].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
            ).map((e, i) => ({ ...e, orden: i }))
          : DEFAULT_KANBAN_ETAPAS;
      setEtapas(list);
      return list;
    } catch (err) {
      const msg = resolveError(err, "Error al cargar etapas del Kanban");
      setError(msg);
      setEtapas(DEFAULT_KANBAN_ETAPAS);
      return DEFAULT_KANBAN_ETAPAS;
    } finally {
      setLoading(false);
    }
  }, []);

  const createEtapa = useCallback(
    async (payload: {
      label: string;
      color_class?: string;
      key?: string;
      orden?: number;
      insert_before_key?: string;
      insert_after_key?: string;
    }) => {
      try {
        const created = await http<KanbanEtapa>(endpoints.orders.kanbanEtapas(), {
          method: "POST",
          body: JSON.stringify(payload),
        });
        // Refrescar lista completa para respetar orden normalizado en BD
        const refreshed = await http<KanbanEtapa[]>(endpoints.orders.kanbanEtapas());
        if (Array.isArray(refreshed) && refreshed.length) {
          setEtapas(
            pinDispatchStageLast(
              [...refreshed].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
            ).map((e, i) => ({ ...e, orden: i }))
          );
        } else {
          setEtapas((prev) =>
            pinDispatchStageLast([...prev, created]).map((e, i) => ({
              ...e,
              orden: i,
            }))
          );
        }
        return { etapa: created, errorMessage: null as string | null };
      } catch (err) {
        return {
          etapa: null,
          errorMessage: resolveError(err, "Error al crear el tablero"),
        };
      }
    },
    []
  );

  const updateEtapa = useCallback(
    async (
      etapaId: string,
      payload: { label?: string; color_class?: string; orden?: number }
    ) => {
      if (!isPersistedKanbanEtapaId(etapaId)) {
        return {
          etapa: null,
          errorMessage:
            "El tablero aún no está sincronizado. Recarga e inténtalo de nuevo.",
        };
      }
      try {
        const updated = await http<KanbanEtapa>(
          endpoints.orders.kanbanEtapa(etapaId),
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );
        setEtapas((prev) =>
          pinDispatchStageLast(
            prev.map((e) => (e.id === etapaId ? updated : e))
          ).map((e, i) => ({ ...e, orden: i }))
        );
        return { etapa: updated, errorMessage: null as string | null };
      } catch (err) {
        return {
          etapa: null,
          errorMessage: resolveError(err, "Error al actualizar el tablero"),
        };
      }
    },
    []
  );

  const deleteEtapa = useCallback(async (etapaId: string) => {
    if (!isPersistedKanbanEtapaId(etapaId)) {
      return {
        ok: false,
        errorMessage:
          "El tablero aún no está sincronizado. Recarga e inténtalo de nuevo.",
      };
    }
    try {
      await http(endpoints.orders.kanbanEtapa(etapaId), { method: "DELETE" });
      setEtapas((prev) =>
        pinDispatchStageLast(prev.filter((e) => e.id !== etapaId)).map((e, i) => ({
          ...e,
          orden: i,
        }))
      );
      return { ok: true, errorMessage: null as string | null };
    } catch (err) {
      return {
        ok: false,
        errorMessage: resolveError(err, "Error al eliminar el tablero"),
      };
    }
  }, []);

  const reorderEtapas = useCallback(
    async (ordered: { id: string; orden: number }[]) => {
      const items = ordered.filter((item) => isPersistedKanbanEtapaId(item.id));
      if (!items.length) {
        return {
          ok: false,
          errorMessage:
            "No hay tableros válidos para reordenar. Recarga el Kanban e inténtalo de nuevo.",
        };
      }
      try {
        const data = await http<KanbanEtapa[]>(endpoints.orders.kanbanEtapasReorder(), {
          method: "PATCH",
          body: JSON.stringify({ items }),
        });
        const list = Array.isArray(data)
          ? pinDispatchStageLast(
              [...data].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
            ).map((e, i) => ({ ...e, orden: i }))
          : [];
        setEtapas(list);
        return { ok: true, errorMessage: null as string | null };
      } catch (err) {
        return {
          ok: false,
          errorMessage: resolveError(err, "Error al reordenar tableros"),
        };
      }
    },
    []
  );

  return {
    etapas,
    loading,
    error,
    fetchEtapas,
    createEtapa,
    updateEtapa,
    deleteEtapa,
    reorderEtapas,
    setEtapas,
  };
}
