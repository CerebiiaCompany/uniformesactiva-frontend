import { http, HttpError } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { getApiBaseUrl } from "@/lib/api-base";
import type {
  PedidoCompra,
  DetallePedidoCompra,
  PedidosCompraFilters,
  PedidosCompraResponse,
  TNSInventarioItem,
  TNSProveedorOferta,
  TNSCompraItem,
  TNSMaterialComprasHistorialResponse,
  TNSNotasInventarioResponse,
  TNSMaterialNotasInventarioResponse,
  TNSOrderConsumptionResponse,
  TNSOrderConsumptionAlertsMatchResponse,
  TNSInventoryMovementHistoryResponse,
  TNSOrderRealMaterialCostResponse,
  TNSVentaItem,
  TNSVentasSummary,
  TNSVentasResponse,
  TNSMaterialVentasHistorialResponse,
  TNSVentasParams,
  TNSFacturaItem,
  TNSFacturaDetalle,
  TNSFacturaDetalleItem,
  TNSFacturaDetalleResponse,
  TNSFacturasSummary,
  TNSFacturasResponse,
  TNSFacturasParams,
  TNSTransaccionalVentasParams,
  BodegaDistribucion,
  UnidadDistribucion,
  TopProductoInventario,
  TNSInventarioSummary,
  TNSInventarioParams,
  TNSInventarioResponse,
} from "@/types/tns";

export type {
  TNSInventarioItem,
  TNSProveedorOferta,
  TNSCompraItem,
  TNSMaterialComprasHistorialResponse,
  TNSNotasInventarioResponse,
  TNSMaterialNotasInventarioResponse,
  TNSOrderConsumptionResponse,
  TNSOrderConsumptionAlertsMatchResponse,
  TNSInventoryMovementHistoryResponse,
  TNSOrderRealMaterialCostResponse,
  TNSVentaItem,
  TNSVentasSummary,
  TNSVentasResponse,
  TNSMaterialVentasHistorialResponse,
  TNSVentasParams,
  TNSFacturaItem,
  TNSFacturaDetalle,
  TNSFacturaDetalleItem,
  TNSFacturaDetalleResponse,
  TNSFacturasSummary,
  TNSFacturasResponse,
  TNSFacturasParams,
  TNSTransaccionalVentasParams,
  BodegaDistribucion,
  UnidadDistribucion,
  TopProductoInventario,
  TNSInventarioSummary,
  TNSInventarioParams,
  TNSInventarioResponse,
};


/**
 * Formatea una fecha (string YYYY-MM-DD o Date) a formato DD/MM/YYYY para consultas a TNS.
 */
export function formatDateToDDMMYYYY(dateInput?: string | Date | null): string {
  if (!dateInput) return "";

  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (!trimmed) return "";

    // Si ya viene en formato DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    // Formato estándar HTML date: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-");
      return `${day}/${month}/${year}`;
    }

    // Fecha con timestamp ISO
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, "0");
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const year = parsed.getFullYear();
      return `${day}/${month}/${year}`;
    }

    return trimmed;
  }

  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    const day = String(dateInput.getDate()).padStart(2, "0");
    const month = String(dateInput.getMonth() + 1).padStart(2, "0");
    const year = dateInput.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return "";
}

/**
 * Parsea una fecha en formato TNS (DD/MM/YYYY, YYYY-MM-DD o ISO) a un objeto Date válido.
 */
