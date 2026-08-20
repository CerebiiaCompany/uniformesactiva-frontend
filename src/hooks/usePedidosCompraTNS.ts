import { useState, useEffect, useCallback, useMemo } from "react";
import type { PedidoCompra, PedidosCompraFilters } from "@/types/tns";
import {
  getPedidosCompra,
  getPedidoNumDoc,
  filterPedidosCompraList,
} from "@/services/tnsService";
import { HttpError } from "@/lib/http";

function resolveHttpErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpError) return err.message || fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}

const INITIAL_FILTERS: PedidosCompraFilters = {
  fecha_inicio: "",
  fecha_fin: "",
  proveedor: "",
  numero_documento: "",
  estado: "todos",
  search: "",
  page: 1,
  page_size: 50,
};

export function usePedidosCompraTNS(autoFetch = true) {
  const [allPedidos, setAllPedidos] = useState<PedidoCompra[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [serverTotalCount, setServerTotalCount] = useState<number>(0);
  const [filters, setFilters] = useState<PedidosCompraFilters>(INITIAL_FILTERS);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const fetchPedidos = useCallback(
    async (queryFilters: PedidosCompraFilters) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getPedidosCompra(queryFilters);
        setAllPedidos(res.items);
        setServerTotalCount(res.total_count);
      } catch (err) {
        const msg = resolveHttpErrorMessage(
          err,
          "No se pudieron cargar los pedidos de compra desde TNS."
        );
        setError(msg);
        setAllPedidos([]);
        setServerTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateFilters = useCallback((partial: Partial<PedidosCompraFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...partial,
      page: partial.page !== undefined ? partial.page : 1,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const toggleRow = useCallback((key: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const expandAll = useCallback((items: PedidoCompra[]) => {
    const next: Record<string, boolean> = {};
    items.forEach((p, idx) => {
      const key = getPedidoNumDoc(p) || String(idx);
      next[key] = true;
    });
    setExpandedRows(next);
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedRows({});
  }, []);

  // Filtrado reactivo completo en cliente inmediato
  const filteredPedidos = useMemo(() => {
    return filterPedidosCompraList(allPedidos, filters);
  }, [allPedidos, filters]);

  // Consulta automática reactiva a la API cuando cambian las fechas, estado o filtros
  useEffect(() => {
    if (!autoFetch) return;

    const timer = setTimeout(() => {
      void fetchPedidos(filters);
    }, 250);

    return () => clearTimeout(timer);
  }, [
    autoFetch,
    fetchPedidos,
    filters.fecha_inicio,
    filters.fecha_fin,
    filters.estado,
    filters.proveedor,
    filters.numero_documento,
    filters.search,
  ]);

  return {
    pedidos: filteredPedidos,
    rawPedidos: allPedidos,
    loading,
    error,
    totalCount: filteredPedidos.length || serverTotalCount,
    filters,
    setFilters,
    updateFilters,
    clearFilters,
    fetchPedidos: (f?: PedidosCompraFilters) => fetchPedidos(f ?? filters),
    refresh: () => fetchPedidos(filters),
    expandedRows,
    toggleRow,
    expandAll: () => expandAll(filteredPedidos),
    collapseAll,
  };
}
