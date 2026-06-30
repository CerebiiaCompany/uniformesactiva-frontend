export interface SizeFabric {
    id: string;
    variant_id: string;
    size_id: string;
    consumption: string;
}

export interface FabricRecord {
    id: string;
    variant_id: string;
    provider: string;
    reference: string;
    meters: string;
    price_per_meter: string;
    total: string;
}

export interface SupplyRecord {
    id: string;
    variant_id: string;
    description: string;
    quantity: string;
    unit_price: string;
    total: string;
}

export interface LaborPhase {
    id: string;
    variant_id: string;
    activity_name: string;
    unit_price: string;
    total: string;
}

export interface VariantCostData {
    sizeFabric: SizeFabric[];
    fabrics: FabricRecord[];
    supplies: SupplyRecord[];
    labor: LaborPhase[];
}

export interface CreateFabricPayload {
    variant_id: string;
    provider: string;
    reference: string;
    meters: string | number;
    price_per_meter: string | number;
}

export interface CreateSupplyPayload {
    variant_id: string;
    description: string;
    quantity: string | number;
    unit_price: string | number;
}

export interface CreateLaborPayload {
    variant_id: string;
    activity_name: string;
    unit_price: string | number;
}

export interface CreateSizeConsumptionPayload {
    variant_id: string;
    size_id: string;
    consumption: string | number;
}