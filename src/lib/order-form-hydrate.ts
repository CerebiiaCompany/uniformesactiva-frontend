import type { OrderProductEntry } from "@/components/AddOrderProductDialog";
import type { Order } from "@/hooks/useOrders";
import type { Quote, QuoteOrderPayload } from "@/hooks/useQuotes";
import {
    LOGO_POSITION_OPTIONS,
    type LogoPositionKey,
} from "@/lib/order-fields";
import { getApiBaseUrl } from "@/lib/api-base";

export interface OrderFormSeed {
    selectedClient: string;
    takenBy: string;
    isRepair: boolean;
    productEntries: OrderProductEntry[];
    deliveryDate: string;
    paymentStatus: "no_pagado" | "parcial" | "pagado";
    abonoAmountRaw: string;
    medioPago: string;
    conceptoAbono: string;
    fechaLimiteSaldo: string;
    orderComments: string;
    logoPositions: LogoPositionKey[];
    logoPath: string | null;
    logoPreviewUrl: string | null;
    quoteStatus: "draft" | "sent" | "in_review" | "approved" | "rejected";
    validUntil: string;
    purchaseIntention: string;
}

function resolveMediaUrl(pathOrUrl: string | null | undefined): string | null {
    if (!pathOrUrl) return null;
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
    const base = getApiBaseUrl().replace(/\/$/, "");
    return pathOrUrl.startsWith("/") ? `${base}${pathOrUrl}` : `${base}/media/${pathOrUrl}`;
}

function toDateInput(value?: string | null): string {
    if (!value) return "";
    return value.includes("T") ? value.split("T")[0] : value.slice(0, 10);
}

function logoPositionsFromFlags(source: Record<string, unknown>): LogoPositionKey[] {
    return LOGO_POSITION_OPTIONS.filter((pos) => Boolean(source[pos.id])).map((pos) => pos.id);
}

function stripRepairTag(comments: string | null | undefined): { isRepair: boolean; text: string } {
    const raw = (comments || "").trim();
    const isRepair = raw.includes("[Arreglo / reparación de prenda]");
    const text = raw
        .replace("[Arreglo / reparación de prenda]", "")
        .replace(/^\n+/, "")
        .trim();
    return { isRepair, text };
}

function paymentSeedFromDetalle(
    estadoPago: string | undefined,
    detalle: QuoteOrderPayload["detalle_abono"] | Order["detalle_abono"] | null | undefined
): Pick<
    OrderFormSeed,
    "paymentStatus" | "abonoAmountRaw" | "medioPago" | "conceptoAbono" | "fechaLimiteSaldo"
> {
    const status =
        estadoPago === "parcial" || estadoPago === "pagado" || estadoPago === "no_pagado"
            ? estadoPago
            : "no_pagado";
    return {
        paymentStatus: status,
        abonoAmountRaw:
            status === "parcial" && detalle?.monto_abono != null ? String(detalle.monto_abono) : "",
        medioPago: (detalle?.medio_pago as string) || "",
        conceptoAbono: (detalle?.concepto as string) || "",
        fechaLimiteSaldo: toDateInput(detalle?.fecha_limite_saldo as string | undefined),
    };
}

type RawItem = {
    subproducto_id: string;
    subproducto_nombre?: string | null;
    talla_id?: string | null;
    talla_nombre?: string | null;
    cantidad: number;
    costo_unitario?: string | number | null;
    producto_id?: string | null;
    producto_nombre?: string | null;
    linea_id?: string | null;
    linea_nombre?: string | null;
    color?: string | null;
};

