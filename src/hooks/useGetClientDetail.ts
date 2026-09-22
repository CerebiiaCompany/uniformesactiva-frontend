import { useState, useEffect, useCallback } from "react";
import { http } from "@/lib/http";

export interface ClientOrderItem {
  id: string;
  subproducto_id: string;
  subproducto_nombre?: string;
  talla_id?: string | null;
  talla_nombre?: string | null;
  cantidad: number;
  costo_unitario?: string | number;
  precio_venta_unitario?: string | number | null;
  color?: string;
}

export interface ClientOrder {
  id: string;
  cliente_id?: string;
  producto_id: string;
  producto_nombre: string;
  tomado_por_id?: string | null;
  tomado_por_nombre?: string | null;
  estado: "pending" | "in_production" | "delivered" | string;
  estado_display?: string;
  pagado: boolean;
  estado_pago?: "no_pagado" | "parcial" | "pagado" | string;
  detalle_abono?: any;
  valor_venta_proyectado: string | number;
  costo_total: string | number;
  ganancia?: string | number;
  margen_ganancia?: string | number;
  fecha_creacion?: string | null;
  fecha_estimada_entrega?: string | null;
  fecha_entrega_real?: string | null;
  etapa_produccion?: string;
  color?: string;
  estampado?: string;
  comentarios?: string;
  total_prendas?: number;
  items?: ClientOrderItem[];
}

export interface ClientDetail {
  id: string;
  nit: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  tipo_cliente: string;
  status: string;
  orders: ClientOrder[];
}

export function useGetClientDetail(clientId: string | null) {
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const fetchClientDetail = useCallback(async () => {
    if (!clientId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await http<ClientDetail>(`${baseUrl}/api/v1/clients/${clientId}/`);
      setClient(data);
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado al consultar el cliente.");
      setClient(null);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, baseUrl]);

  useEffect(() => {
    if (clientId) {
      fetchClientDetail();
    } else {
      setClient(null);
    }
  }, [clientId, fetchClientDetail]);

  return {
    client,
    isLoading,
    error,
    refetch: fetchClientDetail,
  };
}