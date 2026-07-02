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

export function toIsoDeliveryDate(dateStr: string): string {
    if (!dateStr) return "";
    return `${dateStr}T00:00:00Z`;
}
