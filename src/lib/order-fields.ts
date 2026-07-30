import { type OrderLogoFields } from "@/hooks/useOrders";

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

/** Info de planta para tarjetas de fábrica / operativo. */
export function resolveFactoryCardInfo(order: {
    color?: string | null;
    estampado?: string | null;
} & Partial<OrderLogoFields>) {
    const color = (order.color || "").trim() || "—";
    const estampado = (order.estampado || "").trim();
    const logoLabels = getActiveLogoLabels(order);
    const hasLogo = logoLabels.length > 0;
    const hasBordado = /bordado/i.test(estampado) || hasLogo;

    let tipoBordado = "—";
    if (hasBordado) {
        if (/bordado/i.test(estampado) && hasLogo) {
            tipoBordado = `Bordado · ${logoLabels.join(", ")}`;
        } else if (/bordado/i.test(estampado)) {
            tipoBordado = estampado;
        } else if (hasLogo) {
            tipoBordado = logoLabels.join(", ");
        } else {
            tipoBordado = estampado || "Bordado";
        }
    }

    return {
        color,
        hasBordado,
        bordadoLabel: hasBordado ? "Sí" : "No",
        tipoBordado,
        estampado: estampado || "—",
    };
}

export function toIsoDeliveryDate(dateStr: string): string {
    if (!dateStr) return "";
    return `${dateStr}T00:00:00Z`;
}
