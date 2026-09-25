import { type OrderLogoFields } from "@/hooks/useOrders";

/** Identificador corto ORD-XXX (misma regla en Órdenes, Despacho y Dashboard). */
export function formatOrderShortId(orderId: string | null | undefined): string {
    const raw = String(orderId || "").trim();
    if (!raw) return "ORD-???";
    return `ORD-${raw.slice(0, 3).toUpperCase()}`;
}

/**
 * Pedido demorado: la fecha estimada de entrega ya pasó (comparación por día local).
 * Sin fecha, no se marca demorado desde este helper.
 */
export function isOrderPastDue(
    fechaEstimadaEntrega: string | null | undefined,
    now: Date = new Date()
): boolean {
    if (!fechaEstimadaEntrega) return false;
    const due = new Date(fechaEstimadaEntrega);
    if (Number.isNaN(due.getTime())) return false;
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return dueDay < today;
}

export const LOGO_POSITION_OPTIONS = [
    { id: "logo_manga_derecha", label: "Mng. Der" },
    { id: "logo_manga_izquierda", label: "Mng. Izq" },
    { id: "logo_delantero_derecha", label: "Delantero Der" },
    { id: "logo_delantero_izquierda", label: "Delantero Izq" },
    { id: "logo_espalda", label: "Espalda" },
    { id: "logo_bolsillo", label: "Bolsillo" },
] as const;

export type LogoPositionKey = (typeof LOGO_POSITION_OPTIONS)[number]["id"];

export function buildLogoFields(selected: LogoPositionKey[]): OrderLogoFields {
    const set = new Set(selected);
    return {
        logo_manga_derecha: set.has("logo_manga_derecha"),
        logo_manga_izquierda: set.has("logo_manga_izquierda"),
        logo_delantero_derecha: set.has("logo_delantero_derecha"),
        logo_delantero_izquierda: set.has("logo_delantero_izquierda"),
        logo_espalda: set.has("logo_espalda"),
        logo_bolsillo: set.has("logo_bolsillo"),
    };
}

export function getActiveLogoLabels(order: Partial<OrderLogoFields>): string[] {
    return LOGO_POSITION_OPTIONS.filter((pos) => order[pos.id]).map((pos) => pos.label);
}

export interface FactoryVariantRow {
    variantId: string;
    linea: string;
    producto: string;
    variante: string;
    color: string;
    cantidad: number;
    tallas: { nombre: string; cantidad: number }[];
}

/** Línea de artículo para el diálogo de detalle (una fila por talla). */
export interface ArticleDetailLine {
    key: string;
    variantId: string;
    tallaId?: string | null;
    productType: string;
    variation: string;
    material: string;
    size: string;
    color: string;
    print: string;
    observacionEstampado?: string;
    quantity: number;
    unitCost: number | null;
}

type ArticleSourceItem = {
    subproducto_id: string;
    subproducto_nombre?: string | null;
    talla_id?: string | null;
    talla_nombre?: string | null;
    cantidad: number;
    costo_unitario?: string | number | null;
    producto_nombre?: string | null;
    linea_nombre?: string | null;
    color?: string | null;
    estampado?: string | null;
    observacion_estampado?: string | null;
};

/** Convierte ítems de orden/cotización a líneas de detalle (una por talla). */
export function itemsToArticleDetailLines(
    items: ArticleSourceItem[],
    options?: {
        fallbackColor?: string | null;
        fallbackProduct?: string | null;
        estampado?: string | null;
        productLabels?: string[];
    }
): ArticleDetailLine[] {
    const fallbackColor = (options?.fallbackColor || "").trim();
    const fallbackProduct = (options?.fallbackProduct || "").trim();
    const fallbackPrint = (options?.estampado || "").trim() || "—";
    const labels = options?.productLabels || [];

    return (items || []).map((item, idx) => {
        const qty = Number(item.cantidad) || 0;
        const rawCost = item.costo_unitario;
        const unitCost =
            rawCost == null || rawCost === ""
                ? null
                : Number(rawCost);
        const product =
            (item.producto_nombre || "").trim() ||
            labels[0] ||
            fallbackProduct ||
            "Artículo";
        const variation =
            (item.subproducto_nombre || "").trim() ||
            labels[idx] ||
            labels.find(Boolean) ||
            "—";
        const color = (item.color || "").trim() || fallbackColor || "—";
        const size = (item.talla_nombre || "").trim() || "—";
        const material = (item.linea_nombre || "").trim() || "—";
        const print = (item.estampado || "").trim() || fallbackPrint;
        const observacionEstampado = (item.observacion_estampado || "").trim() || undefined;
        const variantId = item.subproducto_id;

        return {
            key: `${variantId}-${item.talla_id || size}-${idx}`,
            variantId,
            tallaId: item.talla_id ?? null,
            productType: product,
            variation,
            material,
            size,
            color,
            print,
            observacionEstampado,
            quantity: qty,
            unitCost: unitCost != null && Number.isFinite(unitCost) ? unitCost : null,
        };
    });
}

