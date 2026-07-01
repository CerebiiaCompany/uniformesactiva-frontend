export interface CatalogOption {
    id: string;
    code?: string;
    name: string;
    label?: string;
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
    cantidad: string;
    unit_price: string;
    total: string;
}

export interface VariantCostSummary {
    variant_id?: string;
    average_consumption?: string | number;
    fabric_price_per_meter?: string | number;
    fabric_total: string | number;
    supplies_total: string | number;
    labor_total: string | number;
    overall_total: string | number;
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
    quantity: string | number;
    unit_price: string | number;
}

export interface UpdateSupplyPayload {
    tipo_id?: string;
    quantity?: string | number;
    unit_price?: string | number;
}

export interface CreateLaborPayload {
    variant_id: string;
    fase_id: string;
    cantidad: string | number;
    unit_price: string | number;
}

export interface CreateSizeConsumptionPayload {
    variant_id: string;
    talla_id: string;
    consumption: string | number;
}

export interface UpdateSizeConsumptionPayload {
    talla_id?: string;
    consumption?: string | number;
}

export interface CreateVariantPayload {
    name: string;
    code: string;
}
