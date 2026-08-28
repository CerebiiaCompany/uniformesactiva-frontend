export interface DetallePedidoCompra {
  id?: string | number;
  deKardexId?: number;
  codMat?: string;
  nomMat?: string;
  cantidad?: number;
  cantDespachada?: number;
  cantSaldo?: number;
  valorUnitario?: number;
  valorTotal?: number;
  observacionDetalle?: string;

  // Alias / compatibilidad estándar
  item?: string;
  codigo?: string;
  descripcion?: string;
  unidad?: string;
  cantidad_recibida?: number;
  cantidad_pendiente?: number;
  cantidad_facturada?: number;
  valor_unitario?: number;
  porcentaje_iva?: number;
  valor_iva?: number;
  valor_total?: number;
  descuento?: number;
  observaciones?: string;

  // Campos en formato TNS directo (mayúsculas)
  ITEM?: string;
  CODIGO?: string;
  DESCRIP?: string;
  UNIDAD?: string;
  CANTIDAD?: number;
  CANTREC?: number;
  CANTPEN?: number;
  CANTFAC?: number;
  VALUNIT?: number;
  PORCIVA?: number;
  VALORIVA?: number;
  VALOR?: number;
  VALORTOT?: number;
  DESCUENTO?: number;
}

export interface PedidoCompra {
  id?: string | number;
  kardexId?: number;
  numero?: string;
  fecha?: string; // Formato DD/MM/YYYY o ISO
  fechaAsentado?: string;
  estado?: string; // "PENDIENTE" | "APROBADO" | "CERRADO" | "ANULADO" | etc.
  codTercero?: string;
  nomTercero?: string;
  nitTercero?: string;
  dirTercero?: string;
  telefono?: string;
  observacion?: string;
  detalles?: DetallePedidoCompra[];

  // Alias / compatibilidad estándar
  numero_documento?: string;
  prefijo?: string;
  consecutivo?: string | number;
  fecha_entrega?: string;
  fecha_vencimiento?: string;
  tercero_id?: string;
  tercero_nit?: string;
  tercero_nombre?: string;
  proveedor?: string;
  descripcion?: string;
  observaciones?: string;
  forma_pago?: string;
  plazo_dias?: number;
  valor_subtotal?: number;
  valor_descuento?: number;
  valor_iva?: number;
  valor_total?: number;
  items?: DetallePedidoCompra[];
  total_items?: number;

  // Campos en formato TNS directo (mayúsculas)
  NUMDOC?: string;
  PREFIJO?: string;
  CONSECUTIVO?: string | number;
  FECHA?: string;
  FECHAENT?: string;
  FECHAVEN?: string;
  TERCERO?: string;
  NIT?: string;
  RAZONSOCIAL?: string;
  PROVEEDOR?: string;
  DETALLE?: string;
  OBSERVACION?: string;
  ESTADO?: string;
  FORMAPAGO?: string;
  SUBTOTAL?: number;
  DESCTO?: number;
  IVA?: number;
  VALOR?: number;
  TOTAL?: number;
  ITEMS?: DetallePedidoCompra[];
}

export interface PedidosCompraFilters {
  fecha_inicio?: string; // YYYY-MM-DD o DD/MM/YYYY
  fecha_fin?: string; // YYYY-MM-DD o DD/MM/YYYY
  proveedor?: string;
  tercero?: string;
  numero_documento?: string;
  numdoc?: string;
  estado?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface PedidosCompraResponse {
  status?: boolean;
  message?: string | null;
  data?: PedidoCompra[];
  items?: PedidoCompra[];
  results?: PedidoCompra[];
  pedidos?: PedidoCompra[];
  total_count?: number;
  count?: number;
  total?: number;
}

// ----------------------------------------------------
// Tipos para Inventario TNS en Tiempo Real
// ----------------------------------------------------

export interface TNSProveedorOferta {
  nit: string;
  nombre: string;
  ultima_compra?: string;
  ultimo_costo_unitario?: number;
  num_factura?: string;
}

export interface TNSInventarioItem {
  nit_Distribuidor: string;
  inventario_Fecha: string;
  prod_Dist_Cod: string;
  prod_Dist_Desc: string;
  prod_Prov_Cod: string;
  prd_UnidadInventario: string;
  cant_Disponible: string | number;
  cant_Stock: string | number;
  costo_Disponible: string | number;
  costo_Stock: string | number;
  prov_Cod?: string;
  bodega_Cod: string;
  bodega_Desc: string;
  agencia_Cod?: string;
  agencia_Desc?: string;
  inventario_Estado: 'Activo' | 'Inactivo' | string;

