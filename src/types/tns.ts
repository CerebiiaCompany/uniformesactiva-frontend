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
