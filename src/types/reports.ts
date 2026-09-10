export interface OrdersReportSummary {
  total_ordenes: number;
  ordenes_activas: number;
  total_prendas: number;
  venta_total: number;
  pendientes_pago: number;
}

export interface OrdersReportRow {
  id: string;
  codigo: string;
  cliente: string;
  prendas: string;
  estado: string;
  estado_label: string;
  etapa: string;
  etapa_label: string;
  fecha_creacion: string | null;
  fecha_entrega: string | null;
  responsable: string | null;
  pago: string;
  pago_label: string;
  cantidad: number;
  venta: number;
}

export interface OrdersReportResponse {
  status: boolean;
  summary: OrdersReportSummary;
  rows: OrdersReportRow[];
}

export interface ReportCardDefinition {
  id: string;
  title: string;
  description: string;
  countLabel?: string;
  route?: string;
  disabled?: boolean;
}

export interface SalesReportSummary {
  ventas_totales: number;
  utilidad_estimada: number;
  ticket_promedio: number;
  total_ordenes: number;
  total_prendas: number;
  cotizaciones_total: number;
  cotizaciones_aprobadas: number;
}

export interface SalesReportRow {
  client_id: string;
  cliente: string;
  ciudad: string;
  ordenes: number;
  cotizaciones: number;
  cotizaciones_aprobadas: number;
  prendas: number;
  ventas: number;
  costo: number;
  utilidad: number;
  participacion_pct: number;
  ultima_orden: string | null;
}

export interface SalesReportResponse {
  status: boolean;
  summary: SalesReportSummary;
  rows: SalesReportRow[];
}

export interface ProfitabilityReportSummary {
  venta_total: number;
  costo_total: number;
  utilidad: number;
  margen_promedio: number;
  total_ordenes: number;
}

export interface ProfitabilityReportRow {
  id: string;
  codigo: string;
  cliente: string;
  estado: string;
  cantidad: number;
  costo_estimado: number;
  venta: number;
  utilidad: number;
  margen_pct: number;
  costo_unitario: number;
  venta_unitario: number;
}

export interface ProfitabilityReportResponse {
  status: boolean;
  summary: ProfitabilityReportSummary;
  rows: ProfitabilityReportRow[];
}

export interface ProductivityReportSummary {
  tarjetas_activas: number;
  retrasadas: number;
  dias_promedio_etapa: number;
  prendas_en_proceso: number;
}

export interface ProductivityReportRow {
  id: string;
  tarjeta: string;
  orden: string;
  orden_id: string;
  cliente: string;
  etapa: string;
  etapa_label: string;
  responsable: string;
  cantidad: number;
  dias_en_etapa: number;
  fecha_entrega: string | null;
  retrasada: boolean;
  estado_label: string;
}

export interface ProductivityReportResponse {
  status: boolean;
  summary: ProductivityReportSummary;
  rows: ProductivityReportRow[];
}

export interface QuotesReportSummary {
  cotizaciones_total: number;
  monto_total: number;
  pipeline_ponderado: number;
  cotizaciones_aprobadas: number;
}

export interface QuotesReportRow {
  id: string;
  codigo: string;
  cliente: string;
  items: string;
  estado: string;
  estado_label: string;
  tomado_por: string | null;
  fecha_creacion: string | null;
  fecha_envio: string | null;
  vigente_hasta: string | null;
  novedades: number;
  probabilidad: number;
  monto: number;
}

export interface QuotesReportResponse {
  status: boolean;
  summary: QuotesReportSummary;
  rows: QuotesReportRow[];
}

export interface InventoryReportSummary {
  materiales_total: number;
  valor_inventario: number;
  stock_bajo: number;
  movimientos_total: number;
  tns_disponible?: boolean;
  tns_total?: number;
  mensaje?: string;
}

export interface InventoryReportRow {
  id: string;
  codigo: string;
  material: string;
  categoria: string;
  unidad: string;
  stock: number;
  minimo: number;
  costo_unitario: number;
  valor: number;
  proveedores: number;
  proveedor_ref: string;
  estado: string;
  stock_bajo: boolean;
}

export interface InventoryReportResponse {
  status: boolean;
  source?: "tns" | "local";
  summary: InventoryReportSummary;
  rows: InventoryReportRow[];
}

export interface PurchasesReportSummary {
  proveedores_total: number;
  compras_registradas: number;
  monto_comprado: number;
  materiales_distintos: number;
  tns_disponible?: boolean;
  compras_total?: number;
  mensaje?: string;
}

export interface PurchasesReportRow {
  id: string;
  proveedor: string;
  nit?: string | null;
  materiales: number;
  entradas: number;
  cantidad: number;
  monto: number;
  participacion_pct: number;
  ultima_compra: string | null;
}

export interface PurchasesReportResponse {
  status: boolean;
  source?: "tns";
  summary: PurchasesReportSummary;
  rows: PurchasesReportRow[];
}
