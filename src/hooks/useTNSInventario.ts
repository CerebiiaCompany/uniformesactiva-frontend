import { useState, useEffect, useCallback, useRef } from "react";
import type {
  TNSInventarioItem,
  TNSInventarioSummary,
  TNSInventarioParams,
} from "@/types/tns";
import {
  getAllTNSInventario,
  getTNSInventarioSummary,
} from "@/services/tnsService";
import { HttpError } from "@/lib/http";
import { toast } from "sonner";

function resolveHttpErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpError) return err.message || fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}

export const INITIAL_TNS_PARAMS: TNSInventarioParams = {
  search: "",
  bodega: "TODAS",
  estado: "TODOS",
  stock_status: "todos",
  ordenar_por: "stock_desc",
  page: 1,
  page_size: 5000,
};

export function useTNSInventario(autoFetch = true) {
  const [items, setItems] = useState<TNSInventarioItem[]>([]);
  const [summary, setSummary] = useState<TNSInventarioSummary | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [params, setParams] = useState<TNSInventarioParams>(INITIAL_TNS_PARAMS);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Referencia para cancelar llamadas obsoletas en caso de debounce
  const fetchCountRef = useRef(0);

  // Carga de la lista completa de productos de TNS
  const fetchItems = useCallback(
    async (queryParams: TNSInventarioParams, isForceRefresh = false) => {
      const currentCallId = ++fetchCountRef.current;
      setLoading(true);
      setError(null);

      try {
        const res = await getAllTNSInventario({
          ...queryParams,
          force_refresh: isForceRefresh,
        });

        if (currentCallId === fetchCountRef.current) {
          setItems(res.data || []);
          setTotalCount(res.total_count || res.data?.length || 0);
          setTotalPages(1);
          setLastUpdated(new Date());
          
          if (res.summary && !summary) {
            setSummary(res.summary);
          }
        }
      } catch (err) {
        if (currentCallId === fetchCountRef.current) {
          const msg = resolveHttpErrorMessage(
            err,
            "Error al obtener el inventario de TNS."
          );
          setError(msg);
          setItems([]);
          setTotalCount(0);
          setTotalPages(1);
        }
      } finally {
        if (currentCallId === fetchCountRef.current) {
          setLoading(false);
        }
      }
    },
    [summary]
  );

  // Carga del resumen global y métricas
  const fetchSummary = useCallback(async (isForceRefresh = false) => {
    setSummaryLoading(true);
    try {
      const data = await getTNSInventarioSummary(isForceRefresh);
      if (data) {
        setSummary(data);
      }
    } catch (err) {
      console.error("Error al cargar resumen de inventario TNS:", err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Sincronización completa (ambos endpoints con force_refresh opcional)
  const refresh = useCallback(
    async (isForceRefresh = false) => {
      if (isForceRefresh) {
        setRefreshing(true);
        const toastId = toast.loading("Sincronizando con ERP TNS en tiempo real...");
        try {
          await Promise.all([
            fetchItems(params, true),
            fetchSummary(true),
          ]);
          toast.success("Inventario de TNS actualizado exitosamente", { id: toastId });
        } catch (e) {
          toast.error("Hubo un problema al sincronizar con TNS", { id: toastId });
        } finally {
          setRefreshing(false);
        }
      } else {
        await Promise.all([
          fetchItems(params, false),
          fetchSummary(false),
        ]);
      }
    },
    [fetchItems, fetchSummary, params]
  );

  // Actualizador de filtros
  const updateFilters = useCallback((partial: Partial<TNSInventarioParams>) => {
    setParams((prev) => ({
      ...prev,
      ...partial,
      page: partial.page !== undefined ? partial.page : 1, // resetea a página 1 si cambia un filtro
    }));
  }, []);

  const setPage = useCallback((newPage: number) => {
    setParams((prev) => ({ ...prev, page: newPage }));
  }, []);

  const setPageSize = useCallback((newPageSize: number) => {
    setParams((prev) => ({ ...prev, page_size: newPageSize, page: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setParams(INITIAL_TNS_PARAMS);
  }, []);

  // Carga inicial del resumen
  useEffect(() => {
    if (autoFetch) {
      void fetchSummary(false);
    }
  }, [autoFetch, fetchSummary]);

  // Carga con debounce cuando cambian los parámetros
  useEffect(() => {
    if (!autoFetch) return;

    const timer = setTimeout(() => {
      void fetchItems(params, false);
    }, 250);

    return () => clearTimeout(timer);
  }, [autoFetch, fetchItems, params]);

  return {
    items,
    summary,
    totalCount,
    totalPages,
    page: params.page || 1,
    pageSize: params.page_size || 20,
    params,
    loading,
    summaryLoading,
    refreshing,
    error,
    lastUpdated,
    updateFilters,
    clearFilters,
    setPage,
    setPageSize,
    refresh,
    forceSync: () => refresh(true),
  };
}
