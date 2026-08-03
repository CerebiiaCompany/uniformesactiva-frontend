import { useState, useCallback } from "react";
import { http, HttpError } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export interface QuoteOrderPayload {
    cliente_id: string;
    producto_id: string;
    tomado_por_id: string;
    valor_venta_proyectado: number;
    items: {
        subproducto_id: string;
        talla_id: string;
        cantidad: number;
        color?: string;
        talla_nombre?: string;
        costo_unitario?: number;
        /** Precio de venta unitario (ingreso proyectado) para impresión */
        precio_venta_unitario?: number;
        producto_nombre?: string;
        subproducto_nombre?: string;
        linea_id?: string;
        linea_nombre?: string;
        estampado?: string;
    }[];
    fecha_estimada_entrega?: string;
    comentarios?: string;
    logo_manga_derecha?: boolean;
    logo_manga_izquierda?: boolean;
    logo_delantero_derecha?: boolean;
    logo_delantero_izquierda?: boolean;
    logo_espalda?: boolean;
    logo_bolsillo?: boolean;
    product_labels?: string[];
    logo?: string | null;
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
    color?: string;
    estampado?: string;
}

export interface Quote {
    id: string;
    customerName: string;
    customerId: string;
    items: string;
    totalAmount: number;
    status: "draft" | "sent" | "approved" | "rejected" | "inactive" | "in_review" | "ordered";
    createdAt: string;
    validUntil: string;
    takenBy?: string;
    probability?: number;
    shippingDate?: string;
    orderPayload?: QuoteOrderPayload | Record<string, unknown>;
    hasOrderPayload?: boolean;
    novedadesCount?: number;
    paymentStatus?: "no_pagado" | "parcial" | "pagado";
}

export interface QuoteNovedad {
    id: string;
    quoteId: string;
    texto: string;
    autorId?: string | null;
    autorNombre: string;
    createdAt: string;
}

interface ApiQuote {
    id: string;
    client: string;
    client_id: string;
    articulos: string[];
    monto: string | number;
    estado: "draft" | "sent" | "approved" | "rejected" | "inactive" | "in_review" | "ordered";
    creacion: string;
    validez: string;
    tomado_por?: string;
    probabilidad?: number;
    fecha_envio?: string;
    order_payload?: QuoteOrderPayload | Record<string, unknown>;
    novedades_count?: number;
}

interface ApiQuoteNovedad {
    id: string;
    quote_id: string;
    texto: string;
    autor_id?: string | null;
    autor_nombre?: string;
    created_at: string;
}

interface CreateQuotePayload {
    client: string;
    articulos: string[];
    monto: number;
    estado: Quote["status"];
    validez?: string | null;
    tomado_por?: string | null;
    probabilidad?: number | null;
    fecha_envio?: string | null;
    order_payload?: QuoteOrderPayload | Record<string, unknown> | null;
}

export interface CreateQuoteFromOrderFormInput {
    customerId: string;
    customerName?: string;
    items: string;
    totalAmount: number;
    status: Quote["status"];
    validUntil: string;
    takenBy?: string;
    probability?: number;
    shippingDate?: string;
    orderPayload: QuoteOrderPayload;
}

export interface FetchQuotesFilters {
    client?: string;
    estado?: string;
    tomado_por?: string;
    probabilidad?: number;
    fecha_envio_desde?: string;
    fecha_envio_hasta?: string;
}

type UpdateQuotePayload = Partial<CreateQuotePayload>;

function resolveHttpErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpError) return err.message || fallback;
    if (err instanceof Error) return err.message;
    return fallback;
}