export function parseTnsDate(dateInput?: string | Date | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  const str = String(dateInput).trim();
  if (!str) return null;

  // Formato DD/MM/YYYY o DD-MM-YYYY (común en TNS)
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1; // 0-indexado
    const year = parseInt(ddmmyyyyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Formato YYYY-MM-DD o YYYY/MM/DD (estándar HTML date)
  const yyyymmddMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10) - 1;
    const day = parseInt(yyyymmddMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback estándar
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

/**
 * Normaliza texto para búsqueda insensible a mayúsculas y acentos.
 */
function normalizeQuery(str?: string | null): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Filtra una lista de pedidos TNS en cliente asegurando soporte completo para:
 * - Rango de fechas largas (desde / hasta) con parseo correcto de DD/MM/YYYY y YYYY-MM-DD
 * - Búsqueda por proveedor, NIT, concepto, número de pedido y artículos (nomMat / codMat)
 * - Filtrado exacto por estado TNS (ABIERTO, CERRADO, PENDIENTE, APROBADO, ANULADO)
 */
export function filterPedidosCompraList(
  pedidos: PedidoCompra[],
  filters?: PedidosCompraFilters
): PedidoCompra[] {
  if (!filters) return pedidos;

  const searchNorm = normalizeQuery(filters.search);
  const estadoFilter = (filters.estado || "todos").toUpperCase().trim();

  // Fechas límites
  let dateDesde: Date | null = null;
  if (filters.fecha_inicio) {
    const d = parseTnsDate(filters.fecha_inicio);
    if (d) {
      d.setHours(0, 0, 0, 0);
      dateDesde = d;
    }
  }

  let dateHasta: Date | null = null;
  if (filters.fecha_fin) {
    const d = parseTnsDate(filters.fecha_fin);
    if (d) {
      d.setHours(23, 59, 59, 999);
      dateHasta = d;
    }
  }

  return pedidos.filter((pedido) => {
    // 1. Filtro de Estado
    if (estadoFilter && estadoFilter !== "TODOS") {
      const pedidoEstado = getPedidoEstado(pedido).toUpperCase().trim();
      if (pedidoEstado !== estadoFilter) {
        return false;
      }
    }

    // 2. Filtro de Rango de Fechas
    if (dateDesde || dateHasta) {
      const rawDate =
        pedido.fecha ||
        pedido.fechaAsentado ||
        pedido.FECHA ||
        pedido.fecha_entrega ||
        pedido.FECHAENT ||
        "";
      const pDate = parseTnsDate(rawDate);
      if (pDate) {
        if (dateDesde && pDate.getTime() < dateDesde.getTime()) {
          return false;
        }
        if (dateHasta && pDate.getTime() > dateHasta.getTime()) {
          return false;
        }
      }
    }

    // 3. Filtro de Búsqueda
    if (searchNorm) {
      const numDoc = normalizeQuery(getPedidoNumDoc(pedido));
      const prov = normalizeQuery(getPedidoProveedor(pedido));
      const nit = normalizeQuery(getPedidoNit(pedido));
      const concepto = normalizeQuery(getPedidoConcepto(pedido));

      let matched =
        numDoc.includes(searchNorm) ||
        prov.includes(searchNorm) ||
        nit.includes(searchNorm) ||
        concepto.includes(searchNorm);

      if (!matched) {
        const detalles = getPedidoDetalles(pedido);
        for (const d of detalles) {
          const cod = normalizeQuery(getDetalleCodigo(d));
          const desc = normalizeQuery(getDetalleDescripcion(d));
          if (cod.includes(searchNorm) || desc.includes(searchNorm)) {
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Consulta pedidos de compra desde el backend con soporte para múltiples rutas de endpoints
 */
export async function getPedidosCompra(
  filters?: PedidosCompraFilters
): Promise<{ items: PedidoCompra[]; total_count: number }> {
  const params = new URLSearchParams();

  if (filters?.fecha_inicio) {
    const formatted = formatDateToDDMMYYYY(filters.fecha_inicio);
    if (formatted) {
      params.set("fecha_inicio", formatted);
      params.set("fecha_desde", formatted);
    }
  }

  if (filters?.fecha_fin) {
    const formatted = formatDateToDDMMYYYY(filters.fecha_fin);
    if (formatted) {
      params.set("fecha_fin", formatted);
      params.set("fecha_hasta", formatted);
    }
  }

  if (filters?.proveedor?.trim()) {
    params.set("proveedor", filters.proveedor.trim());
    params.set("tercero", filters.proveedor.trim());
    params.set("nit", filters.proveedor.trim());
  }

  if (filters?.numero_documento?.trim()) {
    params.set("numero_documento", filters.numero_documento.trim());
    params.set("numero", filters.numero_documento.trim());
    params.set("numdoc", filters.numero_documento.trim());
  }

  if (filters?.estado && filters.estado !== "todos") {
    params.set("estado", filters.estado);
  }

  if (filters?.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters?.page) {
    params.set("page", String(filters.page));
  }

  if (filters?.page_size) {
    params.set("page_size", String(filters.page_size));
  }

  const queryString = params.toString();
  const querySuffix = queryString ? `?${queryString}` : "";
  const base = getApiBaseUrl();

  // Lista de posibles rutas en el backend en orden de prioridad
  const candidateUrls = [
    `${base}/api/v1/satellites/tns/pedidos-compra/${querySuffix}`,
    `${base}/api/v1/satellites/pedidos-compra/${querySuffix}`,
    `${base}/api/v1/orders/tns/pedidos-compra/${querySuffix}`,
    `${base}/api/v1/tns/pedidos-compra/${querySuffix}`,
  ];

  let lastError: unknown = null;
  let res: PedidosCompraResponse | PedidoCompra[] | null = null;

  for (const url of candidateUrls) {
    try {
      res = await http<PedidosCompraResponse | PedidoCompra[]>(url, {
        skipAuthRedirect: true,
      });
      if (res) break;
    } catch (err) {
      lastError = err;
      if (err instanceof HttpError && (err.status === 404 || err.status === 401)) {
        // Si es 404 intentar otra ruta, si es 401 guardar error sin desloguear
        if (err.status === 404) continue;
      }
      throw err;
    }
  }

  if (!res) {
    throw lastError || new Error("No se encontró el endpoint de pedidos de compra TNS en el backend.");
  }

  if (Array.isArray(res)) {
    return {
      items: res,
      total_count: res.length,
    };
  }

  // Estructura { status: true, message: null, data: [...] } o { items: [...] }
  const items =
    res.data ||
    res.items ||
    res.results ||
    res.pedidos ||
    [];

  const total_count =
    res.total_count ??
    res.count ??
    res.total ??
    items.length;

  return {
    items,
    total_count,
  };
}

// Helpers de extracción seguros para componentes UI
export function getPedidoNumDoc(p: PedidoCompra): string {
  return p.numero || p.numero_documento || p.NUMDOC || String(p.kardexId || p.id || "—");
}

export function getPedidoProveedor(p: PedidoCompra): string {
  return (
    p.nomTercero ||
    p.tercero_nombre ||
    p.RAZONSOCIAL ||
    p.proveedor ||
    p.PROVEEDOR ||
    p.nitTercero ||
    p.tercero_nit ||
    p.NIT ||
    "Proveedor no especificado"
  );
}

export function getPedidoNit(p: PedidoCompra): string {
  return p.nitTercero || p.codTercero || p.tercero_nit || p.NIT || p.tercero_id || p.TERCERO || "";
}

export function getPedidoDireccion(p: PedidoCompra): string {
  return p.dirTercero || "";
}

export function getPedidoTelefono(p: PedidoCompra): string {
  return p.telefono || "";
}

export function getPedidoFecha(p: PedidoCompra): string {
  return p.fecha || p.FECHA || "—";
}

export function getPedidoFechaEntrega(p: PedidoCompra): string {
  return p.fechaAsentado || p.fecha_entrega || p.FECHAENT || "—";
}

export function getPedidoEstado(p: PedidoCompra): string {
  return (p.estado || p.ESTADO || "ABIERTO").toUpperCase();
}

export function getPedidoConcepto(p: PedidoCompra): string {
  return p.observacion || p.descripcion || p.observaciones || p.DETALLE || p.OBSERVACION || "—";
}

export function getPedidoTotal(p: PedidoCompra): number {
  if (p.valor_total != null && !isNaN(Number(p.valor_total))) return Number(p.valor_total);
  if (p.VALOR != null && !isNaN(Number(p.VALOR))) return Number(p.VALOR);
  if (p.TOTAL != null && !isNaN(Number(p.TOTAL))) return Number(p.TOTAL);

  // Si no viene total explícito, sumar items
  const items = getPedidoDetalles(p);
  if (items.length > 0) {
    return items.reduce((sum, item) => sum + getDetalleTotal(item), 0);
  }
  return 0;
}

export function getPedidoSubtotal(p: PedidoCompra): number {
  if (p.valor_subtotal != null && !isNaN(Number(p.valor_subtotal))) return Number(p.valor_subtotal);
  if (p.SUBTOTAL != null && !isNaN(Number(p.SUBTOTAL))) return Number(p.SUBTOTAL);
  return getPedidoTotal(p);
}

export function getPedidoDetalles(p: PedidoCompra): DetallePedidoCompra[] {
  return p.detalles || p.items || p.ITEMS || [];
}

export function getDetalleCodigo(d: DetallePedidoCompra): string {
  return d.codMat || d.codigo || d.item || d.CODIGO || d.ITEM || "—";
}

export function getDetalleDescripcion(d: DetallePedidoCompra): string {
  return d.nomMat || d.descripcion || d.DESCRIP || "Artículo sin descripción";
}

export function getDetalleUnidad(d: DetallePedidoCompra): string {
  return d.unidad || d.UNIDAD || "UND";
}

export function getDetalleCantidad(d: DetallePedidoCompra): number {
  return Number(d.cantidad ?? d.CANTIDAD ?? 0);
}

export function getDetalleRecibido(d: DetallePedidoCompra): number {
  return Number(d.cantDespachada ?? d.cantidad_recibida ?? d.CANTREC ?? 0);
}

export function getDetallePendiente(d: DetallePedidoCompra): number {
  if (d.cantSaldo != null) return Number(d.cantSaldo);
  if (d.cantidad_pendiente != null) return Number(d.cantidad_pendiente);
  if (d.CANTPEN != null) return Number(d.CANTPEN);
  const cant = getDetalleCantidad(d);
  const rec = getDetalleRecibido(d);
  return Math.max(0, cant - rec);
}

export function getDetalleValorUnitario(d: DetallePedidoCompra): number {
  return Number(d.valorUnitario ?? d.valor_unitario ?? d.VALUNIT ?? 0);
}

export function getDetalleTotal(d: DetallePedidoCompra): number {
  if (d.valorTotal != null && !isNaN(Number(d.valorTotal))) return Number(d.valorTotal);
  if (d.valor_total != null && !isNaN(Number(d.valor_total))) return Number(d.valor_total);
  if (d.VALOR != null && !isNaN(Number(d.VALOR))) return Number(d.VALOR);
  if (d.VALORTOT != null && !isNaN(Number(d.VALORTOT))) return Number(d.VALORTOT);
  return getDetalleCantidad(d) * getDetalleValorUnitario(d);
}

// ----------------------------------------------------
// Métodos y Helpers de Inventario TNS en Tiempo Real
// ----------------------------------------------------

/**
 * Parsea un valor numérico seguro desde TNS (string con comas/puntos o número).
 */
export function parseTNSNumber(val: string | number | undefined | null): number {
  if (val == null) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/,/g, "");
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Resuelve costo unitario de un material TNS (compras, stock o proveedores).
 */
export function resolveTNSMaterialUnitCost(
  item: TNSInventarioItem,
  preferredSupplier?: string | null
): number {
  let unitCost = parseTNSNumber(
    item.ultimo_costo_compra ??
      (item as Record<string, unknown>).inventario_CostoUnitario ??
      (item as Record<string, unknown>).costo_unitario ??
      (item as Record<string, unknown>).valunit ??
      (item as Record<string, unknown>).costo_promedio ??
      (item as Record<string, unknown>).costo ??
      (item as Record<string, unknown>).precio
  );

  if (unitCost <= 0) {
    const cantStock = parseTNSNumber(item.cant_Stock);
    const costoStock = parseTNSNumber(item.costo_Stock);
    if (cantStock > 0 && costoStock > 0) {
      unitCost = costoStock / cantStock;
    }
  }

  if (unitCost <= 0) {
    const cantDisp = parseTNSNumber(item.cant_Disponible);
    const costoDisp = parseTNSNumber(item.costo_Disponible);
    if (cantDisp > 0 && costoDisp > 0) {
      unitCost = costoDisp / cantDisp;
    }
  }

  if (unitCost <= 0 && item.proveedores?.length) {
    const supplierNorm = preferredSupplier?.trim().toLowerCase() || "";
    const sorted = [...item.proveedores];
    if (supplierNorm) {
      sorted.sort((a, b) => {
        const aName = (a.nombre || "").toLowerCase();
        const bName = (b.nombre || "").toLowerCase();
        const aMatch = aName.includes(supplierNorm) || supplierNorm.includes(aName) ? 0 : 1;
        const bMatch = bName.includes(supplierNorm) || supplierNorm.includes(bName) ? 0 : 1;
        return aMatch - bMatch;
      });
    }
    for (const p of sorted) {
      const pCost = parseTNSNumber(p.ultimo_costo_unitario);
      if (pCost > 0) {
        unitCost = pCost;
        break;
      }
    }
  }

  return unitCost;
}

/** Formato canónico de selección tela: código · referencia */
export function formatFabricSelectionValue(code: string, reference: string): string {
  const c = code.trim();
  const r = reference.trim();
  if (c && r && c.toUpperCase() !== r.toUpperCase()) {
    return `${c} · ${r}`;
  }
  return r || c;
}

/** Parsea valor del input/datalist de telas */
export function parseFabricSelectionInput(input: string): { code: string; reference: string } {
  const trimmed = (input || "").trim();
  if (!trimmed) return { code: "", reference: "" };

  const sep = trimmed.indexOf(" · ");
  if (sep > 0) {
    return {
      code: trimmed.slice(0, sep).trim(),
      reference: trimmed.slice(sep + 3).trim(),
    };
  }

  return { code: trimmed, reference: trimmed };
}

/**
 * Consulta la lista paginada y filtrable de ítems de inventario de TNS.
 */
export async function getTNSInventario(
  params: TNSInventarioParams = {}
): Promise<TNSInventarioResponse> {
  const query = new URLSearchParams();

  // Si viene color y búsqueda, combinamos para que el backend busque en la descripción de todas las páginas y bodegas
  const searchPart = params.search?.trim() || "";
  const colorPart = params.color?.trim() || "";

  if (searchPart && colorPart) {
    query.append("search", `${searchPart} ${colorPart}`);
    query.append("color", colorPart);
  } else if (colorPart) {
    query.append("search", colorPart);
    query.append("color", colorPart);
  } else if (searchPart) {
    query.append("search", searchPart);
  }

  if (params.bodega && params.bodega !== "TODAS") query.append("bodega", params.bodega);
  if (params.estado && params.estado !== "TODOS") query.append("estado", params.estado);
  if (params.stock_status && params.stock_status !== "todos") query.append("stock_status", params.stock_status);
  if (params.ordenar_por) query.append("ordenar_por", params.ordenar_por);
  if (params.page != null) query.append("page", String(params.page));
  if (params.page_size != null) query.append("page_size", String(params.page_size));
  if (params.force_refresh) query.append("force_refresh", "true");

  const queryString = query.toString();
  const url = endpoints.inventory.tns(queryString);

  const res = await http<any>(url, {
    skipAuthRedirect: true,
  });

  if (Array.isArray(res)) {
    return {
      status: true,
      data: enrichTNSInventarioItems(res),
      total_count: res.length,
      page: params.page || 1,
      page_size: params.page_size || res.length,
    };
  }

  const items = enrichTNSInventarioItems(res.data || res.items || res.results || []);
  const totalCount = res.total_count ?? res.count ?? res.total ?? items.length;

  return {
    status: res.status ?? true,
    message: res.message,
    data: items,
    total_count: totalCount,
    page: res.page ?? params.page ?? 1,
    page_size: res.page_size ?? params.page_size ?? 20,
    total_pages: res.total_pages ?? Math.ceil(totalCount / (params.page_size || 20)),
    summary: res.summary,
  };
}

/**
 * Consulta la lista COMPLETA de todos los ítems de inventario de TNS (sin paginación limitante).
 * Trae el 100% de los registros para permitir filtrado fluido por categorías, colores y bodegas en memoria.
 */
export async function getAllTNSInventario(
  params: TNSInventarioParams = {}
): Promise<TNSInventarioResponse> {
  // 1. Solicitamos página completa con page_size alto
  const firstPage = await getTNSInventario({
    ...params,
    page: 1,
    page_size: 5000,
  });

  const totalCount = firstPage.total_count || firstPage.data.length;
  let allItems = [...firstPage.data];

  // 2. Si el backend limita page_size y hay más páginas, las traemos todas en paralelo
  if (allItems.length < totalCount && firstPage.total_pages && firstPage.total_pages > 1) {
    const remainingPageNumbers = Array.from(
      { length: firstPage.total_pages - 1 },
      (_, i) => i + 2
    );

    const pageResults = await Promise.all(
      remainingPageNumbers.map((p) =>
        getTNSInventario({
          ...params,
          page: p,
          page_size: firstPage.page_size || 100,
        })
      )
    );

    pageResults.forEach((res) => {
      if (res && res.data) {
        allItems.push(...res.data);
      }
    });
  }

  return {
    ...firstPage,
    data: allItems,
    total_count: allItems.length,
    total_pages: 1,
    page: 1,
    page_size: allItems.length,
  };
}

/**
 * Consulta el resumen global, métricas, tops y distribución de inventario TNS.
 */
export async function getTNSInventarioSummary(
  force_refresh = false
): Promise<TNSInventarioSummary> {
  const query = force_refresh ? "force_refresh=true" : "";
  const url = endpoints.inventory.tnsSummary(query);

  const res = await http<any>(url, {
    skipAuthRedirect: true,
  });

  if (res && res.summary) {
    return res.summary as TNSInventarioSummary;
  }

  if (res && res.total_registros !== undefined) {
    return res as TNSInventarioSummary;
  }

  return res as TNSInventarioSummary;
}

/**
 * Consulta el reporte detallado de compras de TNS con filtros.
 */
export async function getTNSComprasReporte(
  params: {
    search?: string;
    cod_articulo?: string;
    proveedor?: string;
    fecha_inicial?: string;
    fecha_final?: string;
    page?: number;
    page_size?: number;
    force_refresh?: boolean;
  } = {}
) {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.append("search", params.search.trim());
  if (params.cod_articulo?.trim()) query.append("cod_articulo", params.cod_articulo.trim());
  if (params.proveedor?.trim()) query.append("proveedor", params.proveedor.trim());
  if (params.fecha_inicial?.trim()) query.append("fecha_inicial", params.fecha_inicial.trim());
  if (params.fecha_final?.trim()) query.append("fecha_final", params.fecha_final.trim());
  if (params.page != null) query.append("page", String(params.page));
  if (params.page_size != null) query.append("page_size", String(params.page_size));
  if (params.force_refresh) query.append("force_refresh", "true");

  const url = endpoints.inventory.tnsCompras(query.toString());
  const res = await http<any>(url, { skipAuthRedirect: true });
  return res?.data ?? res;
}

/**
 * Consulta el historial de compras y cotizaciones de proveedores para un material específico.
 */
export async function getTNSMaterialComprasHistorial(
  codigoArticulo: string,
  force_refresh = false
): Promise<TNSMaterialComprasHistorialResponse> {
  const query = force_refresh ? "force_refresh=true" : "";
  const url = endpoints.inventory.tnsComprasMaterial(codigoArticulo, query);
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res && res.data && res.data.codigo_articulo) {
    return res.data as TNSMaterialComprasHistorialResponse;
  }
  return res as TNSMaterialComprasHistorialResponse;
}

export interface TNSNotasInventarioParams {
  search?: string;
  cod_articulo?: string;
  bodega?: string;
  fecha_inicial?: string;
  fecha_final?: string;
  solo_notas?: boolean;
  tipo?: string;
  page?: number;
  page_size?: number;
  force_refresh?: boolean;
}

/**
 * Consulta notas de inventario desde KardexDetallado TNS (listado general).
 */
export async function getTNSNotasInventario(
  params: TNSNotasInventarioParams = {}
): Promise<TNSNotasInventarioResponse> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.append("search", params.search.trim());
  if (params.cod_articulo?.trim()) query.append("cod_articulo", params.cod_articulo.trim());
  if (params.bodega?.trim()) query.append("bodega", params.bodega.trim());
  if (params.fecha_inicial?.trim()) query.append("fecha_inicial", params.fecha_inicial.trim());
  if (params.fecha_final?.trim()) query.append("fecha_final", params.fecha_final.trim());
  if (params.tipo?.trim()) query.append("tipo", params.tipo.trim());
  if (params.solo_notas === false) query.append("solo_notas", "false");
  if (params.page != null) query.append("page", String(params.page));
  if (params.page_size != null) query.append("page_size", String(params.page_size));
  if (params.force_refresh) query.append("force_refresh", "true");

  const url = endpoints.inventory.tnsNotasInventario(query.toString());
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res && Array.isArray(res.data)) {
    return res as TNSNotasInventarioResponse;
  }
  if (res?.data && Array.isArray(res.data.data)) {
    return res.data as TNSNotasInventarioResponse;
  }
  return {
    status: Boolean(res?.status),
    message: res?.message ?? null,
    data: [],
    total_count: 0,
    summary: null,
  };
}

/**
 * Historial de notas de inventario TNS para un material específico.
 */
export async function getTNSMaterialNotasInventarioHistorial(
  codigoArticulo: string,
  options: {
    fecha_inicial?: string;
    fecha_final?: string;
    force_refresh?: boolean;
  } = {}
): Promise<TNSMaterialNotasInventarioResponse> {
  const query = new URLSearchParams();
  if (options.fecha_inicial?.trim()) query.append("fecha_inicial", options.fecha_inicial.trim());
  if (options.fecha_final?.trim()) query.append("fecha_final", options.fecha_final.trim());
  if (options.force_refresh) query.append("force_refresh", "true");

  const url = endpoints.inventory.tnsNotasInventarioMaterial(
    codigoArticulo,
    query.toString() || undefined
  );
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res && res.data && res.data.codigo_articulo) {
    return res.data as TNSMaterialNotasInventarioResponse;
  }
  if (res?.codigo_articulo) {
    return res as TNSMaterialNotasInventarioResponse;
  }
  return {
    status: false,
    codigo_articulo: codigoArticulo,
    notas_inventario: [],
    total_notas: 0,
    summary: null,
    message: res?.message ?? "No se pudo consultar notas de inventario TNS",
  };
}

/**
 * Consulta la lista paginada y filtrable de ventas detalladas de TNS.
 */
export async function getTNSVentasDetalladas(
  params: TNSVentasParams = {}
): Promise<TNSVentasResponse> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.append("search", params.search.trim());
  if (params.cod_articulo?.trim()) query.append("cod_articulo", params.cod_articulo.trim());
  if (params.cliente?.trim()) query.append("cliente", params.cliente.trim());
  if (params.fecha_inicial?.trim()) query.append("fecha_inicial", params.fecha_inicial.trim());
  if (params.fecha_final?.trim()) query.append("fecha_final", params.fecha_final.trim());
  if (params.page != null) query.append("page", String(params.page));
  if (params.page_size != null) query.append("page_size", String(params.page_size));
  if (params.force_refresh) query.append("force_refresh", "true");

  const url = endpoints.inventory.tnsVentas(query.toString());
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res && res.data && Array.isArray(res.data)) {
    return res as TNSVentasResponse;
  }
  if (Array.isArray(res)) {
    return {
      status: true,
      data: res,
      total_count: res.length,
      summary: {
        total_registros: res.length,
        total_cantidad_vendida: res.reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0),
        total_ingresos_neto: res.reduce((acc, curr) => acc + (Number(curr.neto) || 0), 0),
      },
    };
  }
  return res as TNSVentasResponse;
}

/**
 * Consulta el historial de ventas de un material específico.
 */
export async function getTNSMaterialVentasHistorial(
  codigoArticulo: string,
  force_refresh = false
): Promise<TNSMaterialVentasHistorialResponse> {
  const query = force_refresh ? "force_refresh=true" : "";
  const url = endpoints.inventory.tnsVentasMaterial(codigoArticulo, query);
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res && res.data && res.data.codigo_articulo) {
    return res.data as TNSMaterialVentasHistorialResponse;
  }
  return res as TNSMaterialVentasHistorialResponse;
}

/**
 * Salidas informativas desde órdenes del sistema según costeo de variante (tela + insumos).
 */
export async function getTNSOrderConsumption(
  codigoArticulo: string,
  options?: {
    descripcion?: string;
    color?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
  }
): Promise<TNSOrderConsumptionResponse> {
  const query = new URLSearchParams();
  if (options?.descripcion?.trim()) query.append("descripcion", options.descripcion.trim());
  if (options?.color?.trim()) query.append("color", options.color.trim());
  if (options?.fecha_desde?.trim()) query.append("fecha_desde", options.fecha_desde.trim());
  if (options?.fecha_hasta?.trim()) query.append("fecha_hasta", options.fecha_hasta.trim());

  const url = endpoints.inventory.tnsOrderConsumption(
    codigoArticulo,
    query.toString() || undefined
  );
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res?.movimientos) {
    return res as TNSOrderConsumptionResponse;
  }
  if (res?.data?.movimientos) {
    return res.data as TNSOrderConsumptionResponse;
  }
  return {
    status: true,
    codigo_articulo: codigoArticulo,
    movimientos: [],
    total_salidas: 0,
    count_salidas: 0,
  };
}

