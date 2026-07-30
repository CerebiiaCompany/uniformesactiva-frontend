import { useCallback, useState } from "react";
import { http, HttpError } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export interface KanbanEtapa {
  id: string;
  key: string;
  label: string;
  color_class: string;
  orden: number;
  is_system: boolean;
  activo: boolean;
}

function resolveError(err: unknown, fallback: string) {
  if (err instanceof HttpError && err.message?.trim()) return err.message;
  if (err instanceof Error && err.message?.trim()) return err.message;
  return fallback;
}

export function useKanbanEtapas() {
  const [etapas, setEtapas] = useState<KanbanEtapa[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEtapas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await http<KanbanEtapa[]>(endpoints.orders.kanbanEtapas());
      setEtapas(Array.isArray(data) ? data : []);
      return data;
    } catch (err) {
      const msg = resolveError(err, "Error al cargar etapas del Kanban");
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createEtapa = useCallback(
    async (payload: { label: string; color_class?: string; key?: string }) => {
      try {
        const created = await http<KanbanEtapa>(endpoints.orders.kanbanEtapas(), {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setEtapas((prev) => [...prev, created].sort((a, b) => a.orden - b.orden));
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
      try {
        const updated = await http<KanbanEtapa>(
          endpoints.orders.kanbanEtapa(etapaId),
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );
        setEtapas((prev) =>
          prev
            .map((e) => (e.id === etapaId ? updated : e))
            .sort((a, b) => a.orden - b.orden)
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
    try {
      await http(endpoints.orders.kanbanEtapa(etapaId), { method: "DELETE" });
      setEtapas((prev) => prev.filter((e) => e.id !== etapaId));
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
      try {
        const data = await http<KanbanEtapa[]>(endpoints.orders.kanbanEtapasReorder(), {
          method: "PATCH",
          body: JSON.stringify({ items: ordered }),
        });
        setEtapas(Array.isArray(data) ? data : []);
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
