import { getApiBaseUrl } from "@/lib/api-base";

const base = () => getApiBaseUrl();

export const endpoints = {
    clients: {
        list: () => `${base()}/api/v1/clients/`,
    },
    costos: {
        proveedores: () => `${base()}/api/v1/costos/proveedores/`,
        tallas: () => `${base()}/api/v1/costos/tallas/`,
        tiposInsumo: () => `${base()}/api/v1/costos/insumos-tipo/`,
        fasesManoDeObra: () => `${base()}/api/v1/costos/fases-mano-de-obra/`,
        tela: () => `${base()}/api/v1/costos/tela/`,
        telaByVariant: (variantId: string) => `${base()}/api/v1/costos/tela/${variantId}/`,
        telaDetalle: (id: string) => `${base()}/api/v1/costos/tela/detalle/${id}/`,
        tallasConsumo: () => `${base()}/api/v1/costos/tallas-consumo/`,
        tallasConsumoByVariant: (variantId: string) =>
            `${base()}/api/v1/costos/tallas-consumo/${variantId}/`,
        tallasConsumoDetalle: (id: string) =>
            `${base()}/api/v1/costos/tallas-consumo/detalle/${id}/`,
        insumos: () => `${base()}/api/v1/costos/insumos/`,
        insumosByVariant: (variantId: string) => `${base()}/api/v1/costos/insumos/${variantId}/`,
        insumosDetalle: (id: string) => `${base()}/api/v1/costos/insumos/detalle/${id}/`,
        manoDeObra: () => `${base()}/api/v1/costos/mano-de-obra/`,
        manoDeObraByVariant: (variantId: string) =>
            `${base()}/api/v1/costos/mano-de-obra/${variantId}/`,
        manoDeObraDetalle: (id: string) => `${base()}/api/v1/costos/mano-de-obra/detalle/${id}/`,
        resumenByVariant: (variantId: string) =>
            `${base()}/api/v1/costos/variante/${variantId}/resumen/`,
    },
    inventory: {
        list: (params?: string) => `${base()}/api/v1/inventory/${params ? `?${params}` : ''}`,
        create: () => `${base()}/api/v1/inventory/`,
        addStock: (id: string) => `${base()}/api/v1/inventory/${id}/add-stock/`,
    },
    lineas: {
        list: () => `${base()}/api/v1/products/lineas/`,
        detail: (id: string) => `${base()}/api/v1/products/lineas/${id}/`,
        productos: (lineId: string) => `${base()}/api/v1/products/lineas/${lineId}/productos/`,
    },
    orders: {
        list: () => `${base()}/api/v1/orders/`,
        detail: (orderId: string) => `${base()}/api/v1/orders/${orderId}/`,
        estado: (orderId: string) => `${base()}/api/v1/orders/${orderId}/estado/`,
        valorVenta: (orderId: string) => `${base()}/api/v1/orders/${orderId}/valor-venta/`,
        comentarios: (orderId: string) => `${base()}/api/v1/orders/${orderId}/comentarios/`,
        pago: (orderId: string) => `${base()}/api/v1/orders/${orderId}/pago/`,
        uploadLogo: () => `${base()}/api/v1/orders/upload-logo/`,
        logs: (orderId: string) => `${base()}/api/v1/orders/${orderId}/logs/`,
        etapa: (orderId: string) => `${base()}/api/v1/orders/${orderId}/etapa/`,
        etapas: (orderId: string) => `${base()}/api/v1/orders/${orderId}/etapas/`,
        kanbanEtapas: () => `${base()}/api/v1/orders/kanban-etapas/`,
        kanbanEtapa: (etapaId: string) => `${base()}/api/v1/orders/kanban-etapas/${etapaId}/`,
        kanbanEtapasReorder: () => `${base()}/api/v1/orders/kanban-etapas/reorder/`,
    },
    dashboard: {
        stats: () => `${base()}/api/v1/dashboard/`,
    },
    productos: {
        list: () => `${base()}/api/v1/products/productos/`,
        detail: (id: string) => `${base()}/api/v1/products/productos/${id}/`,
        variantes: (productId: string) => `${base()}/api/v1/products/productos/${productId}/variantes/`,
    },
    quotes: {
        list: () => `${base()}/api/v1/quotes/quotes/`,
        detail: (id: string) => `${base()}/api/v1/quotes/quotes/${id}/`,
        status: (id: string) => `${base()}/api/v1/quotes/quotes/${id}/status/`,
        convert: (id: string) => `${base()}/api/v1/quotes/quotes/${id}/convert/`,
        markOrdered: (id: string) => `${base()}/api/v1/quotes/quotes/${id}/mark-ordered/`,
        placeOrder: (id: string) => `${base()}/api/v1/quotes/quotes/${id}/place-order/`,
        novedades: (id: string) => `${base()}/api/v1/quotes/quotes/${id}/novedades/`,
        pago: (id: string) => `${base()}/api/v1/quotes/quotes/${id}/pago/`,
    },
    users: {
        list: () => `${base()}/api/v1/users/`,
    },
};