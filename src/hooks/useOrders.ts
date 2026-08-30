import { useState, useCallback } from "react";
import type { StatusType } from "@/components/StatusBadge";
import { http, HttpError } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import {
    notifyOrderRealCostUpdated,
} from "@/lib/order-real-cost";

export interface OrderItem {
    subproducto_id: string;
    subproducto_nombre?: string;
    talla_id?: string | null;
    talla_nombre?: string | null;
    cantidad: number;
    costo_unitario: string | number;
    /** Precio de venta / ingreso proyectado unitario (factura cliente) */
    precio_venta_unitario?: string | number | null;
    producto_id?: string | null;
    producto_nombre?: string | null;
    linea_id?: string | null;
    linea_nombre?: string | null;
    color?: string | null;
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
    logo?: string | null;
    logo_url?: string | null;
    estado: StatusType;
    pagado: boolean;
    estado_pago?: "no_pagado" | "parcial" | "pagado";
    detalle_abono?: {
        monto_total?: number;
        monto_abono?: number;
        saldo_pendiente?: number;
        medio_pago?: string;
        concepto?: string;
        fecha_limite_saldo?: string;
        registrado_por_id?: string;
        registrado_por_nombre?: string;
        fecha_registro?: string;
        abono_detalle?: {
            monto_total?: number;
            monto_abono?: number;
            saldo_pendiente?: number;
            medio_pago?: string;
            concepto?: string;
            fecha_limite_saldo?: string;
            registrado_por_id?: string;
            registrado_por_nombre?: string;
            fecha_registro?: string;
        };
    } | null;
    valor_venta_proyectado: string;
    costo_total: string;
    ganancia: string;
    margen_ganancia: string;
    fecha_creacion: string;
    fecha_estimada_entrega?: string | null;
    fecha_entrega_real?: string | null;
    etapa_produccion?: string;
    etapa_historial?: { etapa: string; entered_at: string }[];
    kanban_asignaciones?: Record<
        string,
        {
            assigneeId?: string | null;
            assignee?: string;
            satelliteAssigneeId?: string | null;
            satelliteAssignee?: string;
            stage?: string;
            stageAssignees?: Record<
                string,
                { userId: string; name: string; kind?: string }
            >;
        }
    >;
    kanban_tarjetas?: import("@/data/mockData").ProductionOrder[];
    costo_real_desglose?: import("@/lib/order-real-cost").OrderRealCostBreakdown | Record<string, unknown>;
    items: OrderItem[];
    color?: string;
    estampado?: string;
    quote_id?: string | null;
}

export interface CreateOrderItemPayload {
    subproducto_id: string;
    talla_id: string;
    cantidad: number;
    color?: string;
    precio_venta_unitario?: number;
}

export interface CreateOrderPayload {
    cliente_id: string;
    producto_id: string;
    tomado_por_id: string;
    valor_venta_proyectado: number;
    items: CreateOrderItemPayload[];
    fecha_estimada_entrega?: string;
    comentarios?: string;
    logo?: string | null;
    logo_manga_derecha?: boolean;
    logo_manga_izquierda?: boolean;
    logo_delantero_derecha?: boolean;
    logo_delantero_izquierda?: boolean;
    logo_espalda?: boolean;
    logo_bolsillo?: boolean;
    estado_pago?: "no_pagado" | "parcial" | "pagado";
    detalle_abono?: {
        monto_total?: number;
        monto_abono?: number;
        saldo_pendiente?: number;
        medio_pago: string;
        concepto?: string;
        fecha_limite_saldo?: string;
        registrado_por_id?: string;
        registrado_por_nombre?: string;
        fecha_registro?: string;
        abono_detalle?: Record<string, unknown>;
    } | null;
    color?: string;
    estampado?: string;
    /** Cotización de origen (sincroniza estado de pago) */
    quote_id?: string;
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

export interface OrderEtapaLog {
    id: string;
    orden_id: string;
    etapa_anterior: string;
    etapa_nueva: string;
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

    const createOrder = async (
        payload: CreateOrderPayload
    ): Promise<{ success: boolean; order: Order | null; errorMessage: string | null }> => {
        setLoading(true);
        setError(null);
        try {
            const body = { ...payload, logo_manga_derecha: payload.logo_manga_derecha ?? false };
            const created = await http<Order>(endpoints.orders.list(), {
                method: "POST",
                body: JSON.stringify(body),
            });
            return { success: true, order: created, errorMessage: null };
        } catch (err: unknown) {
            const message = resolveHttpErrorMessage(err, "Error al crear la orden");
            setError(message);
            return { success: false, order: null, errorMessage: message };
        } finally {
            setLoading(false);
        }
    };