/**
 * Indica qué materiales TNS visibles tienen salidas por consumo de órdenes (hoy / rango).
 */
export async function matchTNSOrderConsumptionAlerts(
  materials: Array<{
    id: string;
    codigo_articulo: string;
    descripcion?: string;
    color?: string;
  }>,
  options?: { fecha_desde?: string; fecha_hasta?: string }
): Promise<TNSOrderConsumptionAlertsMatchResponse> {
  const url = endpoints.inventory.tnsOrderConsumptionAlertsMatch();
  const res = await http<any>(url, {
    method: "POST",
    body: JSON.stringify({
      materials,
      fecha_desde: options?.fecha_desde || undefined,
      fecha_hasta: options?.fecha_hasta || undefined,
    }),
    skipAuthRedirect: true,
  });

  if (Array.isArray(res?.matched_ids)) {
    return res as TNSOrderConsumptionAlertsMatchResponse;
  }
  if (Array.isArray(res?.data?.matched_ids)) {
    return res.data as TNSOrderConsumptionAlertsMatchResponse;
  }
  return { matched_ids: [], alertas_count: 0 };
}

/**
 * Informe informativo de movimientos de inventario por consumo de órdenes.
 */
export async function getTNSInventoryMovementHistory(
  fechaDesde: string,
  fechaHasta: string
): Promise<TNSInventoryMovementHistoryResponse> {
  const query = new URLSearchParams();
  query.append("fecha_desde", fechaDesde.trim());
  query.append("fecha_hasta", fechaHasta.trim());

  const url = endpoints.inventory.tnsMovementHistory(query.toString());
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res?.telas_consumidas) {
    return res as TNSInventoryMovementHistoryResponse;
  }
  if (res?.data?.telas_consumidas) {
    return res.data as TNSInventoryMovementHistoryResponse;
  }
  return {
    status: true,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    telas_consumidas: [],
    insumos_usados: [],
    consumido_satellite: [],
  };
}

