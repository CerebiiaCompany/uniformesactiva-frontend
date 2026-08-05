import { useCallback, useEffect, useState } from "react";
import { http, HttpError } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export interface DashboardStats {
  ordersInProgress: number;
  delayedOrders: number;
  avgDeliveryDays: number;
  avgMargin: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  quotationsPending: number;
  customersActive: number;
  ordersUnpaidCount: number;
  ordersUnpaidBalance: number;
}

export interface DashboardTrends {
  ordersInProgressPct: number | null;
  monthlyRevenuePct: number | null;
  avgDeliveryDaysPct: number | null;
  avgMarginPct: number | null;
}

export interface DashboardRecentOrder {
  id: string;
  shortId: string;
  clienteNombre: string;
  productoNombre: string;
  valorVenta: number;
  estado: string;
  fechaCreacion: string | null;
}

export interface DashboardAlert {
  id: string;
  shortId: string;
  clienteNombre: string;
  productoNombre: string;
  estado: string;
  fechaEstimadaEntrega: string | null;
  daysLate: number;
}

export type DashboardPaymentEstado = "no_pagado" | "parcial" | "pagado" | string;

export interface DashboardUnpaidOrder {
  id: string;
  shortId: string;
  clienteNombre: string;
  productoNombre: string;
  estadoPago: DashboardPaymentEstado;
  valorVenta: number;
  montoCobrado: number;
  saldoPendiente: number;
  porcentajePagado: number;
  fechaLimiteSaldo: string | null;
  fechaCreacion: string | null;
}

interface DashboardApiResponse {
  stats: {
    orders_in_progress: number;
    delayed_orders: number;
    avg_delivery_days: number;
    avg_margin: number;
    monthly_revenue: number;
    monthly_profit: number;
    quotations_pending: number;
    customers_active: number;
    orders_unpaid_count?: number;
    orders_unpaid_balance?: number;
  };
  trends: {
    orders_in_progress_pct: number | null;
    monthly_revenue_pct: number | null;
    avg_delivery_days_pct: number | null;
    avg_margin_pct: number | null;
  };
  recent_orders: Array<{
    id: string;
    short_id: string;
    cliente_nombre: string;
    producto_nombre: string;
    valor_venta_proyectado: number;
    estado: string;
    fecha_creacion: string | null;
  }>;
  production_alerts: Array<{
    id: string;
    short_id: string;
    cliente_nombre: string;
    producto_nombre: string;
    estado: string;
    fecha_estimada_entrega: string | null;
    days_late: number;
  }>;
  unpaid_orders?: Array<{
    id: string;
    short_id: string;
    cliente_nombre: string;
    producto_nombre: string;
    estado_pago: string;
    valor_venta_proyectado: number;
    monto_cobrado: number;
    saldo_pendiente: number;
    porcentaje_pagado: number;
    fecha_limite_saldo: string | null;
    fecha_creacion: string | null;
  }>;
  meta?: { month?: string; notes?: string[] };
}

function mapResponse(data: DashboardApiResponse) {
  return {
    stats: {
      ordersInProgress: data.stats.orders_in_progress ?? 0,
      delayedOrders: data.stats.delayed_orders ?? 0,
      avgDeliveryDays: data.stats.avg_delivery_days ?? 0,
      avgMargin: data.stats.avg_margin ?? 0,
      monthlyRevenue: data.stats.monthly_revenue ?? 0,
      monthlyProfit: data.stats.monthly_profit ?? 0,
      quotationsPending: data.stats.quotations_pending ?? 0,
      customersActive: data.stats.customers_active ?? 0,
      ordersUnpaidCount: data.stats.orders_unpaid_count ?? 0,
      ordersUnpaidBalance: data.stats.orders_unpaid_balance ?? 0,
    } satisfies DashboardStats,
    trends: {
      ordersInProgressPct: data.trends?.orders_in_progress_pct ?? null,
      monthlyRevenuePct: data.trends?.monthly_revenue_pct ?? null,
      avgDeliveryDaysPct: data.trends?.avg_delivery_days_pct ?? null,
      avgMarginPct: data.trends?.avg_margin_pct ?? null,
    } satisfies DashboardTrends,
    recentOrders: (data.recent_orders || []).map(
      (o): DashboardRecentOrder => ({
        id: o.id,
        shortId: o.short_id,
        clienteNombre: o.cliente_nombre,
        productoNombre: o.producto_nombre,
        valorVenta: o.valor_venta_proyectado,
        estado: o.estado,
        fechaCreacion: o.fecha_creacion,
      })
    ),
    alerts: (data.production_alerts || []).map(
      (a): DashboardAlert => ({
        id: a.id,
        shortId: a.short_id,
        clienteNombre: a.cliente_nombre,
        productoNombre: a.producto_nombre,
        estado: a.estado,
        fechaEstimadaEntrega: a.fecha_estimada_entrega,
        daysLate: a.days_late,
      })
    ),
    unpaidOrders: (data.unpaid_orders || []).map(
      (o): DashboardUnpaidOrder => ({
        id: o.id,
        shortId: o.short_id,
        clienteNombre: o.cliente_nombre,
        productoNombre: o.producto_nombre,
        estadoPago: o.estado_pago,
        valorVenta: o.valor_venta_proyectado ?? 0,
        montoCobrado: o.monto_cobrado ?? 0,
        saldoPendiente: o.saldo_pendiente ?? 0,
        porcentajePagado: o.porcentaje_pagado ?? 0,
        fechaLimiteSaldo: o.fecha_limite_saldo,
        fechaCreacion: o.fecha_creacion,
      })
    ),
    notes: data.meta?.notes || [],
  };
}

export function useDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [recentOrders, setRecentOrders] = useState<DashboardRecentOrder[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [unpaidOrders, setUnpaidOrders] = useState<DashboardUnpaidOrder[]>([]);
  const [notes, setNotes] = useState<string[]>([]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await http<DashboardApiResponse>(endpoints.dashboard.stats());
      const mapped = mapResponse(data);
      setStats(mapped.stats);
      setTrends(mapped.trends);
      setRecentOrders(mapped.recentOrders);
      setAlerts(mapped.alerts);
      setUnpaidOrders(mapped.unpaidOrders);
      setNotes(mapped.notes);
    } catch (err) {
      const message =
        err instanceof HttpError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error al cargar el dashboard";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    loading,
    error,
    stats,
    trends,
    recentOrders,
    alerts,
    unpaidOrders,
    notes,
    refetch: fetchDashboard,
  };
}
