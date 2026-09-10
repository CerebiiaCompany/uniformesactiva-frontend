import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type {
  InventoryReportResponse,
  OrdersReportResponse,
  ProductivityReportResponse,
  ProfitabilityReportResponse,
  PurchasesReportResponse,
  QuotesReportResponse,
  SalesReportResponse,
} from "@/types/reports";

export async function getOrdersReport(params?: {
  estado?: string;
  search?: string;
}): Promise<OrdersReportResponse> {
  const query = new URLSearchParams();
  if (params?.estado?.trim()) query.append("estado", params.estado.trim());
  if (params?.search?.trim()) query.append("search", params.search.trim());

  const url = endpoints.reports.orders(query.toString() || undefined);
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res?.summary && Array.isArray(res.rows)) {
    return res as OrdersReportResponse;
  }
  if (res?.data?.summary && Array.isArray(res.data.rows)) {
    return res.data as OrdersReportResponse;
  }

  return {
    status: false,
    summary: {
      total_ordenes: 0,
      ordenes_activas: 0,
      total_prendas: 0,
      venta_total: 0,
      pendientes_pago: 0,
    },
    rows: [],
  };
}

export function exportOrdersReportCsv(rows: OrdersReportResponse["rows"]): void {
  const headers = [
    "Orden",
    "Cliente",
    "Prendas",
    "Estado",
    "Etapa",
    "Creada",
    "Entrega",
    "Responsable",
    "Pago",
    "Cantidad",
    "Venta",
  ];
  const lines = rows.map((r) =>
    [
      r.codigo,
      r.cliente,
      r.prendas,
      r.estado_label,
      r.etapa_label,
      r.fecha_creacion || "",
      r.fecha_entrega || "",
      r.responsable || "",
      r.pago_label,
      String(r.cantidad),
      String(r.venta),
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-ordenes-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function getSalesReport(params?: {
  search?: string;
}): Promise<SalesReportResponse> {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.append("search", params.search.trim());

  const url = endpoints.reports.sales(query.toString() || undefined);
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res?.summary && Array.isArray(res.rows)) {
    return res as SalesReportResponse;
  }
  if (res?.data?.summary && Array.isArray(res.data.rows)) {
    return res.data as SalesReportResponse;
  }

  return {
    status: false,
    summary: {
      ventas_totales: 0,
      utilidad_estimada: 0,
      ticket_promedio: 0,
      total_ordenes: 0,
      total_prendas: 0,
      cotizaciones_total: 0,
      cotizaciones_aprobadas: 0,
    },
    rows: [],
  };
}

export function exportSalesReportCsv(rows: SalesReportResponse["rows"]): void {
  const headers = [
    "Cliente",
    "Ciudad",
    "Órdenes",
    "Cotizaciones",
    "Cotiz. aprobadas",
    "Prendas",
    "Ventas",
    "Costo",
    "Utilidad",
    "Participación %",
    "Última orden",
  ];
  const lines = rows.map((r) =>
    [
      r.cliente,
      r.ciudad,
      String(r.ordenes),
      String(r.cotizaciones),
      String(r.cotizaciones_aprobadas),
      String(r.prendas),
      String(r.ventas),
      String(r.costo),
      String(r.utilidad),
      String(r.participacion_pct),
      r.ultima_orden || "",
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-ventas-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function getProfitabilityReport(params?: {
  estado?: string;
  search?: string;
}): Promise<ProfitabilityReportResponse> {
  const query = new URLSearchParams();
  if (params?.estado?.trim()) query.append("estado", params.estado.trim());
  if (params?.search?.trim()) query.append("search", params.search.trim());

  const url = endpoints.reports.profitability(query.toString() || undefined);
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res?.summary && Array.isArray(res.rows)) {
    return res as ProfitabilityReportResponse;
  }
  if (res?.data?.summary && Array.isArray(res.data.rows)) {
    return res.data as ProfitabilityReportResponse;
  }

  return {
    status: false,
    summary: {
      venta_total: 0,
      costo_total: 0,
      utilidad: 0,
      margen_promedio: 0,
      total_ordenes: 0,
    },
    rows: [],
  };
}

export function exportProfitabilityReportCsv(
  rows: ProfitabilityReportResponse["rows"]
): void {
  const headers = [
    "Orden",
    "Cliente",
    "Cant.",
    "Costo est.",
    "Venta",
    "Utilidad",
    "Margen %",
    "Costo/unid.",
    "Venta/unid.",
  ];
  const lines = rows.map((r) =>
    [
      r.codigo,
      r.cliente,
      String(r.cantidad),
      String(r.costo_estimado),
      String(r.venta),
      String(r.utilidad),
      String(r.margen_pct),
      String(r.costo_unitario),
      String(r.venta_unitario),
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-rentabilidad-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function getProductivityReport(params?: {
  etapa?: string;
  estado?: string;
  search?: string;
}): Promise<ProductivityReportResponse> {
  const query = new URLSearchParams();
  if (params?.etapa?.trim()) query.append("etapa", params.etapa.trim());
  if (params?.estado?.trim()) query.append("estado", params.estado.trim());
  if (params?.search?.trim()) query.append("search", params.search.trim());

  const url = endpoints.reports.productivity(query.toString() || undefined);
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res?.summary && Array.isArray(res.rows)) {
    return res as ProductivityReportResponse;
  }
  if (res?.data?.summary && Array.isArray(res.data.rows)) {
    return res.data as ProductivityReportResponse;
  }

  return {
    status: false,
    summary: {
      tarjetas_activas: 0,
      retrasadas: 0,
      dias_promedio_etapa: 0,
      prendas_en_proceso: 0,
    },
    rows: [],
  };
}

export function exportProductivityReportCsv(rows: ProductivityReportResponse["rows"]): void {
  const headers = [
    "Tarjeta",
    "Orden",
    "Cliente",
    "Etapa",
    "Responsable",
    "Cant.",
    "Días en etapa",
    "Entrega",
    "Estado",
  ];
  const lines = rows.map((r) =>
    [
      r.tarjeta,
      r.orden,
      r.cliente,
      r.etapa_label,
      r.responsable,
      String(r.cantidad),
      String(r.dias_en_etapa),
      r.fecha_entrega || "",
      r.estado_label,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-eficiencia-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function getQuotesReport(params?: {
  estado?: string;
  search?: string;
}): Promise<QuotesReportResponse> {
  const query = new URLSearchParams();
  if (params?.estado?.trim()) query.append("estado", params.estado.trim());
  if (params?.search?.trim()) query.append("search", params.search.trim());

  const url = endpoints.reports.quotes(query.toString() || undefined);
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res?.summary && Array.isArray(res.rows)) {
    return res as QuotesReportResponse;
  }
  if (res?.data?.summary && Array.isArray(res.data.rows)) {
    return res.data as QuotesReportResponse;
  }

  return {
    status: false,
    summary: {
      cotizaciones_total: 0,
      monto_total: 0,
      pipeline_ponderado: 0,
      cotizaciones_aprobadas: 0,
    },
    rows: [],
  };
}

export function exportQuotesReportCsv(rows: QuotesReportResponse["rows"]): void {
  const headers = [
    "Cotización",
    "Cliente",
    "Ítems",
    "Estado",
    "Tomada por",
    "Creada",
    "Enviada",
    "Vigente hasta",
    "Novedades",
    "Prob. %",
    "Monto",
  ];
  const lines = rows.map((r) =>
    [
      r.codigo,
      r.cliente,
      r.items,
      r.estado_label,
      r.tomado_por || "",
      r.fecha_creacion || "",
      r.fecha_envio || "",
      r.vigente_hasta || "",
      String(r.novedades),
      String(r.probabilidad),
      String(r.monto),
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-cotizaciones-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function getInventoryReport(params?: {
  categoria?: string;
  estado?: string;
  search?: string;
}): Promise<InventoryReportResponse> {
  const query = new URLSearchParams();
  if (params?.categoria?.trim()) query.append("categoria", params.categoria.trim());
  if (params?.estado?.trim()) query.append("estado", params.estado.trim());
  if (params?.search?.trim()) query.append("search", params.search.trim());

  const url = endpoints.reports.inventory(query.toString() || undefined);
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res?.summary && Array.isArray(res.rows)) {
    return { status: true, ...res } as InventoryReportResponse;
  }
  if (res?.data?.summary && Array.isArray(res.data.rows)) {
    return { status: true, ...res.data } as InventoryReportResponse;
  }

  return {
    status: false,
    summary: {
      materiales_total: 0,
      valor_inventario: 0,
      stock_bajo: 0,
      movimientos_total: 0,
    },
    rows: [],
  };
}

export function exportInventoryReportCsv(rows: InventoryReportResponse["rows"]): void {
  const headers = [
    "ID",
    "Material",
    "Categoría",
    "Unidad",
    "Stock",
    "Mínimo",
    "Costo unit.",
    "Valor",
    "Proveedores",
    "Proveedor ref.",
    "Estado",
  ];
  const lines = rows.map((r) =>
    [
      r.codigo,
      r.material,
      r.categoria,
      r.unidad,
      String(r.stock),
      String(r.minimo),
      String(r.costo_unitario),
      String(r.valor),
      String(r.proveedores),
      r.proveedor_ref,
      r.estado,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-inventario-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function getPurchasesReport(params?: {
  search?: string;
  fecha_inicial?: string;
  fecha_final?: string;
}): Promise<PurchasesReportResponse> {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.append("search", params.search.trim());
  if (params?.fecha_inicial?.trim()) query.append("fecha_inicial", params.fecha_inicial.trim());
  if (params?.fecha_final?.trim()) query.append("fecha_final", params.fecha_final.trim());

  const url = endpoints.reports.purchases(query.toString() || undefined);
  const res = await http<any>(url, { skipAuthRedirect: true });

  if (res?.summary && Array.isArray(res.rows)) {
    return { status: true, ...res } as PurchasesReportResponse;
  }
  if (res?.data?.summary && Array.isArray(res.data.rows)) {
    return { status: true, ...res.data } as PurchasesReportResponse;
  }

  return {
    status: false,
    summary: {
      proveedores_total: 0,
      compras_registradas: 0,
      monto_comprado: 0,
      materiales_distintos: 0,
    },
    rows: [],
  };
}

export function exportPurchasesReportCsv(rows: PurchasesReportResponse["rows"]): void {
  const headers = [
    "Proveedor",
    "NIT",
    "Materiales",
    "Entradas",
    "Cantidad",
    "Monto",
    "Participación %",
    "Última compra",
  ];
  const lines = rows.map((r) =>
    [
      r.proveedor,
      r.nit || "",
      String(r.materiales),
      String(r.entradas),
      String(r.cantidad),
      String(r.monto),
      String(r.participacion_pct),
      r.ultima_compra || "",
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-compras-proveedor-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
