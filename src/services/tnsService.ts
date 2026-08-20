import { http, HttpError } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { getApiBaseUrl } from "@/lib/api-base";
import type {
  PedidoCompra,
  DetallePedidoCompra,
  PedidosCompraFilters,
  PedidosCompraResponse,
} from "@/types/tns";

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
};