function mapApiQuoteToQuote(api: ApiQuote): Quote {
    const itemsString = Array.isArray(api.articulos)
        ? api.articulos.join(", ")
        : String(api.articulos);
    const payload = api.order_payload || {};
    const hasPayload = Boolean(
        payload &&
            typeof payload === "object" &&
            Array.isArray((payload as QuoteOrderPayload).items) &&
            (payload as QuoteOrderPayload).items.length > 0
    );
    const rawPayment =
        payload && typeof payload === "object"
            ? (payload as QuoteOrderPayload).estado_pago
            : undefined;
    const paymentStatus: Quote["paymentStatus"] =
        rawPayment === "parcial" || rawPayment === "pagado" || rawPayment === "no_pagado"
            ? rawPayment
            : hasPayload
              ? "no_pagado"
              : undefined;

    return {
        id: api.id,
        customerName: api.client,
        customerId: api.client_id || "",
        items: itemsString,
        totalAmount: typeof api.monto === "string" ? parseFloat(api.monto) : api.monto,
        status: api.estado,
        createdAt: api.creacion,
        validUntil: api.validez,
        takenBy: api.tomado_por || undefined,
        probability: api.probabilidad || undefined,
        shippingDate: api.fecha_envio ? api.fecha_envio.split("T")[0] : undefined,
        orderPayload: payload,
        hasOrderPayload: hasPayload,
        novedadesCount: api.novedades_count ?? 0,
        paymentStatus,
    };
}

function mapApiNovedad(api: ApiQuoteNovedad): QuoteNovedad {
    return {
        id: api.id,
        quoteId: api.quote_id,
        texto: api.texto,
        autorId: api.autor_id ?? null,
        autorNombre: api.autor_nombre || "",
        createdAt: api.created_at,
    };
}

function mapFormToCreatePayload(
    data: Omit<Quote, "id" | "createdAt"> & { orderPayload?: QuoteOrderPayload }
): CreateQuotePayload {
    const articulosList = data.items
        ? data.items.split(",").map(item => item.trim()).filter(item => item.length > 0)
        : [];

    return {
        client: data.customerId,
        articulos: articulosList,
        monto: data.totalAmount,
        estado: data.status,
        validez: data.validUntil,
        tomado_por: data.takenBy || null,
        probabilidad: data.probability !== undefined ? data.probability : null,
        fecha_envio: data.shippingDate ? new Date(data.shippingDate).toISOString() : null,
        order_payload: data.orderPayload ?? null,
    };
}

function mapFormToUpdatePayload(data: Partial<Omit<Quote, "id" | "createdAt">>): UpdateQuotePayload {
    const payload: UpdateQuotePayload = {};

    if (data.customerId !== undefined) payload.client = data.customerId;

    if (data.items !== undefined) {
        const articulosList = data.items
            ? data.items.split(",").map(item => item.trim()).filter(item => item.length > 0)
            : [];
        payload.articulos = articulosList;
    }

    if (data.totalAmount !== undefined) payload.monto = data.totalAmount;
    if (data.status !== undefined) payload.estado = data.status;
    if (data.validUntil !== undefined) payload.validez = data.validUntil;

    if (data.takenBy !== undefined) payload.tomado_por = data.takenBy || null;
    if (data.probability !== undefined) payload.probabilidad = data.probability !== undefined ? data.probability : null;
    if (data.shippingDate !== undefined) {
        payload.fecha_envio = data.shippingDate ? new Date(data.shippingDate).toISOString() : null;
    }
    if (data.orderPayload !== undefined) {
        payload.order_payload = data.orderPayload ?? null;
    }

    return payload;
}

