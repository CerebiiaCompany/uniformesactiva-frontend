import { useState, useCallback } from "react";
import { http, HttpError } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export interface Quote {
    id: string;
    customerName: string;
    customerId: string;
    items: string;
    totalAmount: number;
    status: "draft" | "sent" | "approved" | "rejected" | "inactive" | "in_review";
    createdAt: string;
    validUntil: string;
    takenBy?: string;
    probability?: number;
    shippingDate?: string;
}

interface ApiQuote {
    id: string;
    client: string;
    client_id: string;
    articulos: string[];
    monto: string | number;
    estado: "draft" | "sent" | "approved" | "rejected" | "inactive" | "in_review";
    creacion: string;
    validez: string;
    tomado_por?: string;
    probabilidad?: number;
    fecha_envio?: string;
}

interface CreateQuotePayload {
    client: string;
    articulos: string[];
    monto: number;
    estado: Quote["status"];
    validez: string;
    tomado_por?: string | null;
    probabilidad?: number | null;
    fecha_envio?: string | null;
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
    };
}

function mapFormToCreatePayload(data: Omit<Quote, "id" | "createdAt">): CreateQuotePayload {
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

    const createQuote = useCallback(async (data: Omit<Quote, "id" | "createdAt">) => {
        setLoading(true);
        setError(null);
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
            setError(message);
            return { success: false, errorMessage: message };
        } finally {
            setLoading(false);
        }
    }, [fetchQuotes]);

    const updateQuote = useCallback(async (id: string, data: Partial<Omit<Quote, "id" | "createdAt">>) => {
        setLoading(true);
        setError(null);
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
            setError(message);
            return { success: false, errorMessage: message };
        } finally {
            setLoading(false);
        }
    }, [fetchQuotes]);

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

    return {
        quotes,
        loading,
        error,
        fetchQuotes,
        createQuote,
        updateQuote,
        deleteQuote,
        updateQuoteStatus,    // ✅ Nuevo
        convertQuoteToOrder,  // ✅ Nuevo
    };
}