    const updateOrder = async (
        orderId: string,
        payload: CreateOrderPayload
    ): Promise<{ success: boolean; errorMessage: string | null }> => {
        setLoading(true);
        setError(null);
        try {
            const body = { ...payload, logo_manga_derecha: payload.logo_manga_derecha ?? false };
            const updated = await http<Order>(endpoints.orders.detail(orderId), {
                method: "PATCH",
                body: JSON.stringify(body),
            });
            mergeOrderInList(updated);
            return { success: true, errorMessage: null };
        } catch (err: unknown) {
            const message = resolveHttpErrorMessage(err, "Error al actualizar la orden");
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
            const updated = await http<Order>(endpoints.orders.estado(ordenId), {
                method: "PATCH",
                body: JSON.stringify({ nuevo_estado: nuevoEstado, observacion: observacion ?? "" }),
            });
            mergeOrderInList(updated);
            if (nuevoEstado === "in_production" || nuevoEstado === "delivered") {
                notifyOrderRealCostUpdated(ordenId);
            }
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

    const fetchEtapaLogs = async (ordenId: string): Promise<OrderEtapaLog[]> => {
        try {
            return await http<OrderEtapaLog[]>(endpoints.orders.etapas(ordenId));
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

    const updateOrderPayment = async (
        orderId: string,
        payload: {
            estado_pago: "no_pagado" | "parcial" | "pagado";
            detalle_abono?: CreateOrderPayload["detalle_abono"];
        }
    ) => {
        try {
            const updated = await http<Order>(endpoints.orders.pago(orderId), {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
            mergeOrderInList(updated);
            return { order: updated, errorMessage: null as string | null };
        } catch (err) {
            return {
                order: null,
                errorMessage: resolveHttpErrorMessage(err, "Error al actualizar el pago"),
            };
        }
    };

    const updateOrderStage = async (orderId: string, etapa: string, observacion?: string) => {
        try {
            const updated = await http<Order>(endpoints.orders.etapa(orderId), {
                method: "PATCH",
                body: JSON.stringify({
                    etapa,
                    ...(observacion ? { observacion } : {}),
                }),
            });
            mergeOrderInList(updated);
            return { order: updated, errorMessage: null as string | null };
        } catch (err) {
            return {
                order: null,
                errorMessage: resolveHttpErrorMessage(err, "Error al actualizar la etapa"),
            };
        }
    };

    const updateKanbanAssignment = async (
        orderId: string,
        payload: {
            card_id: string;
            stage: string;
            assignee_id?: string | null;
            assignee_name?: string;
            clear?: boolean;
            /** production (default) | satellite | both (solo al limpiar) */
            kind?: "production" | "satellite" | "both";
        }
    ) => {
        try {
            const updated = await http<{
                id: string;
                kanban_asignaciones: Order["kanban_asignaciones"];
                tomado_por_id: string | null;
            }>(endpoints.orders.kanbanAsignacion(orderId), {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
            setOrders((prev) =>
                prev.map((o) =>
                    o.id === orderId
                        ? {
                              ...o,
                              kanban_asignaciones: updated.kanban_asignaciones,
                              tomado_por_id: updated.tomado_por_id || o.tomado_por_id,
                          }
                        : o
                )
            );
            return { data: updated, errorMessage: null as string | null };
        } catch (err) {
            return {
                data: null,
                errorMessage: resolveHttpErrorMessage(err, "Error al guardar la asignación"),
            };
        }
    };

    const updateKanbanTarjetas = async (
        orderId: string,
        tarjetas: NonNullable<Order["kanban_tarjetas"]>,
        costo_real_desglose: NonNullable<Order["costo_real_desglose"]>
    ) => {
        try {
            const updated = await http<{
                id: string;
                kanban_tarjetas: Order["kanban_tarjetas"];
                costo_real_desglose: Order["costo_real_desglose"];
            }>(endpoints.orders.kanbanTarjetas(orderId), {
                method: "PATCH",
                body: JSON.stringify({ tarjetas, costo_real_desglose }),
            });
            setOrders((prev) =>
                prev.map((o) =>
                    o.id === orderId
                        ? {
                              ...o,
                              kanban_tarjetas: updated.kanban_tarjetas,
                              costo_real_desglose: updated.costo_real_desglose,
                          }
                        : o
                )
            );
            return { data: updated, errorMessage: null as string | null };
        } catch (err) {
            return {
                data: null,
                errorMessage: resolveHttpErrorMessage(
                    err,
                    "Error al guardar tarjetas Kanban / costo real"
                ),
            };
        }
    };

    return {
        orders, totalCount, loading, updatingSalePriceId, updatingCommentsId, error,
        fetchOrders, fetchOrderById, createOrder, updateOrder, updateOrderStatus,
        updateOrderSalePrice, updateOrderComments, updateOrderPayment, updateOrderStage,
        updateKanbanAssignment, updateKanbanTarjetas,
        mergeOrderInList, fetchOrderLogs, fetchEtapaLogs,
    };
}