function itemsToProductEntries(
    items: RawItem[],
    options: {
        fallbackProductId: string;
        fallbackProductName: string;
        fallbackColor?: string;
        fallbackEstampado?: string;
        productLabels?: string[];
        totalSale: number;
    }
): OrderProductEntry[] {
    const groups = new Map<string, RawItem[]>();
    for (const item of items) {
        if (!item.subproducto_id || !item.talla_id) continue;
        const list = groups.get(item.subproducto_id) || [];
        list.push(item);
        groups.set(item.subproducto_id, list);
    }

    const totalQty = items.reduce((sum, i) => sum + (Number(i.cantidad) || 0), 0);
    const unitIncome = totalQty > 0 ? options.totalSale / totalQty : 0;
    const labels = options.productLabels || [];
    let labelIdx = 0;

    return [...groups.entries()].map(([variantId, groupItems], index) => {
        const first = groupItems[0];
        const sizeMap = new Map<
            string,
            { talla_id: string; talla_nombre: string; cantidad: number; costo_unitario: number }
        >();
        for (const item of groupItems) {
            const tallaId = String(item.talla_id);
            const existing = sizeMap.get(tallaId);
            const costo = Number(item.costo_unitario) || 0;
            if (existing) {
                existing.cantidad += Number(item.cantidad) || 0;
            } else {
                sizeMap.set(tallaId, {
                    talla_id: tallaId,
                    talla_nombre: (item.talla_nombre || "").trim() || "—",
                    cantidad: Number(item.cantidad) || 0,
                    costo_unitario: costo,
                });
            }
        }
        const size_lines = [...sizeMap.values()];
        const qty = size_lines.reduce((s, l) => s + l.cantidad, 0);
        const costSum = size_lines.reduce((s, l) => s + l.costo_unitario * l.cantidad, 0);
        const label =
            labels[labelIdx++] ||
            first.producto_nombre ||
            first.subproducto_nombre ||
            options.fallbackProductName ||
            `Producto ${index + 1}`;

        return {
            key: `edit-${variantId}-${index}`,
            line_id: first.linea_id || "",
            line_label: first.linea_nombre || "",
            producto_id: first.producto_id || options.fallbackProductId,
            producto_label: first.producto_nombre || options.fallbackProductName || label,
            variant_id: variantId,
            variant_label: first.subproducto_nombre || label,
            color: (first.color || options.fallbackColor || "").trim(),
            estampado: (options.fallbackEstampado || "").trim(),
            comentario: "",
            unit_cost: qty > 0 ? costSum / qty : 0,
            ingreso_proyectado_unitario: Math.round(unitIncome * 100) / 100,
            size_lines,
        };
    });
}

export function seedFromOrder(order: Order): OrderFormSeed {
    const { isRepair, text } = stripRepairTag(order.comentarios);
    const payment = paymentSeedFromDetalle(order.estado_pago, order.detalle_abono);
    const logoPath = order.logo || null;

    return {
        selectedClient: order.cliente_id || "",
        takenBy: order.tomado_por_id || "",
        isRepair,
        productEntries: itemsToProductEntries(order.items || [], {
            fallbackProductId: order.producto_id,
            fallbackProductName: order.producto_nombre,
            fallbackColor: order.color,
            fallbackEstampado: order.estampado,
            totalSale: Number(order.valor_venta_proyectado) || 0,
        }),
        deliveryDate: toDateInput(order.fecha_estimada_entrega),
        ...payment,
        orderComments: text,
        logoPositions: logoPositionsFromFlags(order as unknown as Record<string, unknown>),
        logoPath,
        logoPreviewUrl: resolveMediaUrl(order.logo_url || order.logo),
        quoteStatus: "draft",
        validUntil: new Date().toISOString().split("T")[0],
        purchaseIntention: "50",
    };
}

export function seedFromQuote(quote: Quote): OrderFormSeed {
    const payload = (quote.orderPayload || {}) as QuoteOrderPayload;
    const { isRepair, text } = stripRepairTag(payload.comentarios);
    const payment = paymentSeedFromDetalle(
        quote.paymentStatus || payload.estado_pago,
        payload.detalle_abono
    );
    const editableStatuses = new Set(["draft", "sent", "in_review", "approved", "rejected"]);
    const quoteStatus = editableStatuses.has(quote.status)
        ? (quote.status as OrderFormSeed["quoteStatus"])
        : "draft";

    const items = Array.isArray(payload.items) ? payload.items : [];
    const productEntries = itemsToProductEntries(
        items.map((item) => ({
            ...item,
            subproducto_nombre: undefined,
            talla_nombre: undefined,
            costo_unitario: 0,
            producto_id: payload.producto_id,
            producto_nombre: undefined,
        })),
        {
            fallbackProductId: payload.producto_id || "",
            fallbackProductName: quote.items || "Producto",
            fallbackColor: payload.color,
            fallbackEstampado: payload.estampado,
            productLabels: payload.product_labels,
            totalSale: Number(payload.valor_venta_proyectado ?? quote.totalAmount) || 0,
        }
    );

    return {
        selectedClient: payload.cliente_id || quote.customerId || "",
        takenBy: payload.tomado_por_id || "",
        isRepair,
        productEntries,
        deliveryDate: toDateInput(payload.fecha_estimada_entrega || quote.shippingDate),
        ...payment,
        orderComments: text,
        logoPositions: logoPositionsFromFlags(payload as unknown as Record<string, unknown>),
        logoPath: payload.logo || null,
        logoPreviewUrl: resolveMediaUrl(payload.logo),
        quoteStatus,
        validUntil: toDateInput(quote.validUntil) || new Date().toISOString().split("T")[0],
        purchaseIntention: String(quote.probability ?? 50),
    };
}