/** Agrupa ítems de orden por variante con cantidad total y desglose de tallas. */
export function groupOrderItemsForFactory(
    items: Array<{
        subproducto_id: string;
        subproducto_nombre?: string | null;
        talla_nombre?: string | null;
        cantidad: number;
        producto_nombre?: string | null;
        linea_nombre?: string | null;
        color?: string | null;
    }>,
    options?: { fallbackColor?: string | null }
): FactoryVariantRow[] {
    const map = new Map<string, FactoryVariantRow>();
    const fallbackColor = (options?.fallbackColor || "").trim();

    for (const item of items || []) {
        const id = item.subproducto_id;
        const tallaNombre = (item.talla_nombre || "—").trim() || "—";
        const existing = map.get(id);
        const itemColor = (item.color || "").trim() || fallbackColor || "—";

        if (!existing) {
            map.set(id, {
                variantId: id,
                linea: (item.linea_nombre || "").trim() || "—",
                producto: (item.producto_nombre || "").trim() || "—",
                variante: (item.subproducto_nombre || "").trim() || "—",
                color: itemColor,
                cantidad: Number(item.cantidad) || 0,
                tallas: [{ nombre: tallaNombre, cantidad: Number(item.cantidad) || 0 }],
            });
            continue;
        }

        if ((!existing.color || existing.color === "—") && itemColor !== "—") {
            existing.color = itemColor;
        }
        existing.cantidad += Number(item.cantidad) || 0;
        const tallaRow = existing.tallas.find((t) => t.nombre === tallaNombre);
        if (tallaRow) {
            tallaRow.cantidad += Number(item.cantidad) || 0;
        } else {
            existing.tallas.push({
                nombre: tallaNombre,
                cantidad: Number(item.cantidad) || 0,
            });
        }
    }

    return [...map.values()];
}

/** Resumen compacto para la columna Artículos de la tabla de órdenes. */
export function summarizeOrderArticles(
    items: Parameters<typeof groupOrderItemsForFactory>[0],
    options?: { fallbackColor?: string | null; fallbackProduct?: string | null }
): {
    lines: { title: string; meta: string; qty: number }[];
    plainText: string;
} {
    const groups = groupOrderItemsForFactory(items, {
        fallbackColor: options?.fallbackColor,
    });

    if (!groups.length) {
        const fallback = (options?.fallbackProduct || "").trim();
        return {
            lines: fallback
                ? [{ title: fallback, meta: "Sin desglose de variantes", qty: 0 }]
                : [],
            plainText: fallback || "",
        };
    }

    // Con 2+ variantes: solo línea + producto/variante (sin tallas; la tabla se ve saturada)
    const omitSizes = groups.length >= 2;

    const lines = groups.map((g) => {
        const linea = g.linea !== "—" ? g.linea : "";
        const product = g.producto !== "—" ? g.producto : "";
        const variant = g.variante !== "—" ? g.variante : "";

        const titleParts: string[] = [];
        if (omitSizes && linea) titleParts.push(linea);
        if (product) titleParts.push(product);
        if (variant && variant !== product) titleParts.push(variant);
        // Evitar "X · X" si producto y línea coinciden
        const title =
            titleParts.filter((p, i, arr) => i === 0 || p !== arr[i - 1]).join(" · ") ||
            "Artículo";

        const parts: string[] = [];
        if (!omitSizes) {
            const sizes = g.tallas
                .filter((t) => t.nombre && t.nombre !== "—")
                .map((t) => {
                    const clean = t.nombre.trim();
                    const label = /^talla\b/i.test(clean) ? clean : `Talla ${clean}`;
                    return `${label}: ${t.cantidad}`;
                })
                .join(", ");
            if (sizes) parts.push(sizes);
        }
        parts.push(`${g.cantidad} uds`);

        return { title, meta: parts.join(" · "), qty: g.cantidad };
    });

    const plainText = lines.map((l) => `${l.title} (${l.meta})`).join(" | ");
    return { lines, plainText };
}

/** Convierte ítems de cotización (order_payload) a filas de detalle de artículos. */
export function quotePayloadToArticleVariants(
    payload?: {
        items?: Array<{
            subproducto_id: string;
            talla_id?: string;
            cantidad: number;
            color?: string;
            subproducto_nombre?: string;
            producto_nombre?: string;
            linea_nombre?: string;
            talla_nombre?: string;
        }>;
        product_labels?: string[];
        color?: string | null;
    } | null
): FactoryVariantRow[] {
    if (!payload?.items?.length) return [];

    const labels = payload.product_labels || [];
    return groupOrderItemsForFactory(
        payload.items.map((item, idx) => ({
            subproducto_id: item.subproducto_id,
            subproducto_nombre:
                item.subproducto_nombre ||
                labels[idx] ||
                labels.find(Boolean) ||
                "Variante",
            producto_nombre: item.producto_nombre || labels[0] || undefined,
            linea_nombre: item.linea_nombre,
            talla_nombre: item.talla_nombre || undefined,
            cantidad: item.cantidad,
            color: item.color,
        })),
        { fallbackColor: payload.color }
    );
}