/**
 * Costo de materiales de una orden valorizado con precios unitarios TNS.
 * Deduplica peticiones en vuelo (misma orden) para no bloquear UI dos veces.
 */
const tnsOrderRealMaterialCostInflight = new Map<
  string,
  Promise<TNSOrderRealMaterialCostResponse>
>();

export async function getTNSOrderRealMaterialCost(
  ordenId: string
): Promise<TNSOrderRealMaterialCostResponse> {
  const key = String(ordenId || "").trim();
  if (!key) {
    return {
      status: true,
      orden_id: ordenId,
      materials_total: 0,
      materials_lines: [],
    };
  }

  const pending = tnsOrderRealMaterialCostInflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const url = endpoints.inventory.tnsOrderRealMaterialCost(key);
    const res = await http<any>(url, { skipAuthRedirect: true });

    if (Array.isArray(res?.materials_lines)) {
      return res as TNSOrderRealMaterialCostResponse;
    }
    if (Array.isArray(res?.data?.materials_lines)) {
      return res.data as TNSOrderRealMaterialCostResponse;
    }
    return {
      status: true,
      orden_id: key,
      materials_total: 0,
      materials_lines: [],
    };
  })().finally(() => {
    tnsOrderRealMaterialCostInflight.delete(key);
  });

  tnsOrderRealMaterialCostInflight.set(key, request);
  return request;
}

