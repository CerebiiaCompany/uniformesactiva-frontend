export type TallaGenero = "hombre" | "mujer";

export interface CatalogOption {
    id: string;
    code?: string;
    name: string;
    label?: string;
    genero?: TallaGenero;
    categoria?: string;
    unidad_medida?: string;
    precio_unitario_default?: number | string | null;
    codigo_sku?: string;
    proveedor_marca?: string;
    color?: string;
    stock_minimo?: number | string | null;
    stock_inicial?: number | string | null;
}

export interface Proveedor {
    id: string;
    name: string;
}

export interface ProductVariant {
    id: string;
    code: string;
    name: string;
    product_id?: string;
    estimated_cost?: string | number;
}

export interface SizeFabric {
    id: string;
    variant_id: string;
    size_id: string;
    consumption: string;
    size_label?: string;
}

export interface FabricRecord {
    id: string;
    variant_id: string;
    proveedor_id: string;
    proveedor_nombre?: string;
    reference: string;
    meters: string;
    price_per_meter: string;
    tiene_iva: boolean;
    es_principal: boolean;
    total: string;
}

export interface SupplyRecord {
    id: string;
    variant_id: string;
    tipo: string;
    tipo_id?: string;
    tipo_label?: string;
    talla_id?: string | null;
    talla_nombre?: string | null;
    quantity: string;
    unit_price: string;
    total: string;
}

export interface LaborPhase {
    id: string;
    variant_id: string;
    fase: string;
    fase_id?: string;
    fase_label?: string;
    talla_id?: string | null;
    talla_nombre?: string | null;
    cantidad: string;
    unit_price: string;
    total: string;
}

export interface VariantSizeCostSummary {
    talla_id: string;
    talla_nombre: string;
    consumption: string | number;
    fabric_total: string | number;
    supplies_total: string | number;
    labor_total: string | number;
    overall_total: string | number;
    precio_venta?: string | number | null;
    ganancia?: string | number | null;
}

export interface VariantCostSummary {
    variant_id?: string;
    average_consumption?: string | number;
    fabric_price_per_meter?: string | number;
    fabric_total: string | number;
    supplies_total: string | number;
    labor_total: string | number;
    overall_total: string | number;
    sizes?: VariantSizeCostSummary[];
}

export interface CreateFabricPayload {
    variant_id: string;
    proveedor_id?: string;
    reference: string;
    meters: string | number;
    price_per_meter: string | number;
    tiene_iva?: boolean;
    es_principal?: boolean;
}

export interface UpdateFabricPayload {
    proveedor_id?: string;
    reference?: string;
    meters?: string | number;
    price_per_meter?: string | number;
    tiene_iva?: boolean;
    es_principal?: boolean;
}

export interface CreateSupplyPayload {
    variant_id: string;
    tipo_id: string;
    talla_id?: string | null;
    quantity: string | number;
    unit_price: string | number;
}

export interface UpdateSupplyPayload {
    tipo_id?: string;
    talla_id?: string | null;
    quantity?: string | number;
    unit_price?: string | number;
}

export interface CreateLaborPayload {
    variant_id: string;
    fase_id: string;
    talla_id?: string | null;
    cantidad: string | number;
    unit_price: string | number;
}

export interface UpdateLaborPayload {
    fase_id?: string;
    talla_id?: string | null;
    cantidad?: string | number;
    unit_price?: string | number;
}

export interface CreateSizeConsumptionPayload {
    variant_id: string;
    talla_id: string;
    consumption: string | number;
    precio_venta?: string | number | null;
}

export interface UpdateSizeConsumptionPayload {
    talla_id?: string;
    consumption?: string | number;
    precio_venta?: string | number | null;
}

export interface CreateVariantPayload {
    name: string;
    code: string;
}
