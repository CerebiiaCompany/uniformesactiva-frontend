import ExcelJS from "exceljs";
import { endpoints } from "@/lib/api-endpoints";
import { http } from "@/lib/http";
import { resolveMediaUrl } from "@/lib/api-base";
import {
  formatOrderShortId,
  getActiveLogoLabels,
  resolveFactoryCardInfo,
} from "@/lib/order-fields";
import type { Order } from "@/hooks/useOrders";

export interface OrderGuideClientInfo {
  name: string;
  contact: string;
  address: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDateShort(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  const months = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${d.getDate()} ${months[d.getMonth()] || ""} ${d.getFullYear()}`;
}

function fmtDateNumbers(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export async function fetchClientForOrderGuide(
  clienteId: string
): Promise<OrderGuideClientInfo | null> {
  try {
    const client = await http<{
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
    }>(endpoints.clients.detail(clienteId));

    const contactParts = [client.email, client.phone].filter(Boolean);
    const addressParts = [client.address, client.city].filter(Boolean);

    return {
      name: client.name || "—",
      contact: contactParts.length ? contactParts.join(" · ") : "—",
      address: addressParts.length ? addressParts.join(", ") : "—",
    };
  } catch {
    return null;
  }
}

export async function loadCompanyLogoDataUri(): Promise<string | null> {
  try {
    const url = `${window.location.origin}/branding/activa-uniformes-logo.png`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function loadAttachedLogoDataUri(
  rawUrl?: string | null
): Promise<string | null> {
  if (!rawUrl) return null;
  try {
    const fullUrl = resolveMediaUrl(rawUrl);
    if (!fullUrl) return null;
    const res = await fetch(fullUrl);
    if (!res.ok) return fullUrl;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(fullUrl);
      reader.readAsDataURL(blob);
    });
  } catch {
    return resolveMediaUrl(rawUrl);
  }
}

/** Agrupa o normaliza las prendas del pedido para el formato de guía de producción */
interface GarmentGroup {
  prenda: string;
  refTela: string;
  refPrenda: string;
  stock: string;
  tallaSummary: string;
  tallasDetail: string[];
  refColor: string;
  color: string;
  cantidad: number;
  ojal: string;
  boton: string;
  refCombinado: string;
  detallePrenda: string;
  hasBordado: boolean;
  ubicacionBordado: string;
  especificacionBordado: string;
  observacionBordado: string;
}

function groupGarmentsForGuide(order: Order): GarmentGroup[] {
  const factory = resolveFactoryCardInfo(order);
  const items = order.items || [];

  const logoLabels = getActiveLogoLabels(order);
  const locationMap: Record<string, string> = {
    "Mng. Der": "Manga derecha",
    "Mng. Izq": "Manga izquierda",
    "Delantero Der": "Delantero derecho",
    "Delantero Izq": "Delantero izquierdo",
    Espalda: "Espalda",
    Bolsillo: "Bolsillo",
  };
  const ubicaciones = logoLabels.map((l) => locationMap[l] || l);
  const ubicacionStr = ubicaciones.length > 0 ? ubicaciones.join(", ") : "Delantero izquierdo";

  const clientName = (order.cliente_nombre || "").trim();
  const especificacionStr = clientName
    ? `LOGO ${clientName.toUpperCase()}`
    : factory.tipoBordado !== "—"
    ? factory.tipoBordado.toUpperCase()
    : "LOGO BORDADO";

  const observacionStr = factory.observacionBordado
    ? `VER FOTO ANEXA · ${factory.observacionBordado}`
    : "VER FOTO ANEXA";

  if (!items.length) {
    return [
      {
        prenda: (order.producto_nombre || "PRENDA").toUpperCase(),
        refTela: "—",
        refPrenda: "-",
        stock: "-",
        tallaSummary: "VER HOJA TALLAJE",
        tallasDetail: [],
        refColor: "-",
        color: (order.color || "—").toUpperCase(),
        cantidad: 0,
        ojal: "AL TONO",
        boton: "AL TONO",
        refCombinado: "*",
        detallePrenda: order.comentarios || "CLASICO",
        hasBordado: factory.hasBordado,
        ubicacionBordado: ubicacionStr,
        especificacionBordado: especificacionStr,
        observacionBordado: observacionStr,
      },
    ];
  }

  const groupsMap = new Map<string, GarmentGroup>();

  for (const item of items) {
    const prendaName = (
      item.subproducto_nombre ||
      item.producto_nombre ||
      order.producto_nombre ||
      "PRENDA"
    )
      .trim()
      .toUpperCase();

    const itemColor = (item.color || order.color || "—").trim().toUpperCase();
    const groupKey = `${item.subproducto_id || prendaName}__${itemColor}`;

    const qty = Number(item.cantidad) || 0;
    const tallaName = (item.talla_nombre || "").trim();

    const existing = groupsMap.get(groupKey);
    if (!existing) {
      const refTela = (item.linea_nombre || "—").trim().toUpperCase();
      const tallaSummary = tallaName ? `Talla ${tallaName}` : "VER HOJA TALLAJE";

      const itemEst = (item as any).estampado || "";
      const prendaHasBordado =
        factory.hasBordado ||
        /borda/i.test(itemEst) ||
        /serigraf/i.test(itemEst) ||
        /transfer/i.test(itemEst) ||
        /sublima/i.test(itemEst);

      let detalle = "CLASICO";
      if (/camisa/i.test(prendaName) || /blusa/i.test(prendaName)) {
        detalle = "CLASICA\nSIN COMBINADO\nSIN BOLSILLO";
      } else if (/pantalon/i.test(prendaName) || /pantalón/i.test(prendaName)) {
        detalle = "CLASICO";
      }

      groupsMap.set(groupKey, {
        prenda: prendaName,
        refTela: refTela !== "—" ? refTela : "SUPERVERTIGO",
        refPrenda: "-",
        stock: /pantalon/i.test(prendaName) ? "BOGOTANA" : "67487",
        tallaSummary: "VER HOJA TALLAJE",
        tallasDetail: tallaName ? [`${tallaName}: ${qty}`] : [],
        refColor: "-",
        color: itemColor,
        cantidad: qty,
        ojal: "AL TONO",
        boton: "AL TONO",
        refCombinado: "*",
        detallePrenda: detalle,
        hasBordado: prendaHasBordado,
        ubicacionBordado: ubicacionStr,
        especificacionBordado: especificacionStr,
        observacionBordado: observacionStr,
      });
    } else {
      existing.cantidad += qty;
      if (tallaName) {
        existing.tallasDetail.push(`${tallaName}: ${qty}`);
      }
    }
  }

  return Array.from(groupsMap.values());
}

function buildGuideHtml(
  order: Order,
  client: OrderGuideClientInfo | null,
  logoDataUri?: string | null,
  attachedLogoUri?: string | null
): string {
  const shortId = formatOrderShortId(order.id);
  const orderNumber = `PUA-${order.id ? order.id.slice(0, 4).toUpperCase() : shortId}`;

  const clientName = (client?.name || order.cliente_nombre || "—").toUpperCase();
  const asesorName = (order.tomado_por_nombre || "MARIA PAZ").toUpperCase();

  const fechaPedido = fmtDateShort(order.fecha_creacion);
  const fechaEntregaProd = fmtDateShort(order.fecha_creacion);
  const fechaEntregaCliente = fmtDateNumbers(order.fecha_estimada_entrega);
  const todayStr = fmtDateNumbers(new Date().toISOString());

  const garments = groupGarmentsForGuide(order);

  const logoImgHtml = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Activa Uniformes" />`
    : `<div class="logo-fallback"><span class="logo-txt">▲ ACTIVA</span><span class="logo-sub">UNIFORMES</span></div>`;

  const garmentBlocksHtml = garments
    .map((g) => {
      const tallasBreakdown =
        g.tallasDetail.length > 0
          ? g.tallasDetail.join("<br/>")
          : g.tallaSummary;

      const detalleFormatted = escapeHtml(g.detallePrenda).replace(/\n/g, "<br/>");

      const bordadoBlock = g.hasBordado
        ? `
        <table class="grid-table bordado-table">
          <thead>
            <tr>
              <th colspan="3" class="section-hdr">DESCRIPCIÓN DEL BORDADO</th>
            </tr>
            <tr class="sub-hdr">
              <th style="width: 25%;">UBICACIÓN</th>
              <th style="width: 45%;">ESPECIFICACION</th>
              <th style="width: 30%;">OBSERVACION</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="center font-medium">${escapeHtml(g.ubicacionBordado)}</td>
              <td class="center bold">${escapeHtml(g.especificacionBordado)}</td>
              <td class="center bold cyan-cell">${escapeHtml(g.observacionBordado)}</td>
            </tr>
          </tbody>
        </table>`
        : "";

      return `
      <div class="garment-container">
        <table class="grid-table">
          <thead>
            <tr>
              <th colspan="6" class="section-hdr">ESPECIFICACIONES DEL PEDIDO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="lbl" style="width: 14%;">Prenda</td>
              <td colspan="5" class="val bold prenda-val">${escapeHtml(g.prenda)}</td>
            </tr>
            <tr>
              <td class="lbl" style="width: 14%;">Ref. Tela</td>
              <td class="val center font-medium" style="width: 20%;">${escapeHtml(g.refTela)}</td>
              <td class="lbl center" style="width: 16%;">Ref. Prenda</td>
              <td class="val center" style="width: 16%;">${escapeHtml(g.refPrenda)}</td>
              <td rowspan="3" colspan="2" class="tallaje-cell center">
                <div class="tallaje-title bold">VER HOJA TALLAJE</div>
                <div class="tallaje-body">${tallasBreakdown}</div>
              </td>
            </tr>
            <tr>
              <td class="lbl">Stock</td>
              <td class="val center">${escapeHtml(g.stock)}</td>
              <td class="lbl center">Talla</td>
              <td class="val center bold">${escapeHtml(g.tallaSummary)}</td>
            </tr>
            <tr>
              <td class="lbl">Ref. Color</td>
              <td class="val center">${escapeHtml(g.refColor)}</td>
              <td class="lbl center">Cantidad</td>
              <td class="val center bold">${g.cantidad}</td>
            </tr>
            <tr>
              <td class="lbl">Color</td>
              <td class="val center bold">${escapeHtml(g.color)}</td>
              <td class="lbl center">Ojal</td>
              <td class="val center">${escapeHtml(g.ojal)}</td>
              <td class="lbl center" style="width: 12%;">botón</td>
              <td class="val center" style="width: 22%;">${escapeHtml(g.boton)}</td>
            </tr>
            <tr>
              <td class="lbl">Ref. Combinado</td>
              <td class="val center">${escapeHtml(g.refCombinado)}</td>
              <td class="lbl center">Detalle prenda</td>
              <td colspan="3" class="val center detalle-val">${detalleFormatted}</td>
            </tr>
          </tbody>
        </table>
        ${bordadoBlock}
      </div>`;
    })
    .join("");

  const attachedImageSection = attachedLogoUri
    ? `
    <div class="photo-section">
      <div class="photo-title bold">REGISTRO DE MUESTRA / LOGO DE BORDADO Y ESTAMPADO</div>
      <div class="photo-frame">
        <img src="${attachedLogoUri}" alt="Muestra de bordado y logo" class="attached-img" />
      </div>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page {
      size: letter portrait;
      margin: 8mm 8mm 8mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.25;
      background: #fff;
    }
    .sheet {
      width: 100%;
      max-width: 196mm;
      margin: 0 auto;
      padding: 2mm;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
    }
    th, td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 10.5px;
      vertical-align: middle;
    }

    .center { text-align: center; }
    .bold { font-weight: 700; }
    .font-medium { font-weight: 600; }

    .header-table {
      margin-bottom: 0;
      border-bottom: none;
    }
    .header-logo-cell {
      width: 25%;
      text-align: center;
      padding: 6px;
      background: #fff;
    }
    .logo {
      max-height: 52px;
      max-width: 140px;
      object-fit: contain;
      display: inline-block;
    }
    .logo-fallback {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1.1;
    }
    .logo-txt { font-size: 14px; font-weight: 900; letter-spacing: 1px; }
    .logo-sub { font-size: 9px; letter-spacing: 2px; }

    .header-title-cell {
      width: 50%;
      text-align: center;
      font-size: 19px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .header-meta-cell {
      width: 25%;
      padding: 0;
    }
    .meta-inner-table {
      width: 100%;
      border: none;
      height: 100%;
    }
    .meta-inner-table td {
      border: none;
      border-bottom: 1px solid #000;
      padding: 2.5px 5px;
      font-size: 9.5px;
    }
    .meta-inner-table tr:last-child td {
      border-bottom: none;
    }
    .meta-lbl {
      font-weight: 700;
      width: 48%;
      border-right: 1px solid #000 !important;
      background: #fff;
    }
    .meta-val {
      text-align: center;
      width: 52%;
    }

    .order-info-table {
      margin-top: -1px;
      margin-bottom: 8px;
    }
    .order-info-table td {
      padding: 4px 6px;
    }
    .hdr-lbl {
      background: #e6e6e6;
      font-weight: 700;
      width: 18%;
    }
    .hdr-val {
      width: 32%;
    }

    .section-hdr {
      background: #d4d4d4;
      font-size: 11px;
      font-weight: 800;
      text-align: center;
      padding: 4px;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #000;
    }

    .garment-container {
      margin-bottom: 8px;
      page-break-inside: avoid;
    }
    .grid-table {
      margin-bottom: 0;
    }
    .grid-table .lbl {
      font-weight: 700;
      background: #fff;
    }
    .prenda-val {
      font-size: 11.5px;
      letter-spacing: 0.2px;
      padding-left: 8px;
    }
    .tallaje-cell {
      background: #fff;
      padding: 4px;
      vertical-align: middle;
    }
    .tallaje-title {
      font-size: 10px;
      margin-bottom: 2px;
    }
    .tallaje-body {
      font-size: 9.5px;
      color: #222;
    }
    .detalle-val {
      font-size: 9.5px;
      font-weight: 600;
      line-height: 1.2;
    }

    .bordado-table {
      margin-top: -1px;
    }
    .sub-hdr th {
      background: #fff;
      font-size: 10px;
      font-weight: 700;
      text-align: center;
      padding: 3px;
    }
    .cyan-cell {
      background: #00e5ff !important;
      color: #000;
      font-weight: 800;
      letter-spacing: 0.3px;
    }

    .photo-section {
      margin-top: 14px;
      text-align: center;
      page-break-inside: avoid;
    }
    .photo-title {
      font-size: 11px;
      margin-bottom: 6px;
      background: #e6e6e6;
      padding: 4px;
      border: 1px solid #000;
    }
    .photo-frame {
      border: 1.5px solid #000;
      padding: 8px;
      background: #fff;
      display: inline-block;
      max-width: 100%;
    }
    .attached-img {
      max-width: 100%;
      max-height: 380px;
      height: auto;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }

    @media print {
      body { background: #fff; }
      .sheet { padding: 0; max-width: 100%; }
      .garment-container { page-break-inside: avoid; }
      .photo-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <table class="header-table">
      <tr>
        <td class="header-logo-cell">
          ${logoImgHtml}
        </td>
        <td class="header-title-cell">
          ORDENES DE PEDIDOS
        </td>
        <td class="header-meta-cell">
          <table class="meta-inner-table">
            <tr>
              <td class="meta-lbl">Código:</td>
              <td class="meta-val">RG-CM-003</td>
            </tr>
            <tr>
              <td class="meta-lbl">Versión:</td>
              <td class="meta-val">0</td>
            </tr>
            <tr>
              <td class="meta-lbl">Clasificación:</td>
              <td class="meta-val">Público</td>
            </tr>
            <tr>
              <td class="meta-lbl">Fecha:</td>
              <td class="meta-val">${todayStr}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table class="order-info-table">
      <tr>
        <td class="hdr-lbl">N° Orden:</td>
        <td class="hdr-val bold">${escapeHtml(orderNumber)}</td>
        <td class="hdr-lbl">Aprobado por producción:</td>
        <td class="hdr-val"></td>
      </tr>
      <tr>
        <td class="hdr-lbl">Cliente:</td>
        <td class="hdr-val bold">${escapeHtml(clientName)}</td>
        <td class="hdr-lbl">Fecha del pedido:</td>
        <td class="hdr-val">${escapeHtml(fechaPedido)}</td>
      </tr>
      <tr>
        <td class="hdr-lbl">Asesor:</td>
        <td class="hdr-val">${escapeHtml(asesorName)}</td>
        <td class="hdr-lbl">Fecha entrega a producción:</td>
        <td class="hdr-val">${escapeHtml(fechaEntregaProd)}</td>
      </tr>
      <tr>
        <td class="hdr-lbl" style="background:#fff; border-right:none;"></td>
        <td class="hdr-val" style="border-left:none;"></td>
        <td class="hdr-lbl">Fecha entrega al cliente:</td>
        <td class="hdr-val bold">${escapeHtml(fechaEntregaCliente)}</td>
      </tr>
    </table>

    ${garmentBlocksHtml}

    ${attachedImageSection}
  </div>

  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 280);
    };
  </script>
</body>
</html>`;
}

/**
 * Abre la guía de producción lista para imprimir / guardar como PDF.
 */
export async function printOrderProductionGuide(
  order: Order,
  options?: { refreshOrder?: () => Promise<Order | null | undefined> }
): Promise<void> {
  const win = window.open("", "_blank", "width=960,height=1100");
  if (!win) {
    throw new Error(
      "El navegador bloqueó la ventana emergente. Permite pop-ups para este sitio e inténtalo de nuevo."
    );
  }

  win.document.open();
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" />
    <title></title>
    <style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#444}
    p{font-size:14px}</style></head>
    <body><p>Generando orden de pedido para producción…</p></body></html>`);
  win.document.close();

  try {
    let finalOrder = order;
    if (options?.refreshOrder) {
      const refreshed = await options.refreshOrder();
      if (refreshed) finalOrder = refreshed;
    }

    const [client, logoDataUri, attachedLogoUri] = await Promise.all([
      finalOrder.cliente_id
        ? fetchClientForOrderGuide(finalOrder.cliente_id)
        : Promise.resolve(null),
      loadCompanyLogoDataUri(),
      loadAttachedLogoDataUri(finalOrder.logo_url || finalOrder.logo),
    ]);

    if (win.closed) {
      throw new Error("La ventana de impresión se cerró antes de generar la guía.");
    }

    const html = buildGuideHtml(
      finalOrder,
      client,
      logoDataUri,
      attachedLogoUri
    );
    win.document.open();
    win.document.write(html);
    win.document.close();
    try {
      win.focus();
    } catch {
      /* ignore */
    }
  } catch (err) {
    try {
      if (!win.closed) win.close();
    } catch {
      /* ignore */
    }
    throw err;
  }
}

/**
 * Descarga la Guía de Producción / Orden de Pedido en formato Excel (.xlsx)
 * con el formato oficial de Activa Uniformes y el logo institucional.
 */
export async function downloadOrderProductionGuideExcel(
  order: Order,
  options?: { refreshOrder?: () => Promise<Order | null | undefined> }
): Promise<void> {
  let finalOrder = order;
  if (options?.refreshOrder) {
    const refreshed = await options.refreshOrder();
    if (refreshed) finalOrder = refreshed;
  }

  const [client, logoDataUri, attachedLogoUri] = await Promise.all([
    finalOrder.cliente_id
      ? fetchClientForOrderGuide(finalOrder.cliente_id)
      : Promise.resolve(null),
    loadCompanyLogoDataUri(),
    loadAttachedLogoDataUri(finalOrder.logo_url || finalOrder.logo),
  ]);

  const shortId = formatOrderShortId(finalOrder.id);
  const orderNumber = `PUA-${finalOrder.id ? finalOrder.id.slice(0, 4).toUpperCase() : shortId}`;
  const clientName = (client?.name || finalOrder.cliente_nombre || "—").toUpperCase();
  const asesorName = (finalOrder.tomado_por_nombre || "MARIA PAZ").toUpperCase();

  const fechaPedido = fmtDateShort(finalOrder.fecha_creacion);
  const fechaEntregaProd = fmtDateShort(finalOrder.fecha_creacion);
  const fechaEntregaCliente = fmtDateNumbers(finalOrder.fecha_estimada_entrega);
  const todayStr = fmtDateNumbers(new Date().toISOString());

  const garments = groupGarmentsForGuide(finalOrder);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Uniformes Activa";
  workbook.lastModifiedBy = "Uniformes Activa";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet("Orden de Pedido", {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 1, // Letter
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
    },
  });

  // 6 columnas bien proporcionadas
  worksheet.columns = [
    { key: "c1", width: 16 },
    { key: "c2", width: 22 },
    { key: "c3", width: 16 },
    { key: "c4", width: 18 },
    { key: "c5", width: 14 },
    { key: "c6", width: 22 },
  ];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };

  const grayHdrFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE6E6E6" },
  };

  const graySectionFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD4D4D4" },
  };

  const cyanFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF00E5FF" },
  };

  // 1. Logo institucional en A1:B4
  worksheet.mergeCells("A1:B4");
  ["A1", "B1", "A2", "B2", "A3", "B3", "A4", "B4"].forEach((c) => {
    worksheet.getCell(c).border = thinBorder;
  });

  if (logoDataUri) {
    try {
      const match = logoDataUri.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
      const base64 = match ? match[2] : logoDataUri;
      const extension = match && match[1].toLowerCase() === "png" ? "png" : "jpeg";
      const logoImageId = workbook.addImage({
        base64: base64,
        extension: extension as "png" | "jpeg",
      });
      worksheet.addImage(logoImageId, {
        tl: { col: 0.15, row: 0.15 },
        ext: { width: 160, height: 60 },
      });
    } catch {
      worksheet.getCell("A1").value = "ACTIVA UNIFORMES";
      worksheet.getCell("A1").font = { name: "Calibri", size: 14, bold: true };
      worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    }
  } else {
    worksheet.getCell("A1").value = "ACTIVA UNIFORMES";
    worksheet.getCell("A1").font = { name: "Calibri", size: 14, bold: true };
    worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  }

  // 2. Título Central en C1:D4
  worksheet.mergeCells("C1:D4");
  const titleCell = worksheet.getCell("C1");
  titleCell.value = "ORDENES DE PEDIDOS";
  titleCell.font = { name: "Calibri", size: 18, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ["C1", "D1", "C2", "D2", "C3", "D3", "C4", "D4"].forEach((c) => {
    worksheet.getCell(c).border = thinBorder;
  });

  // 3. Metadatos en E1:F4
  const metaRows = [
    { k: "Código:", v: "RG-CM-003" },
    { k: "Versión:", v: "0" },
    { k: "Clasificación:", v: "Público" },
    { k: "Fecha:", v: todayStr },
  ];
  metaRows.forEach((item, idx) => {
    const rowNum = idx + 1;
    const cellK = worksheet.getCell(`E${rowNum}`);
    const cellV = worksheet.getCell(`F${rowNum}`);

    cellK.value = item.k;
    cellK.font = { name: "Calibri", size: 9.5, bold: true };
    cellK.border = thinBorder;

    cellV.value = item.v;
    cellV.font = { name: "Calibri", size: 9.5 };
    cellV.alignment = { horizontal: "center", vertical: "middle" };
    cellV.border = thinBorder;
  });

  // 4. Tabla Información General de la Orden (Filas 5 a 8)
  const infoRows = [
    {
      k1: "N° Orden:",
      v1: orderNumber,
      bold1: true,
      k2: "Aprobado por producción:",
      v2: "",
      bold2: false,
    },
    {
      k1: "Cliente:",
      v1: clientName,
      bold1: true,
      k2: "Fecha del pedido:",
      v2: fechaPedido,
      bold2: false,
    },
    {
      k1: "Asesor:",
      v1: asesorName,
      bold1: false,
      k2: "Fecha entrega a producción:",
      v2: fechaEntregaProd,
      bold2: false,
    },
    {
      k1: "",
      v1: "",
      bold1: false,
      k2: "Fecha entrega al cliente:",
      v2: fechaEntregaCliente,
      bold2: true,
    },
  ];

  infoRows.forEach((r, idx) => {
    const rowNum = 5 + idx;
    const cA = worksheet.getCell(`A${rowNum}`);
    const cB = worksheet.getCell(`B${rowNum}`);
    const cC = worksheet.getCell(`C${rowNum}`);
    const cE = worksheet.getCell(`E${rowNum}`);

    // Izquierda
    cA.value = r.k1;
    if (r.k1) {
      cA.fill = grayHdrFill;
      cA.font = { name: "Calibri", size: 10, bold: true };
    }
    cA.border = thinBorder;

    cB.value = r.v1;
    cB.font = { name: "Calibri", size: 10, bold: r.bold1 };
    cB.border = thinBorder;

    // Derecha (C..D y E..F)
    worksheet.mergeCells(`C${rowNum}:D${rowNum}`);
    cC.value = r.k2;
    if (r.k2) {
      cC.fill = grayHdrFill;
      cC.font = { name: "Calibri", size: 10, bold: true };
    }
    ["C", "D"].forEach((col) => (worksheet.getCell(`${col}${rowNum}`).border = thinBorder));

    worksheet.mergeCells(`E${rowNum}:F${rowNum}`);
    cE.value = r.v2;
    cE.font = { name: "Calibri", size: 10, bold: r.bold2 };
    cE.alignment = { horizontal: "center", vertical: "middle" };
    ["E", "F"].forEach((col) => (worksheet.getCell(`${col}${rowNum}`).border = thinBorder));
  });

  let curRow = 10;

  // 5. Bloques de Prendas
  for (const g of garments) {
    const tallasBreakdown =
      g.tallasDetail.length > 0
        ? g.tallasDetail.join("\n")
        : g.tallaSummary;

    // Header Prenda
    worksheet.mergeCells(`A${curRow}:F${curRow}`);
    const secHdr = worksheet.getCell(`A${curRow}`);
    secHdr.value = "ESPECIFICACIONES DEL PEDIDO";
    secHdr.fill = graySectionFill;
    secHdr.font = { name: "Calibri", size: 11, bold: true };
    secHdr.alignment = { horizontal: "center", vertical: "middle" };
    ["A", "B", "C", "D", "E", "F"].forEach((c) => (worksheet.getCell(`${c}${curRow}`).border = thinBorder));
    curRow++;

    // Fila Prenda
    worksheet.getCell(`A${curRow}`).value = "Prenda";
    worksheet.getCell(`A${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`A${curRow}`).border = thinBorder;

    worksheet.mergeCells(`B${curRow}:F${curRow}`);
    const prendaVal = worksheet.getCell(`B${curRow}`);
    prendaVal.value = g.prenda;
    prendaVal.font = { name: "Calibri", size: 11, bold: true };
    ["B", "C", "D", "E", "F"].forEach((c) => (worksheet.getCell(`${c}${curRow}`).border = thinBorder));
    curRow++;

    const rowStart3 = curRow;

    // Fila Ref. Tela
    worksheet.getCell(`A${curRow}`).value = "Ref. Tela";
    worksheet.getCell(`A${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`A${curRow}`).border = thinBorder;

    worksheet.getCell(`B${curRow}`).value = g.refTela;
    worksheet.getCell(`B${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`B${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`B${curRow}`).border = thinBorder;

    worksheet.getCell(`C${curRow}`).value = "Ref. Prenda";
    worksheet.getCell(`C${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`C${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`C${curRow}`).border = thinBorder;

    worksheet.getCell(`D${curRow}`).value = g.refPrenda;
    worksheet.getCell(`D${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`D${curRow}`).border = thinBorder;
    curRow++;

    // Fila Stock
    worksheet.getCell(`A${curRow}`).value = "Stock";
    worksheet.getCell(`A${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`A${curRow}`).border = thinBorder;

    worksheet.getCell(`B${curRow}`).value = g.stock;
    worksheet.getCell(`B${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`B${curRow}`).border = thinBorder;

    worksheet.getCell(`C${curRow}`).value = "Talla";
    worksheet.getCell(`C${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`C${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`C${curRow}`).border = thinBorder;

    worksheet.getCell(`D${curRow}`).value = g.tallaSummary;
    worksheet.getCell(`D${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`D${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`D${curRow}`).border = thinBorder;
    curRow++;

    // Fila Ref. Color
    worksheet.getCell(`A${curRow}`).value = "Ref. Color";
    worksheet.getCell(`A${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`A${curRow}`).border = thinBorder;

    worksheet.getCell(`B${curRow}`).value = g.refColor;
    worksheet.getCell(`B${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`B${curRow}`).border = thinBorder;

    worksheet.getCell(`C${curRow}`).value = "Cantidad";
    worksheet.getCell(`C${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`C${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`C${curRow}`).border = thinBorder;

    worksheet.getCell(`D${curRow}`).value = g.cantidad;
    worksheet.getCell(`D${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`D${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`D${curRow}`).border = thinBorder;

    // Merge Tallaje en E(rowStart3):F(curRow)
    worksheet.mergeCells(`E${rowStart3}:F${curRow}`);
    const tallajeCell = worksheet.getCell(`E${rowStart3}`);
    tallajeCell.value = `VER HOJA TALLAJE\n${tallasBreakdown}`;
    tallajeCell.font = { name: "Calibri", size: 9.5, bold: true };
    tallajeCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    for (let r = rowStart3; r <= curRow; r++) {
      ["E", "F"].forEach((col) => (worksheet.getCell(`${col}${r}`).border = thinBorder));
    }
    curRow++;

    // Fila Color / Ojal / Botón
    worksheet.getCell(`A${curRow}`).value = "Color";
    worksheet.getCell(`A${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`A${curRow}`).border = thinBorder;

    worksheet.getCell(`B${curRow}`).value = g.color;
    worksheet.getCell(`B${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`B${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`B${curRow}`).border = thinBorder;

    worksheet.getCell(`C${curRow}`).value = "Ojal";
    worksheet.getCell(`C${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`C${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`C${curRow}`).border = thinBorder;

    worksheet.getCell(`D${curRow}`).value = g.ojal;
    worksheet.getCell(`D${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`D${curRow}`).border = thinBorder;

    worksheet.getCell(`E${curRow}`).value = "botón";
    worksheet.getCell(`E${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`E${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`E${curRow}`).border = thinBorder;

    worksheet.getCell(`F${curRow}`).value = g.boton;
    worksheet.getCell(`F${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`F${curRow}`).border = thinBorder;
    curRow++;

    // Fila Ref. Combinado / Detalle prenda
    worksheet.getCell(`A${curRow}`).value = "Ref. Combinado";
    worksheet.getCell(`A${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`A${curRow}`).border = thinBorder;

    worksheet.getCell(`B${curRow}`).value = g.refCombinado;
    worksheet.getCell(`B${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`B${curRow}`).border = thinBorder;

    worksheet.getCell(`C${curRow}`).value = "Detalle prenda";
    worksheet.getCell(`C${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`C${curRow}`).font = { name: "Calibri", size: 10, bold: true };
    worksheet.getCell(`C${curRow}`).border = thinBorder;

    worksheet.mergeCells(`D${curRow}:F${curRow}`);
    const detalleCell = worksheet.getCell(`D${curRow}`);
    detalleCell.value = g.detallePrenda;
    detalleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    detalleCell.font = { name: "Calibri", size: 9.5, bold: true };
    ["D", "E", "F"].forEach((col) => (worksheet.getCell(`${col}${curRow}`).border = thinBorder));
    curRow++;

    // Fila Descripción del Bordado
    if (g.hasBordado) {
      worksheet.mergeCells(`A${curRow}:F${curRow}`);
      const bordadoHdr = worksheet.getCell(`A${curRow}`);
      bordadoHdr.value = "DESCRIPCIÓN DEL BORDADO";
      bordadoHdr.fill = graySectionFill;
      bordadoHdr.font = { name: "Calibri", size: 11, bold: true };
      bordadoHdr.alignment = { horizontal: "center", vertical: "middle" };
      ["A", "B", "C", "D", "E", "F"].forEach((c) => (worksheet.getCell(`${c}${curRow}`).border = thinBorder));
      curRow++;

      // Subheaders
      worksheet.mergeCells(`A${curRow}:B${curRow}`);
      const subA = worksheet.getCell(`A${curRow}`);
      subA.value = "UBICACIÓN";
      subA.font = { name: "Calibri", size: 9.5, bold: true };
      subA.alignment = { horizontal: "center", vertical: "middle" };
      ["A", "B"].forEach((c) => (worksheet.getCell(`${c}${curRow}`).border = thinBorder));

      worksheet.mergeCells(`C${curRow}:D${curRow}`);
      const subC = worksheet.getCell(`C${curRow}`);
      subC.value = "ESPECIFICACION";
      subC.font = { name: "Calibri", size: 9.5, bold: true };
      subC.alignment = { horizontal: "center", vertical: "middle" };
      ["C", "D"].forEach((c) => (worksheet.getCell(`${c}${curRow}`).border = thinBorder));

      worksheet.mergeCells(`E${curRow}:F${curRow}`);
      const subE = worksheet.getCell(`E${curRow}`);
      subE.value = "OBSERVACION";
      subE.font = { name: "Calibri", size: 9.5, bold: true };
      subE.alignment = { horizontal: "center", vertical: "middle" };
      ["E", "F"].forEach((c) => (worksheet.getCell(`${c}${curRow}`).border = thinBorder));
      curRow++;

      // Valores de Bordado
      worksheet.mergeCells(`A${curRow}:B${curRow}`);
      const valA = worksheet.getCell(`A${curRow}`);
      valA.value = g.ubicacionBordado;
      valA.alignment = { horizontal: "center", vertical: "middle" };
      valA.font = { name: "Calibri", size: 9.5, bold: true };
      ["A", "B"].forEach((c) => (worksheet.getCell(`${c}${curRow}`).border = thinBorder));

      worksheet.mergeCells(`C${curRow}:D${curRow}`);
      const valC = worksheet.getCell(`C${curRow}`);
      valC.value = g.especificacionBordado;
      valC.alignment = { horizontal: "center", vertical: "middle" };
      valC.font = { name: "Calibri", size: 9.5, bold: true };
      ["C", "D"].forEach((c) => (worksheet.getCell(`${c}${curRow}`).border = thinBorder));

      worksheet.mergeCells(`E${curRow}:F${curRow}`);
      const valE = worksheet.getCell(`E${curRow}`);
      valE.value = g.observacionBordado;
      valE.fill = cyanFill;
      valE.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF000000" } };
      valE.alignment = { horizontal: "center", vertical: "middle" };
      ["E", "F"].forEach((c) => (worksheet.getCell(`${c}${curRow}`).border = thinBorder));
      curRow++;
    }

    curRow++; // Espacio entre prendas
  }

  // 6. Imagen adjunta del logo si existe
  if (attachedLogoUri) {
    try {
      const match = attachedLogoUri.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
      const base64 = match ? match[2] : attachedLogoUri;
      const extension = match && match[1].toLowerCase() === "png" ? "png" : "jpeg";
      const attachedImageId = workbook.addImage({
        base64: base64,
        extension: extension as "png" | "jpeg",
      });

      worksheet.mergeCells(`A${curRow}:F${curRow}`);
      const imgHdr = worksheet.getCell(`A${curRow}`);
      imgHdr.value = "REGISTRO DE MUESTRA / LOGO DE BORDADO Y ESTAMPADO";
      imgHdr.fill = graySectionFill;
      imgHdr.font = { name: "Calibri", size: 10.5, bold: true };
      imgHdr.alignment = { horizontal: "center", vertical: "middle" };
      ["A", "B", "C", "D", "E", "F"].forEach((c) => (worksheet.getCell(`${c}${curRow}`).border = thinBorder));
      curRow++;

      worksheet.addImage(attachedImageId, {
        tl: { col: 1.2, row: curRow - 1 + 0.2 },
        ext: { width: 320, height: 240 },
      });
      curRow += 14;
    } catch {
      /* ignore image insert error */
    }
  }

  // 7. Descarga del archivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeClient = clientName.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 30);
  a.download = `Guia_Produccion_${orderNumber}_${safeClient}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