/**
 * Consulta la lista paginada y filtrable de Facturas de Venta desde el ERP TNS.
 */
export async function getTNSFacturas(
  params: TNSFacturasParams = {}
): Promise<TNSFacturasResponse> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.append("search", params.search.trim());
  if (params.cliente?.trim()) query.append("cliente", params.cliente.trim());
  if (params.numero?.trim()) query.append("numero", params.numero.trim());
  if (params.fecha_inicial?.trim()) {
    const d = formatDateToDDMMYYYY(params.fecha_inicial);
    query.append("fecha_inicial", d || params.fecha_inicial.trim());
  }
  if (params.fecha_final?.trim()) {
    const d = formatDateToDDMMYYYY(params.fecha_final);
    query.append("fecha_final", d || params.fecha_final.trim());
  }
  if (params.page != null) query.append("page", String(params.page));
  if (params.page_size != null) query.append("page_size", String(params.page_size));
  if (params.force_refresh) query.append("force_refresh", "true");

  const url = endpoints.inventory.tnsFacturas(query.toString());
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (Array.isArray(res)) {
    return {
      status: true,
      data: res,
      total_count: res.length,
      page: params.page || 1,
      page_size: params.page_size || res.length,
      summary: {
        total_facturas: res.length,
        total_valor_neto: res.reduce((acc, curr) => acc + parseTNSNumber(curr.valorNeto), 0),
      },
    };
  }

  const items = res.data || res.items || res.results || [];
  const totalCount = res.total_count ?? res.count ?? res.total ?? items.length;

  return {
    status: res.status ?? true,
    message: res.message,
    data: items,
    total_count: totalCount,
    summary: res.summary || {
      total_facturas: totalCount,
      total_valor_neto: items.reduce((acc: number, curr: any) => acc + parseTNSNumber(curr.valorNeto), 0),
    },
    page: res.page ?? params.page ?? 1,
    page_size: res.page_size ?? params.page_size ?? 20,
    total_pages: res.total_pages ?? Math.ceil(totalCount / (params.page_size || 20)),
  };
}

/**
 * Consulta el detalle completo de una Factura de Venta por su KardexId desde el ERP TNS.
 */
export async function getTNSFacturaDetalle(
  kardexId: string | number,
  force_refresh = false
): Promise<TNSFacturaDetalle> {
  const query = force_refresh ? "force_refresh=true" : "";
  const url = endpoints.inventory.tnsFacturaDetalle(kardexId, query);
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res && res.data && typeof res.data === "object") {
    return res.data as TNSFacturaDetalle;
  }
  return res as TNSFacturaDetalle;
}

/**
 * Consulta el reporte transaccional de ventas (FV / DV) desde TNS.
 */
export async function getTNSTransaccionalVentas(
  params: TNSTransaccionalVentasParams = {}
): Promise<TNSVentasResponse> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.append("search", params.search.trim());
  if (params.tipo?.trim()) query.append("tipo", params.tipo.trim());
  if (params.fecha_inicial?.trim()) {
    const d = formatDateToDDMMYYYY(params.fecha_inicial);
    query.append("fecha_inicial", d || params.fecha_inicial.trim());
  }
  if (params.fecha_final?.trim()) {
    const d = formatDateToDDMMYYYY(params.fecha_final);
    query.append("fecha_final", d || params.fecha_final.trim());
  }
  if (params.page != null) query.append("page", String(params.page));
  if (params.page_size != null) query.append("page_size", String(params.page_size));
  if (params.force_refresh) query.append("force_refresh", "true");

  const url = endpoints.inventory.tnsTransaccionalVentas(query.toString());
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res && res.data && Array.isArray(res.data)) {
    return res as TNSVentasResponse;
  }
  if (Array.isArray(res)) {
    return {
      status: true,
      data: res,
      total_count: res.length,
      summary: {
        total_registros: res.length,
        total_cantidad_vendida: res.reduce((acc, curr) => acc + parseTNSNumber(curr.cantidad), 0),
        total_ingresos_neto: res.reduce((acc, curr) => acc + parseTNSNumber(curr.neto), 0),
      },
    };
  }
  return res as TNSVentasResponse;
}