export function useQuotes() {

    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchQuotes = useCallback(async (filters?: FetchQuotesFilters) => {
        setLoading(true);
        setError(null);
        try {
            let url = endpoints.quotes.list();

            if (filters) {
                const params = new URLSearchParams();
                if (filters.client) params.append("client", filters.client);
                if (filters.estado) params.append("estado", filters.estado);
                if (filters.tomado_por) params.append("tomado_por", filters.tomado_por);
                if (filters.probabilidad !== undefined) params.append("probabilidad", filters.probabilidad.toString());
                if (filters.fecha_envio_desde) params.append("fecha_envio_desde", filters.fecha_envio_desde);
                if (filters.fecha_envio_hasta) params.append("fecha_envio_hasta", filters.fecha_envio_hasta);

                const queryString = params.toString();
                if (queryString) {
                    url = `${url}?${queryString}`;
                }
            }

            const data = await http<ApiQuote[]>(url);
            const mapped = data.map(mapApiQuoteToQuote);
            setQuotes(mapped);
        } catch (err) {
            const message = resolveHttpErrorMessage(err, "Error al cargar las cotizaciones");
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const createQuote = useCallback(async (data: Omit<Quote, "id" | "createdAt"> & { orderPayload?: QuoteOrderPayload }) => {
        setLoading(true);
        try {
            const payload = mapFormToCreatePayload(data);
            await http<ApiQuote>(endpoints.quotes.list(), {
                method: "POST",
                body: JSON.stringify(payload),
            });
            await fetchQuotes();
            return { success: true, errorMessage: null };
        } catch (err) {
            const message = resolveHttpErrorMessage(err, "Error al crear la cotización");
            return { success: false, errorMessage: message };
        } finally {
            setLoading(false);
        }
    }, [fetchQuotes]);

    const createQuoteFromOrderForm = useCallback(async (data: CreateQuoteFromOrderFormInput) => {
        return createQuote({
            customerId: data.customerId,
            customerName: data.customerName || "",
            items: data.items,
            totalAmount: data.totalAmount,
            status: data.status,
            validUntil: data.validUntil,
            takenBy: data.takenBy,
            probability: data.probability,
            shippingDate: data.shippingDate,
            orderPayload: data.orderPayload,
        });
    }, [createQuote]);

    const placeOrderFromQuote = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const result = await http<{ order: { id: string }; message: string }>(
                endpoints.quotes.placeOrder(id),
                { method: "POST" }
            );
            await fetchQuotes();
            return { success: true, data: result, errorMessage: null };
        } catch (err) {
            const message = resolveHttpErrorMessage(err, "No se pudo crear la orden desde la cotización");
            return { success: false, data: null, errorMessage: message };
        } finally {
            setLoading(false);
        }
    }, [fetchQuotes]);

    const updateQuote = useCallback(async (id: string, data: Partial<Omit<Quote, "id" | "createdAt">>) => {
        setLoading(true);
        try {
            const payload = mapFormToUpdatePayload(data);
            await http<ApiQuote>(endpoints.quotes.detail(id), {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
            await fetchQuotes();
            return { success: true, errorMessage: null };
        } catch (err) {
            const message = resolveHttpErrorMessage(err, "Error al actualizar la cotización");
            return { success: false, errorMessage: message };
        } finally {
            setLoading(false);
        }
    }, [fetchQuotes]);

    const updateQuoteFromOrderForm = useCallback(async (id: string, data: CreateQuoteFromOrderFormInput) => {
        return updateQuote(id, {
            customerId: data.customerId,
            customerName: data.customerName || "",
            items: data.items,
            totalAmount: data.totalAmount,
            status: data.status,
            validUntil: data.validUntil,
            takenBy: data.takenBy,
            probability: data.probability,
            shippingDate: data.shippingDate,
            orderPayload: data.orderPayload,
        });
    }, [updateQuote]);

    const deleteQuote = useCallback(async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            await http<void>(endpoints.quotes.detail(id), {
                method: "DELETE",
            });
            await fetchQuotes();
            return { success: true, errorMessage: null };
        } catch (err) {
            const message = resolveHttpErrorMessage(err, "Error al eliminar la cotización");
            setError(message);
            return { success: false, errorMessage: message };
        } finally {
            setLoading(false);
        }
    }, [fetchQuotes]);

    const updateQuoteStatus = useCallback(async (id: string, status: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await http<{ id: string; estado: string }>(
                endpoints.quotes.status(id),
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status }),
                }
            );
            await fetchQuotes();
            return { success: true, data: result, errorMessage: null };
        } catch (err) {
            const message = resolveHttpErrorMessage(err, "Error al actualizar el estado");
            setError(message);
            return { success: false, data: null, errorMessage: message };
        } finally {
            setLoading(false);
        }
    }, [fetchQuotes]);

    /** Marca cotización aprobada → ordenado (endpoint dedicado, sin RBAC estricto). */
    const markQuoteAsOrdered = useCallback(async (id: string, ordenId?: string) => {
        setLoading(true);
        try {
            const result = await http<ApiQuote>(endpoints.quotes.markOrdered(id), {
                method: "POST",
                body: JSON.stringify(ordenId ? { orden_id: ordenId } : {}),
            });
            await fetchQuotes();
            return { success: true, data: result, errorMessage: null };
        } catch (err) {
            // Fallback: PATCH parcial del detalle
            try {
                const result = await http<ApiQuote>(endpoints.quotes.detail(id), {
                    method: "PATCH",
                    body: JSON.stringify({ estado: "ordered" }),
                });
                await fetchQuotes();
                return { success: true, data: result, errorMessage: null };
            } catch (fallbackErr) {
                const message = resolveHttpErrorMessage(
                    fallbackErr,
                    resolveHttpErrorMessage(err, "No se pudo marcar la cotización como Ordenado")
                );
                return { success: false, data: null, errorMessage: message };
            }
        } finally {
            setLoading(false);
        }
    }, [fetchQuotes]);

    const convertQuoteToOrder = useCallback(async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await http<{ id: string; message: string }>(
                endpoints.quotes.convert(id),
                { method: "POST" }
            );
            await fetchQuotes();
            return { success: true, data: result, errorMessage: null };
        } catch (err) {
            const message = resolveHttpErrorMessage(err, "Error al convertir a orden");
            setError(message);
            return { success: false, data: null, errorMessage: message };
        } finally {
            setLoading(false);
        }
    }, [fetchQuotes]);

    const fetchQuoteNovedades = useCallback(async (quoteId: string) => {
        try {
            const data = await http<ApiQuoteNovedad[]>(endpoints.quotes.novedades(quoteId));
            return {
                success: true as const,
                data: (data || []).map(mapApiNovedad),
                errorMessage: null as string | null,
            };
        } catch (err) {
            return {
                success: false as const,
                data: [] as QuoteNovedad[],
                errorMessage: resolveHttpErrorMessage(err, "Error al cargar novedades"),
            };
        }
    }, []);

    const createQuoteNovedad = useCallback(async (quoteId: string, texto: string) => {
        try {
            const created = await http<ApiQuoteNovedad>(endpoints.quotes.novedades(quoteId), {
                method: "POST",
                body: JSON.stringify({ texto }),
            });
            setQuotes((prev) =>
                prev.map((q) =>
                    q.id === quoteId
                        ? { ...q, novedadesCount: (q.novedadesCount || 0) + 1 }
                        : q
                )
            );
            return {
                success: true as const,
                data: mapApiNovedad(created),
                errorMessage: null as string | null,
            };
        } catch (err) {
            return {
                success: false as const,
                data: null,
                errorMessage: resolveHttpErrorMessage(err, "Error al crear la novedad"),
            };
        }
    }, []);

    const mergeQuoteInList = useCallback((updated: Quote) => {
        setQuotes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    }, []);

    const fetchQuoteById = useCallback(
        async (id: string): Promise<Quote | null> => {
            try {
                const data = await http<ApiQuote>(endpoints.quotes.detail(id));
                const mapped = mapApiQuoteToQuote(data);
                mergeQuoteInList(mapped);
                return mapped;
            } catch {
                return null;
            }
        },
        [mergeQuoteInList]
    );

    const updateQuotePayment = useCallback(
        async (
            quoteId: string,
            payload: {
                estado_pago: "no_pagado" | "parcial" | "pagado";
                detalle_abono?: QuoteOrderPayload["detalle_abono"];
            }
        ) => {
            try {
                const updated = await http<ApiQuote>(endpoints.quotes.pago(quoteId), {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                });
                const mapped = mapApiQuoteToQuote(updated);
                mergeQuoteInList(mapped);
                return { quote: mapped, errorMessage: null as string | null };
            } catch (err) {
                return {
                    quote: null,
                    errorMessage: resolveHttpErrorMessage(err, "Error al actualizar el pago"),
                };
            }
        },
        [mergeQuoteInList]
    );

    return {
        quotes,
        loading,
        error,
        fetchQuotes,
        fetchQuoteById,
        createQuote,
        createQuoteFromOrderForm,
        updateQuoteFromOrderForm,
        placeOrderFromQuote,
        updateQuote,
        deleteQuote,
        updateQuoteStatus,
        markQuoteAsOrdered,
        convertQuoteToOrder,
        fetchQuoteNovedades,
        createQuoteNovedad,
        updateQuotePayment,
        mergeQuoteInList,
    };
}