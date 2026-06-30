import { getApiBaseUrl } from "@/lib/api-base";

const base = () => getApiBaseUrl();

export const endpoints = {
    lineas: {
        list: () => `${base()}/api/v1/products/lineas/`,
        detail: (id: string) => `${base()}/api/v1/products/lineas/${id}/`,
        productos: (lineId: string) => `${base()}/api/v1/products/lineas/${lineId}/productos/`,
    },
    productos: {
        detail: (id: string) => `${base()}/api/v1/products/productos/${id}/`,
        variantes: (productId: string) => `${base()}/api/v1/products/productos/${productId}/variantes/`,
    },
    costos: {
        proveedores: () => `${base()}/api/v1/costos/proveedores/`,
        tallas: () => `${base()}/api/v1/costos/tallas/`,
        tiposInsumo: () => `${base()}/api/v1/costos/insumos-tipo/`,
        fasesManoDeObra: () => `${base()}/api/v1/costos/fases-mano-de-obra/`,
        tela: () => `${base()}/api/v1/costos/tela/`,
        telaByVariant: (variantId: string) => `${base()}/api/v1/costos/tela/${variantId}/`,
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
};