export const COMMON_COLORS = [
  "AZUL REY", "AZUL OSCURO", "AZUL MARINO", "AZUL CIELO", "AZUL TURQUESA", "AZUL NOCHE", "AZUL PETROLEO", "AZUL BEBE", "AZUL COBALTO", "AZUL PASTEL", "AZUL ANDINO", "AZUL MEDIO", "AZUL",
  "VERDE MILITAR", "VERDE ESMERALDA", "VERDE MANZANA", "VERDE OLIVA", "VERDE LIMON", "VERDE BOTELLA", "VERDE MENTA", "VERDE CALI", "VERDE JADE", "VERDE AGUA", "VERDE PINO", "VERDE",
  "ROJO ESCARLATA", "ROJO VINO", "ROJO CARDENAL", "ROJO PASION", "ROJO FUEGO", "ROJO CEREZA", "ROJO",
  "AMARILLO POLLITO", "AMARILLO QUEMADO", "AMARILLO ORO", "AMARILLO CANARIO", "AMARILLO NEON", "AMARILLO PAJA", "AMARILLO PASTEL", "AMARILLO",
  "VINO TINTO", "VINOTINTO", "GRIS RATON", "GRIS CLARO", "GRIS OSCURO", "GRIS PERLA", "GRIS HUMO", "GRIS JASPE", "GRIS MELANGE", "GRIS PLATA", "GRIS MEDIO", "GRIS",
  "BLANCO OPTICO", "BLANCO HUMO", "BLANCO NIEVE", "BLANCO MARFIL", "BLANCO TIZA", "BLANCO",
  "NEGRO AZABACHE", "NEGRO CARBON", "NEGRO MATE", "NEGRO",
  "MOSTAZA", "ESMERALDA", "TURQUESA", "KAKI", "KHAKI", "BEIGE", "ARENA", "MARFIL", "CRUDO", "HUESO", "CHAMPAGNE", "PERLA",
  "FUCSIA", "MAGENTA", "ROSADO", "ROSA", "PALO DE ROSA", "PALOROSA", "CORAL", "LILA", "MORADO", "VIOLETA", "BERENJENA", "LAVANDA", "CIRUELA",
  "NARANJA", "MANDARINA", "TERRACOTA", "SALMON", "LADRILLO", "OCRE", "COBRE", "BRONCE", "ORO", "DORADO", "PLATA", "PLATEADO",
  "CAFE", "MARRON", "CHOCOLATE", "TABACO", "CANELA", "CAMEL", "MIEL", "HABANO", "AVELLANA", "CARMELITA",
  "ESTAMPADO", "JASPEADO", "SURTIDO", "TRANSPARENTE", "NATURAL"
];

/**
 * Parsea la descripción de un ítem de TNS para separar el nombre base del material y el color.
 * Reglas:
 * 1. El color siempre se encuentra al final del texto.
 * 2. Un color no excede de 15 caracteres / 3 palabras (ej. "AZUL REY", "ESMERALDA", "MOSTAZA").
 * 3. En caso de múltiples guiones (ej. "TELA SUPER VERTIGO-100-AZUL REY"), toma el último segmento como color y el resto como nombre de tela ("TELA SUPER VERTIGO 100").
 * 4. Si no tiene guión pero termina en un color conocido (ej. "TELA PARKER ESMERALDA"), extrae el color y limpia el nombre.
 */
export function parseTNSDescription(desc?: string | null): { name: string; color: string } {
  if (!desc) return { name: "—", color: "" };
  const trimmed = desc.trim().replace(/\s+/g, " ");

  // 1. Separar por guiones o barras si existen
  if (/[-–—/]/.test(trimmed)) {
    const parts = trimmed.split(/[-–—/]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];

      // Verificar si el último segmento califica como color (no es solo número y tiene <= 15 letras y <= 3 palabras)
      const isPureNumber = /^\d+$/.test(lastPart);
      const isReasonableLength = lastPart.length <= 15 && lastPart.split(" ").length <= 3;

      if (!isPureNumber && isReasonableLength) {
        // Limpiar posible código numérico prefijo en el color (ej: "194006 NEGRO" -> "NEGRO" o mantener si es corto)
        const cleanColor = lastPart.replace(/^\d+\s+/, "").trim() || lastPart;
        const baseName = parts.slice(0, parts.length - 1).join(" - ").trim();
        return {
          name: baseName || trimmed,
          color: cleanColor.toUpperCase(),
        };
      }
    }
  }

  // 2. Si no hay guión o el último segmento no era color, buscar si termina con un color conocido
  const upper = trimmed.toUpperCase();
  for (const color of COMMON_COLORS) {
    // Verificar si termina exactamente con la palabra del color (ej. "TELA PARKER ESMERALDA")
    const regex = new RegExp(`(?:\\s+|^|-)${color}$`, "i");
    if (regex.test(upper)) {
      const baseName = trimmed.substring(0, upper.lastIndexOf(color)).replace(/[-–—\s]+$/, "").trim();
      if (baseName.length > 0) {
        return {
          name: baseName,
          color: color,
        };
      }
    }
  }

  return {
    name: trimmed,
    color: "",
  };
}

/**
 * Diccionario maestro de palabras clave para clasificación de inventario TNS.
 */
export const TNS_CATEGORY_KEYWORDS: Record<string, string[]> = {
  Telas: [
    "TELA", "TELAS", "POPELINA", "POLUX", "DRILL", "OXFORD", "PIQUE", "PIK", "LINO",
    "PARKER", "VERTIGO", "SUTEX", "ANTIFLUIDO", "RIPSTOP", "DACRON", "SEDA",
    "MICROFIBRA", "GABARDINA", "DENIM", "JEAN", "CANVA", "LINOS", "SEDAS", "CHALIS"
  ],
  Prendas: [
    "CAMISA", "PANTALON", "PANTALONES", "OVEROL", "CHALECO", "DELANTAL", "BATA", "SACO",
    "BLUSA", "FALDA", "CHAQUETA", "UNIFORME", "BERMUDA", "ENTERIZO", "SUDADERA", "SUDADERAS",
    "DOTACION", "CAMISETA", "SHORT", "CONJUNTO", "CONJUNTOS", "CAMIBUSO", "CAMIBUSOS",
    "CAMIBUZO", "CAMIBUZOS", "CORBATA", "CORBATAS", "GORRA", "GORRAS", "GORRO", "GORROS",
    "ZAPATO", "ZAPATOS", "CALZADO", "FILIPINA", "FILIPINAS", "FRANELA", "FRANELAS", "FRANELILLA", "FRANELILLAS",
    "JARDINERA", "JARDINERAS", "MEDIA", "MEDIAS", "POLO"
  ],
  Insumos: [
    "BOTON", "CREMALLERA", "CIERRE", "HILO", "SESGO", "ELASTICO", "RESORTE",
    "BROCHE", "ENTRETELA", "ENTRETELAS", "INTERLON", "INTERLONES", "INTELON",
    "FUSIONABLE", "FUSIONABLES", "MARQUILLA", "MARQUILLAS", "ETIQUETA", "ETIQUETAS",
    "BOLSA", "BOLSAS", "CAJA", "CAJAS", "GANCHO", "GANCHOS", "CINTA EMBALAJE", "CINTA TRANSPARENTE",
    "POLIETILENO", "CORRUGADO", "EMBALAJE", "STRETCH", "VINIPEL", "CINTA PEGANTE", "CINTA ENMASCARAR",
    "CINTA REFLECTIVA", "HILADILLA", "VELCRO", "HERRAJE",
    "CUELLO", "PUNO", "HOMBRERA", "CORDON", "SESGO ALGODON", "HILOS", "HEBILLA", "RIB",
    "AGUJA", "ACEITE", "TIZA", "PAPEL TRAZO", "PAPEL MOLDES", "MANTENIMIENTO",
    "PAPELERIA", "TIJERAS", "CUCHILLA"
  ],
};

