import { useState, useCallback } from "react";
import type { StatusType } from "@/components/StatusBadge";

export interface OrderItem {
    subproducto_id: string;
    subproducto_nombre?: string;
    cantidad: number;
    costo_unitario: string | number;
}

export interface Order {
    id: string;
    cliente_id: string;
    cliente_nombre: string;
    producto_id: string;
    producto_nombre: string;
    estado: StatusType;
    valor_venta_proyectado: string;
    margen_ganancia: string;
    fecha_creacion: string;
    fecha_estimada_entrega?: string | null;
    items: OrderItem[];
}

export interface CreateOrderPayload {
    cliente_id: string;
    producto_id: string;
    valor_venta_proyectado: string | number;
    items: OrderItem[];
    fecha_estimada_entrega?: string | null;
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

export function useOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const API_URL = import.meta.env.VITE_API_BASE_URL;

    const getToken = () => localStorage.getItem("token");

    const fetchOrders = useCallback(async (filters: Record<string, string | number> = {}) => {
        setLoading(true);
        setError(null);

        try {
            const params: Record<string, string> = {};

            if (filters.cliente_id) params.cliente = String(filters.cliente_id);
            if (filters.producto_id) params.producto = String(filters.producto_id);
            if (filters.id) params.id = String(filters.id);

            if (filters.estado && filters.estado !== "todos") {
                params.estado = String(filters.estado);
            }

            if (filters.fecha_creacion) {
                params.fecha_creacion = String(filters.fecha_creacion);
            }

            if (filters.page) params.page = String(filters.page);
            if (filters.page_size) params.page_size = String(filters.page_size);

            const queryParams = new URLSearchParams(params).toString();
            const endpoint = `${API_URL}/api/v1/orders/?${queryParams}`;

            const response = await fetch(endpoint, {
                headers: {
                    "Authorization": `Bearer ${getToken()}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) throw new Error("Error al obtener las órdenes");

            const data = await response.json();

            setOrders(data.items || []);
            setTotalCount(data.total_count || 0);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [API_URL]);

    const createOrder = async (payload: CreateOrderPayload) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/api/v1/orders/`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${getToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(JSON.stringify(errData));
            }

            await fetchOrders();
            return true;

        } catch (err: any) {
            setError(err.message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const updateOrderStatus = async (ordenId: string, nuevoEstado: string, observacion: string | null) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/api/v1/orders/${ordenId}/estado/`, {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${getToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    nuevo_estado: nuevoEstado,
                    observacion: observacion,
                }),
            });

            if (!response.ok) {
                let mensaje = "Error al actualizar el estado";

                if (response.status === 403 || response.status === 401) {
                    mensaje = "No tienes permisos para cambiar el estado de esta orden.";
                } else if (response.status === 404) {
                    mensaje = "La ruta de la API no se encontró.";
                } else if (response.status >= 500) {
                    mensaje = "El usuario no tiene permisos para cambiar el estado de la orden.";
                }

                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || mensaje);
            }

            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const fetchOrderLogs = async (ordenId: string): Promise<OrderLog[]> => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/v1/orders/${ordenId}/logs/`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${getToken()}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) throw new Error("Error al obtener el historial");

            return await response.json();
        } catch (err: any) {
            setError(err.message);
            return [];
        } finally {
            setLoading(false);
        }
    };

    return {
        orders,
        totalCount,
        loading,
        error,
        fetchOrders,
        createOrder,
        updateOrderStatus,
        fetchOrderLogs,
    };
}