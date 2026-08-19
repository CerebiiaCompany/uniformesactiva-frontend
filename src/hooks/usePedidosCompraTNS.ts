import { useState, useEffect, useCallback } from "react";
import type { PedidoCompra, PedidosCompraFilters } from "@/types/tns";
import { getPedidosCompra, getPedidoNumDoc } from "@/services/tnsService";
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
  page_size: 20,
};

export function usePedidosCompraTNS(autoFetch = true) {
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [filters, setFilters] = useState<PedidosCompraFilters>(INITIAL_FILTERS);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const fetchPedidos = useCallback(
    async (appliedFilters?: PedidosCompraFilters) => {
      setLoading(true);
      setError(null);
      try {
        const queryFilters = appliedFilters ?? filters;
        const res = await getPedidosCompra(queryFilters);
        setPedidos(res.items);
        setTotalCount(res.total_count);
      } catch (err) {
        const msg = resolveHttpErrorMessage(
          err,
          "No se pudieron cargar los pedidos de compra desde TNS."
        );
        setError(msg);
        setPedidos([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  const updateFilters = useCallback((partial: Partial<PedidosCompraFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...partial,
      page: partial.page !== undefined ? partial.page : 1, // Reset page on filter change unless specified
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

  useEffect(() => {
    if (autoFetch) {
      void fetchPedidos(filters);
    }
  }, [filters, autoFetch]); // Refetch when filters change

  return {
    pedidos,
    loading,
    error,
    totalCount,
    filters,
    setFilters,
    updateFilters,
    clearFilters,
    fetchPedidos,
    refresh: () => fetchPedidos(filters),
    expandedRows,
    toggleRow,
    expandAll: () => expandAll(pedidos),
    collapseAll,
  };
}