export interface ClasificacionResultado {
  categoria: "Telas" | "Prendas" | "Insumos";
  requiere_revision: boolean;
  metodo_clasificacion: "diccionario" | "regla_cruzada" | "unidad_heuristica" | "fallback";
}

/**
 * Normaliza texto eliminando acentos, caracteres especiales y unificando espacios.
 */
function normalizeTNSText(text?: string | null): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar tildes
    .replace(/Ñ/g, "N")
    .replace(/ñ/g, "n")
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Determina la unidad de medida estándar de un ítem de TNS.
 * Regla: Cualquier artículo que inicie o contenga MARQUILLA / MARQUILLAS se mide en 'UND' (unidad).
 */
export function getTNSItemUnit(item: {
  prod_Dist_Desc?: string | null;
  prd_UnidadInventario?: string | null;
} | null | undefined): string {
  if (!item) return "UND";
  const normDesc = normalizeTNSText(item.prod_Dist_Desc);
  if (
    normDesc.startsWith("MARQUILLA") ||
    normDesc.startsWith("MARQUILLAS") ||
    normDesc.includes("MARQUILLA") ||
    normDesc.includes("MARQUILLAS") ||
    normDesc.startsWith("ETIQUETA") ||
    normDesc.includes("ETIQUETA")
  ) {
    return "UND";
  }
  const clean = (item.prd_UnidadInventario || "").trim();
  return clean || "UND";
}

/**
 * Clasifica automáticamente un ítem de TNS aplicando:
 * 1. Reglas prioritarias estrictas (artículos que inicien por pantalón, franela, franelilla, etc.).
 * 2. Reglas cruzadas de desempate (Telas vs Interlones, Bolsas/Empaques -> Insumos, Marquillas -> Insumos).
 * 3. Mapeo por diccionario tokenizado con límites de palabra (evita falsos positivos).
 * 4. Validación heurística por unidad de medida (metro -> Telas, cono/bolsa -> Insumos).
 * 5. Fallback con indicador `requiere_revision: true`.
 */
export function clasificarArticuloTNS(item: {
  prod_Dist_Desc?: string | null;
  prd_UnidadInventario?: string | null;
}): ClasificacionResultado {
  const normDesc = normalizeTNSText(item.prod_Dist_Desc);
  const normUnit = (item.prd_UnidadInventario || "").toLowerCase().trim();

  // Si no hay descripción, fallback directo
  if (!normDesc) {
    return {
      categoria: "Insumos",
      requiere_revision: true,
      metodo_clasificacion: "fallback",
    };
  }

  // ----------------------------------------------------
  // Paso 1: Regla Prioritaria Estricta para Prendas
  // Artículos que inicien por PANTALON, FRANELA, FRANELILLA, etc. van directamente a Prendas
  // ----------------------------------------------------
  const PRENDA_PREFIXES = [
    "PANTALON",
    "PANTALONES",
    "PANT",
    "FRANELA",
    "FRANELAS",
    "FRANELILLA",
    "FRANELILLAS",
    "CAMISA",
    "CAMISAS",
    "CAMIBUSO",
    "CAMIBUSOS",
    "CAMIBUZO",
    "CAMIBUZOS",
    "POLO",
    "CONJUNTO",
    "CONJUNTOS",
    "CORBATA",
    "CORBATAS",
    "GORRA",
    "GORRAS",
    "GORRO",
    "GORROS",
    "ZAPATO",
    "ZAPATOS",
    "CALZADO",
    "FILIPINA",
    "FILIPINAS",
    "JARDINERA",
    "JARDINERAS",
    "SUDADERA",
    "SUDADERAS",
    "BERMUDA",
    "BERMUDAS",
    "SHORT",
    "SHORTS",
    "OVEROL",
    "OVEROLES",
    "CHALECO",
    "CHALECOS",
    "DELANTAL",
    "DELANTALES",
    "BATA",
    "BATAS",
    "SACO",
    "SACOS",
    "BLUSA",
    "BLUSAS",
    "CHAQUETA",
    "CHAQUETAS",
    "UNIFORME",
    "UNIFORMES",
    "ENTERIZO",
    "ENTERIZOS",
    "DOTACION",
    "DOTACIONES",
    "CAMISETA",
    "CAMISETAS",
  ];

  for (const prefix of PRENDA_PREFIXES) {
    if (
      normDesc === prefix ||
      normDesc.startsWith(`${prefix} `) ||
      normDesc.startsWith(`${prefix}-`) ||
      normDesc.startsWith(`${prefix}/`) ||
      normDesc.startsWith(prefix)
    ) {
      return {
        categoria: "Prendas",
        requiere_revision: false,
        metodo_clasificacion: "regla_cruzada",
      };
    }
  }

  // ----------------------------------------------------
  // Paso 2: Reglas Cruzadas Específicas de Desempate
  // ----------------------------------------------------
  // Interlon / Intelon / Entretela / Fusionable -> Insumos (incluso si tienen unidad metro)
  if (
    normDesc.includes("INTERLON") ||
    normDesc.includes("INTELON") ||
    normDesc.includes("ENTRETELA") ||
    normDesc.includes("FUSIONABLE")
  ) {
    return {
      categoria: "Insumos",
      requiere_revision: false,
      metodo_clasificacion: "regla_cruzada",
    };
  }

  // Marquilla / Marquillas / Etiquetas -> Insumos (medidas por unidad)
  if (
    normDesc.startsWith("MARQUILLA") ||
    normDesc.startsWith("MARQUILLAS") ||
    normDesc.includes("MARQUILLA") ||
    normDesc.includes("MARQUILLAS") ||
    normDesc.includes("ETIQUETA")
  ) {
    return {
      categoria: "Insumos",
      requiere_revision: false,
      metodo_clasificacion: "regla_cruzada",
    };
  }

  // Todo lo que diga TELA o TELAS va directamente a la categoría Telas
  if (
    normDesc.startsWith("TELA") ||
    normDesc.startsWith("TELAS") ||
    normDesc.includes("TELA ") ||
    normDesc.includes("TELAS ") ||
    normDesc.includes(" TELA") ||
    normDesc.includes(" TELAS") ||
    normDesc === "TELA" ||
    normDesc === "TELAS"
  ) {
    return {
      categoria: "Telas",
      requiere_revision: false,
      metodo_clasificacion: "regla_cruzada",
    };
  }

  // Bolsas, Cajas, Ganchos, Embalaje, Vinipel, Stretch -> Todo va a Insumos
  if (
    normDesc.includes("BOLSA") ||
    normDesc.includes("BOLSAS") ||
    normDesc.includes("CAJA") ||
    normDesc.includes("CAJAS") ||
    normDesc.includes("GANCHO") ||
    normDesc.includes("GANCHOS") ||
    normDesc.includes("EMBALAJE") ||
    normDesc.includes("VINIPEL") ||
    normDesc.includes("STRETCH") ||
    normDesc.includes("POLIETILENO") ||
    normDesc.includes("CORRUGADO") ||
    normDesc.includes("CINTA")
  ) {
    return {
      categoria: "Insumos",
      requiere_revision: false,
      metodo_clasificacion: "regla_cruzada",
    };
  }

  // ----------------------------------------------------
  // Paso 3: Mapeo por Diccionario de Palabras Clave (Tokenizado)
  // ----------------------------------------------------
  const tokens = new Set(normDesc.split(/[\s-]+/).filter(Boolean));

  // Orden de prioridad en diccionario: Prendas > Telas > Insumos
  const priorityOrder: Array<"Prendas" | "Telas" | "Insumos"> = [
    "Prendas",
    "Telas",
    "Insumos",
  ];

  for (const cat of priorityOrder) {
    const keywords = TNS_CATEGORY_KEYWORDS[cat] || [];
    for (const kw of keywords) {
      const normKw = normalizeTNSText(kw);
      // Coincidencia de frase compuesta (ej: "SESGO ALGODON")
      if (normKw.includes(" ")) {
        if (normDesc.includes(normKw)) {
          return {
            categoria: cat,
            requiere_revision: false,
            metodo_clasificacion: "diccionario",
          };
        }
      } else {
        // Coincidencia exacta de token individual (evita falsos positivos por subcadenas)
        if (tokens.has(normKw)) {
          return {
            categoria: cat,
            requiere_revision: false,
            metodo_clasificacion: "diccionario",
          };
        }
      }
    }
  }

  // ----------------------------------------------------
  // Paso 4: Heurísticas por Unidad de Medida (Productos Nuevos)
  // ----------------------------------------------------
  if (["metro", "mts", "m", "mt"].includes(normUnit)) {
    return {
      categoria: "Telas",
      requiere_revision: false,
      metodo_clasificacion: "unidad_heuristica",
    };
  }

  if (["cono", "conos", "millar", "paquete", "rollo", "rollos"].includes(normUnit)) {
    return {
      categoria: "Insumos",
      requiere_revision: false,
      metodo_clasificacion: "unidad_heuristica",
    };
  }

  // ----------------------------------------------------
  // Paso 5: Fallback Inteligente para Productos Extraños
  // ----------------------------------------------------
  return {
    categoria: "Insumos",
    requiere_revision: true,
    metodo_clasificacion: "fallback",
  };
}

