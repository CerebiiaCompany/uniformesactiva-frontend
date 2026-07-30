import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export interface CreateInsumoTipoPayload {
    name: string;
    categoria: string;
    unidad_medida: string;
    precio_unitario_default?: number | null;
    codigo_sku?: string;
    proveedor_marca?: string;
    color?: string;
    stock_minimo?: number | null;
    stock_inicial?: number | null;
}

export interface InsumoTipoResponse {
    id: string;
    name: string;
    categoria?: string;
    unidad_medida?: string;
    precio_unitario_default?: number | string | null;
    codigo_sku?: string;
    proveedor_marca?: string;
    color?: string;
    stock_minimo?: number | string | null;
    stock_inicial?: number | string | null;
}

export function useCreateInsumoTipo() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const createInsumoTipo = async (payload: CreateInsumoTipoPayload) => {
        setIsLoading(true);
        setError(null);

        try {
            const body: Record<string, unknown> = {
                name: payload.name.trim(),
                categoria: payload.categoria.trim(),
                unidad_medida: payload.unidad_medida.trim(),
                codigo_sku: payload.codigo_sku?.trim() || "",
                proveedor_marca: payload.proveedor_marca?.trim() || "",
                color: payload.color?.trim() || "",
            };

            if (payload.precio_unitario_default != null && !Number.isNaN(payload.precio_unitario_default)) {
                body.precio_unitario_default = Number(payload.precio_unitario_default).toFixed(2);
            } else {
                body.precio_unitario_default = null;
            }

            if (payload.stock_minimo != null && !Number.isNaN(payload.stock_minimo)) {
                body.stock_minimo = Number(payload.stock_minimo).toFixed(2);
            } else {
                body.stock_minimo = null;
            }

            if (payload.stock_inicial != null && !Number.isNaN(payload.stock_inicial)) {
                body.stock_inicial = Number(payload.stock_inicial).toFixed(2);
            } else {
                body.stock_inicial = null;
            }

            const data = await http<InsumoTipoResponse>(endpoints.costos.tiposInsumo(), {
                method: "POST",
                body: JSON.stringify(body),
            });

            await queryClient.invalidateQueries({ queryKey: ["cost-catalog", "tipos-insumo"] });
            await queryClient.invalidateQueries({ queryKey: ["materials"] });
            return { success: true as const, data };
        } catch (err: any) {
            const message = err.message || "Error al crear el tipo de insumo.";
            setError(message);
            return { success: false as const, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return { createInsumoTipo, isLoading, error };
}