/** Líneas de detalle de artículos desde el payload de cotización. */
export function quotePayloadToArticleLines(
    payload?: {
        items?: ArticleSourceItem[];
        product_labels?: string[];
        color?: string | null;
        estampado?: string | null;
        producto_nombre?: string | null;
    } | null
): ArticleDetailLine[] {
    if (!payload?.items?.length) return [];
    return itemsToArticleDetailLines(payload.items, {
        fallbackColor: payload.color,
        fallbackProduct: payload.producto_nombre,
        estampado: payload.estampado,
        productLabels: payload.product_labels,
    });
}

/** Info de planta para tarjetas de fábrica / operativo. */
export function resolveFactoryCardInfo(order: {
    color?: string | null;
    estampado?: string | null;
    observacion_estampado?: string | null;
    observacion_bordado?: string | null;
    comentarios?: string | null;
    items?: Array<{
        estampado?: string | null;
        observacion_estampado?: string | null;
        observacion?: string | null;
        comentario?: string | null;
    }>;
} & Partial<OrderLogoFields>) {
    const color = (order.color || "").trim() || "—";
    const rawEstampado = (order.estampado || "").trim();

    // Extraer tokens de personalización de la orden e items
    const rawTokens: string[] = [];
    if (rawEstampado && !/^sin\s+/i.test(rawEstampado) && rawEstampado !== "—") {
        rawEstampado.split(/[,/|;]+/).forEach((t) => {
            const clean = t.trim();
            if (clean && !/^sin\s+/i.test(clean) && clean !== "—") rawTokens.push(clean);
        });
    }
    (order.items || []).forEach((it) => {
        const est = (it.estampado || "").trim();
        if (est && !/^sin\s+/i.test(est) && est !== "—") {
            est.split(/[,/|;]+/).forEach((t) => {
                const clean = t.trim();
                if (clean && !/^sin\s+/i.test(clean) && clean !== "—" && !rawTokens.includes(clean)) {
                    rawTokens.push(clean);
                }
            });
        }
    });

    const logoLabels = getActiveLogoLabels(order);
    const hasLogo = logoLabels.length > 0;
    const hasBordado = rawTokens.some((t) => /borda/i.test(t)) || /bordado/i.test(rawEstampado) || hasLogo;
    const hasSerigrafia = rawTokens.some((t) => /serigraf[ií]a/i.test(t)) || /serigraf[ií]a/i.test(rawEstampado);
    const hasTransfer = rawTokens.some((t) => /transfer/i.test(t)) || /transfer/i.test(rawEstampado);
    const hasSublimado = rawTokens.some((t) => /sublima/i.test(t)) || /sublima/i.test(rawEstampado);
    const hasEstampado = hasSerigrafia || hasTransfer || hasSublimado || (/estampa/i.test(rawEstampado) && !/^sin\s+estampa/i.test(rawEstampado)) || (rawTokens.length > 0 && !hasBordado);

    let tipoBordado = "—";
    if (rawTokens.length > 0 || hasLogo) {
        const parts: string[] = [];
        rawTokens.forEach((t) => {
            if (/borda/i.test(t) && hasLogo) {
                parts.push(`Bordado (${logoLabels.join(", ")})`);
            } else {
                parts.push(t);
            }
        });
        if (hasLogo && !rawTokens.some((t) => /borda/i.test(t))) {
            parts.push(`Bordado (${logoLabels.join(", ")})`);
        }
        tipoBordado = parts.join(", ") || rawEstampado || "Bordado";
    } else if (hasBordado) {
        if (/bordado/i.test(rawEstampado) && hasLogo) {
            tipoBordado = `Bordado · ${logoLabels.join(", ")}`;
        } else if (/bordado/i.test(rawEstampado)) {
            tipoBordado = rawEstampado;
        } else if (hasLogo) {
            tipoBordado = logoLabels.join(", ");
        } else {
            tipoBordado = rawEstampado || "Bordado";
        }
    }

    const itemObs = (order.items || [])
        .map((i) => (i.observacion_estampado || i.observacion || i.comentario || "").trim())
        .filter(Boolean);
    const orderObs = (
        order.observacion_estampado ||
        order.observacion_bordado ||
        ""
    ).trim();

    // Extraer también si en comentarios hay un tag [Bordado/Estampado: ...]
    let commentObs = "";
    if (order.comentarios) {
        const match = order.comentarios.match(/\[(?:Bordado\/Estampado|Obs\.?\s*bordado|Estampado):\s*([^\]]+)\]/i);
        if (match) commentObs = match[1].trim();
    }

    const observacionBordado = orderObs || commentObs || (itemObs.length > 0 ? itemObs.join(" · ") : "");

    return {
        color,
        hasBordado,
        hasEstampado,
        hasSerigrafia,
        hasTransfer,
        hasSublimado,
        personalizationTypes: rawTokens,
        bordadoLabel: hasBordado ? "Sí" : "No",
        tipoBordado,
        estampado: rawTokens.join(", ") || rawEstampado || "—",
        observacionBordado,
    };
}

export function toIsoDeliveryDate(dateStr: string): string {
    if (!dateStr) return "";
    return `${dateStr}T00:00:00Z`;
}