/**
 * Clasifica automáticamente el tipo de materia/categoría de un producto TNS (retorna string).
 */
export function detectTNSCategory(item: {
  prod_Dist_Desc?: string | null;
  prd_UnidadInventario?: string | null;
}): string {
  return clasificarArticuloTNS(item).categoria;
}

/**
 * Normaliza y limpia nombres de proveedores provenientes de TNS,
 * eliminando cláusulas legales excesivamente largas o razones sociales compuestas.
 */
export function cleanTNSProveedorName(rawName?: string | null): string {
  if (!rawName) return "";
  let name = rawName.trim();

  // Caso específico: Textiles Lafayette con cláusula legal larga
  if (
    name.toUpperCase().includes("TEXTILES LAFAYETTE") ||
    name.toUpperCase().includes("TELAS LAFAYETTE") ||
    name.toUpperCase().includes("LAFAYETTE SAS") ||
    name.toUpperCase().includes("LAFAYETTE")
  ) {
    return "TEXTILES LAFAYETTE SAS";
  }

  // Caso específico: telas DINAMICA / MARGARETEX sin compras registradas en TNS
  if (name.toUpperCase().includes("MARGARETEX")) {
    return "TEXTILES MARGARETEX S.A.S";
  }

  // Si contiene "PUDIENDO GIRAR BAJO..." u otras cláusulas notariales
  if (/pudiendo girar/i.test(name)) {
    name = name.split(/pudiendo girar/i)[0].trim();
  }

  // Quitar comillas y dobles espacios
  name = name.replace(/["“”]/g, "").replace(/\s+/g, " ").trim();

  return name;
}

export const MARGARETEX_SUPPLIER_NAME = "TEXTILES MARGARETEX S.A.S";

const SIN_PROVEEDOR_REGISTRADO = "Sin proveedor registrado";

/**
 * Infiere proveedor desde la descripción del material cuando TNS no trae compras.
 */
export function inferTNSProveedorFromDescription(desc?: string | null): string | null {
  if (!desc?.trim()) return null;
  if (desc.toUpperCase().includes("MARGARETEX")) {
    return MARGARETEX_SUPPLIER_NAME;
  }
  return null;
}

/**
 * Resuelve proveedor principal: datos de compras primero, inferencia por nombre después.
 */
export function resolveTNSProveedorPrincipal(item: {
  prod_Dist_Desc?: string | null;
  proveedor_principal?: string | null;
}): string {
  const current = cleanTNSProveedorName(item.proveedor_principal);
  if (current && current.toLowerCase() !== SIN_PROVEEDOR_REGISTRADO.toLowerCase()) {
    return current;
  }
  return inferTNSProveedorFromDescription(item.prod_Dist_Desc) || SIN_PROVEEDOR_REGISTRADO;
}

function enrichTNSInventarioItem(item: TNSInventarioItem): TNSInventarioItem {
  const principal = resolveTNSProveedorPrincipal(item);
  if (principal === item.proveedor_principal) {
    return item;
  }

  const proveedores = [...(item.proveedores || [])];
  if (
    principal !== SIN_PROVEEDOR_REGISTRADO &&
    !proveedores.some((p) => p.nombre.trim().toLowerCase() === principal.toLowerCase())
  ) {
    proveedores.push({ nit: "", nombre: principal });
  }

  return {
    ...item,
    proveedor_principal: principal,
    proveedores,
  };
}

function enrichTNSInventarioItems(items: TNSInventarioItem[]): TNSInventarioItem[] {
  return items.map(enrichTNSInventarioItem);
}

export const tnsService = {
  getPedidosCompra,
  formatDateToDDMMYYYY,
  parseTnsDate,
  filterPedidosCompraList,
  getPedidoNumDoc,
  getPedidoProveedor,
  getPedidoNit,
  getPedidoDireccion,
  getPedidoTelefono,
  getPedidoFecha,
  getPedidoFechaEntrega,
  getPedidoEstado,
  getPedidoConcepto,
  getPedidoTotal,
  getPedidoSubtotal,
  getPedidoDetalles,
  getDetalleCodigo,
  getDetalleDescripcion,
  getDetalleUnidad,
  getDetalleCantidad,
  getDetalleRecibido,
  getDetallePendiente,
  getDetalleValorUnitario,
  getDetalleTotal,
  // Inventario y Compras TNS
  getTNSInventario,
  getTNSInventarioSummary,
  getTNSComprasReporte,
  getTNSMaterialComprasHistorial,
  getTNSNotasInventario,
  getTNSMaterialNotasInventarioHistorial,
  getTNSOrderConsumption,
  matchTNSOrderConsumptionAlerts,
  getTNSInventoryMovementHistory,
  getTNSOrderRealMaterialCost,
  // Ventas y Facturas TNS
  getTNSVentasDetalladas,
  getTNSMaterialVentasHistorial,
  getTNSFacturas,
  getTNSFacturaDetalle,
  getTNSTransaccionalVentas,
  parseTNSNumber,
  resolveTNSMaterialUnitCost,
  formatFabricSelectionValue,
  parseFabricSelectionInput,
  parseTNSDescription,
  clasificarArticuloTNS,
  getTNSItemUnit,
  detectTNSCategory,
  cleanTNSProveedorName,
  resolveTNSProveedorPrincipal,
  inferTNSProveedorFromDescription,
  MARGARETEX_SUPPLIER_NAME,
  TNS_CATEGORY_KEYWORDS,
};



