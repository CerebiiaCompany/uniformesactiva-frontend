import { useState, useCallback } from "react";
import type { StatusType } from "@/components/StatusBadge";
import { http, HttpError } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export interface OrderItem {
    subproducto_id: string;
    subproducto_nombre?: string;
    talla_id?: string | null;
    talla_nombre?: string | null;
    cantidad: number;
    costo_unitario: string | number;
}

export interface OrderLogoFields {
    logo_manga_derecha: boolean;
    logo_manga_izquierda: boolean;
    logo_delantero_derecha: boolean;
    logo_delantero_izquierda: boolean;
    logo_espalda: boolean;
    logo_bolsillo: boolean;
}

export interface Order extends OrderLogoFields {
    id: string;
    cliente_id: string;
    cliente_nombre: string;
    producto_id: string;
    producto_nombre: string;
    tomado_por_id: string | null;
    tomado_por_nombre: string | null;
    comentarios: string | null;
    estado: StatusType;
    pagado: boolean; // Ahora es booleano
    valor_venta_proyectado: string;
    costo_total: string;
    ganancia: string;
    margen_ganancia: string;
    fecha_creacion: string;
    fecha_estimada_entrega?: string | null;
    items: OrderItem[];
}

export interface CreateOrderItemPayload {
    subproducto_id: string;
    talla_id: string;
    cantidad: number;
}

export interface CreateOrderPayload {
    cliente_id: string;
    producto_id: string;
    tomado_por_id: string;
    valor_venta_proyectado: number;
    items: CreateOrderItemPayload[];
    fecha_estimada_entrega?: string;
    comentarios?: string;
    logo_manga_derecha?: boolean;
    logo_manga_izquierda?: boolean;
    logo_delantero_derecha?: boolean;
    logo_delantero_izquierda?: boolean;
    logo_espalda?: boolean;
    logo_bolsillo?: boolean;
}

export interface OrderListFilters {
    id?: string;
    cliente_id?: string;
    producto_id?: string;
    estado?: string;
    payment_status?: 'paid' | 'unpaid' | 'todos'; // Ajustado a los valores del selector
    fecha_creacion?: string;
    page?: number;
    page_size?: number;
}

export interface OrderLog {
    id: string;
    orden_id: string;
    estado_anterior: string;
    estado_nuevo: string;
    usuario_id: string | null;
    fecha_hora: string;
    observacion: string | null;
}

interface OrderListResponse {
    total_count: number;
    items: Order[];
}

function buildOrderQueryParams(filters: OrderListFilters): URLSearchParams {
    const params = new URLSearchParams();

    if (filters.cliente_id) params.set("cliente", filters.cliente_id);
    if (filters.producto_id) params.set("producto", filters.producto_id);
    if (filters.id) params.set("id", filters.id);

    if (filters.estado && filters.estado !== "todos") {
        params.set("estado", filters.estado);
    }

    // Mapeo del filtro de pago a valor booleano para el backend
    if (filters.payment_status && filters.payment_status !== "todos") {
        params.set("pagado", filters.payment_status === "paid" ? "true" : "false");
    }

    if (filters.fecha_creacion) {
        params.set("fecha_creacion", filters.fecha_creacion);
    }

    params.set("page", String(filters.page ?? 1));
    params.set("page_size", String(filters.page_size ?? 10));

    return params;
}

function resolveHttpErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpError) return err.message || fallback;
    if (err instanceof Error) return err.message;
    return fallback;
}

export function useOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [updatingSalePriceId, setUpdatingSalePriceId] = useState<string | null>(null);
    const [updatingCommentsId, setUpdatingCommentsId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const mergeOrderInList = useCallback((updated: Order) => {
        setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
    }, []);

    const fetchOrders = useCallback(async (filters: OrderListFilters = {}) => {
        setLoading(true);
        setError(null);

        try {
            const queryParams = buildOrderQueryParams(filters).toString();
            const data = await http<OrderListResponse>(`${endpoints.orders.list()}?${queryParams}`);

            setOrders(data.items || []);
            setTotalCount(data.total_count || 0);
        } catch (err: unknown) {
            const message = resolveHttpErrorMessage(err, "Error al obtener las órdenes");
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchOrderById = useCallback(async (id: string): Promise<Order | null> => {
        setError(null);
        try {
            const queryParams = buildOrderQueryParams({ id, page: 1, page_size: 1 }).toString();
            const data = await http<OrderListResponse>(`${endpoints.orders.list()}?${queryParams}`);
            return data.items?.[0] ?? null;
        } catch (err: unknown) {
            const message = resolveHttpErrorMessage(err, "Error al obtener la orden");
            setError(message);
            return null;
        }
    }, []);

    const createOrder = async (payload: CreateOrderPayload): Promise<{ success: boolean; errorMessage: string | null }> => {
        setLoading(true);
        setError(null);
        try {
            const body = { ...payload, logo_manga_derecha: payload.logo_manga_derecha ?? false };
            await http<Order>(endpoints.orders.list(), {
                method: "POST",
                body: JSON.stringify(body),
            });
            return { success: true, errorMessage: null };
        } catch (err: unknown) {
            const message = resolveHttpErrorMessage(err, "Error al crear la orden");
            setError(message);
            return { success: false, errorMessage: message };
        } finally {
            setLoading(false);
        }
    };

    const updateOrderStatus = async (ordenId: string, nuevoEstado: string, observacion: string | null) => {
        setLoading(true);
        setError(null);
        try {
            await http<Order>(endpoints.orders.estado(ordenId), {
                method: "PATCH",
                body: JSON.stringify({ nuevo_estado: nuevoEstado, observacion: observacion ?? "" }),
            });
            return true;
        } catch (err: unknown) {
            setError(resolveHttpErrorMessage(err, "Error al actualizar estado"));
            return false;
        } finally {
            setLoading(false);
        }
    };

    const fetchOrderLogs = async (ordenId: string): Promise<OrderLog[]> => {
        try {
            return await http<OrderLog[]>(endpoints.orders.logs(ordenId));
        } catch {
            return [];
        }
    };

    const updateOrderSalePrice = async (orderId: string, valorVentaProyectado: number) => {
        setUpdatingSalePriceId(orderId);
        try {
            const updated = await http<Order>(endpoints.orders.valorVenta(orderId), {
                method: "PATCH",
                body: JSON.stringify({ valor_venta_proyectado: valorVentaProyectado }),
            });
            mergeOrderInList(updated);
            return { order: updated, errorMessage: null };
        } catch (err) {
            return { order: null, errorMessage: resolveHttpErrorMessage(err, "Error") };
        } finally {
            setUpdatingSalePriceId(null);
        }
    };

    const updateOrderComments = async (orderId: string, comentarios: string) => {
        setUpdatingCommentsId(orderId);
        try {
            const updated = await http<Order>(endpoints.orders.comentarios(orderId), {
                method: "PATCH",
                body: JSON.stringify({ comentarios }),
            });
            mergeOrderInList(updated);
            return { order: updated, errorMessage: null };
        } catch (err) {
            return { order: null, errorMessage: resolveHttpErrorMessage(err, "Error") };
        } finally {
            setUpdatingCommentsId(null);
        }
    };

    return {
        orders, totalCount, loading, updatingSalePriceId, updatingCommentsId, error,
        fetchOrders, fetchOrderById, createOrder, updateOrderStatus,
        updateOrderSalePrice, updateOrderComments, mergeOrderInList, fetchOrderLogs,
    };
}