  // Nuevos campos enriquecidos de compras y proveedores:
  proveedor_principal?: string;
  proveedor_nit?: string;
  ultima_compra_fecha?: string | null;
  ultimo_costo_compra?: number | null;
  proveedores?: TNSProveedorOferta[];
}

export interface TNSCompraItem {
  codtercero: string;
  nomtercero: string;
  numfactura: string;
  fechafactu: string;
  codarticulo: string;
  descriparticulo: string;
  nomgrupoarticulo: string;
  unidad: string;
  cantidad: string;
  valorbase: string;
  valoriva: string;
  neto: string;
  costoprome: string;
}

export interface TNSMaterialComprasHistorialResponse {
  status?: boolean;
  codigo_articulo: string;
  proveedor_principal: string;
  proveedor_nit?: string;
  ultima_compra_fecha?: string | null;
  ultimo_costo_unitario?: number;
  proveedores: TNSProveedorOferta[];
  compras_historial: TNSCompraItem[];
  total_compras: number;
}

export interface BodegaDistribucion {
  bodega_cod: string;
  bodega_desc: string;
  total_items: number;
  total_stock: number;
  total_costo: number;
}

export interface UnidadDistribucion {
  unidad: string;
  total_items: number;
  total_stock: number;
}

export interface TopProductoInventario {
  codigo: string;
  descripcion: string;
  unidad: string;
  bodega_cod: string;
  bodega_desc: string;
  estado: string;
  cant_stock: number;
  cant_disponible: number;
  costo_stock: number;
  costo_disponible: number;
  fecha_reporte?: string;
}

export interface TNSInventarioSummary {
  total_registros: number;
  activos: number;
  inactivos: number;
  con_stock: number;
  sin_stock: number;
  stock_bajo_count: number;
  stock_alto_count: number;
  total_stock_cantidad: number;
  total_disponible_cantidad: number;
  total_costo_stock: number;
  total_costo_disponible: number;
  distribucion_bodegas: BodegaDistribucion[];
  distribucion_unidades: UnidadDistribucion[];
  top_stock_alto: TopProductoInventario[];
  top_stock_bajo: TopProductoInventario[];
  top_mayor_valor: TopProductoInventario[];
  muestra_agotados: TopProductoInventario[];
  timestamp?: string;
}

export interface TNSInventarioParams {
  search?: string;
  color?: string;
  bodega?: string;
  estado?: 'Activo' | 'Inactivo' | 'TODOS' | string;
  stock_status?: 'con_stock' | 'agotado' | 'stock_bajo' | 'stock_alto' | 'todos' | string;
  ordenar_por?: 'stock_desc' | 'stock_asc' | 'costo_desc' | 'costo_asc' | 'nombre_asc' | 'codigo_asc' | string;
  page?: number;
  page_size?: number;
  force_refresh?: boolean;
}

export interface TNSInventarioResponse {
  status?: boolean;
  message?: string | null;
  data: TNSInventarioItem[];
  total_count: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
  summary?: TNSInventarioSummary;
}

export interface TNSVentaItem {
  codtercero?: string;
  nomtercero?: string;
  nomcliente?: string;
  cliente?: string;
  nombre_cliente?: string;
  numfactura?: string;
  fechafactu?: string;
  fecha?: string;
  codarticulo?: string;
  descriparticulo?: string;
  nomgrupoarticulo?: string;
  unidad?: string;
  cantidad?: string | number;
  valorbase?: string | number;
  valoriva?: string | number;
  neto?: string | number;
  costoprome?: string | number;
  vendedor?: string;
  nomven?: string;
  codven?: string;
  formapago?: string;
  produccion_rol?: string;
}

export interface TNSVentasSummary {
  total_registros: number;
  total_cantidad_vendida: number;
  total_ingresos_neto: number;
}

export interface TNSVentasResponse {
  status: boolean;
  message?: string | null;
  data: TNSVentaItem[];
  total_count: number;
  summary: TNSVentasSummary;
  page?: number;
  page_size?: number;
  total_pages?: number;
}

export interface TNSMaterialVentasHistorialResponse {
  status: boolean;
  codigo_articulo: string;
  ventas_historial: TNSVentaItem[];
  total_ventas: number;
  summary: TNSVentasSummary;
}

export interface TNSVentasParams {
  search?: string;
  cod_articulo?: string;
  cliente?: string;
  fecha_inicial?: string; // Formato YYYY-MM-DD o ISO
  fecha_final?: string;   // Formato YYYY-MM-DD o ISO
  page?: number;
  page_size?: number;
  force_refresh?: boolean;
}

// ----------------------------------------------------
// Tipos para Facturas de Venta TNS (Kardex / FV)
// ----------------------------------------------------

export interface TNSFacturaItem {
  kardexId: string | number;
  codigoComprobante?: string | null;
  codigoPrefijo?: string | null;
  numero: string;
  fecha: string;
  hora?: string;
  codigoTercero: string;
  nombreTercero: string;
  valorNeto: string | number;
  fechaAsentado?: string;
  codigoVendedor?: string;
  nombreVendedor?: string;
}

export interface TNSFacturasSummary {
  total_facturas: number;
  total_valor_neto: number;
}

export interface TNSFacturasResponse {
  status: boolean;
  message?: string | null;
  data: TNSFacturaItem[];
  total_count: number;
  summary?: TNSFacturasSummary;
  page?: number;
  page_size?: number;
  total_pages?: number;
}

export interface TNSFacturasParams {
  search?: string;
  cliente?: string;
  numero?: string;
  fecha_inicial?: string; // "YYYY-MM-DD" o "DD/MM/YYYY"
  fecha_final?: string;   // "YYYY-MM-DD" o "DD/MM/YYYY"
  page?: number;
  page_size?: number;
  force_refresh?: boolean;
}

export interface TNSFacturaDetalleItem {
  codigoArticulo: string;
  decripcionArticulo: string;
  codigoBodega?: string;
  cantidad: string | number;
  valorBase: string | number;
  porcentaIva?: string | number;
  valorIva?: string | number;
  valorNeto: string | number;
  valorParcial: string | number;
}

export interface TNSFacturaDetalle {
  codigoComprobante?: string | null;
  codigoPrefijo?: string | null;
  numero: string;
  fecha: string;
  fechaAsentado?: string;
  codigoTercero: string;
  nombreTercero: string;
  codigoVendedor?: string;
  nombreVendedor?: string;
  codigoDespachar?: string;
  nombreDespachar?: string;
  formaPago?: string;
  observacion?: string;
  valorNeto: string | number;
  netoIva?: string | number;
  valorDescuentos?: string | number;
  valorTotal: string | number;
  impresa?: string;
  cufe?: string;
  estadoDian?: string;
  detallesVenta: TNSFacturaDetalleItem[];
}

export interface TNSFacturaDetalleResponse {
  status: boolean;
  message?: string | null;
  data: TNSFacturaDetalle;
}

export interface TNSTransaccionalVentasParams {
  search?: string;
  tipo?: string; // ej: "DV", "FV"
  fecha_inicial?: string; // "YYYY-MM-DD" o "DD/MM/YYYY"
  fecha_final?: string;   // "YYYY-MM-DD" o "DD/MM/YYYY"
  page?: number;
  page_size?: number;
  force_refresh?: boolean;
}

