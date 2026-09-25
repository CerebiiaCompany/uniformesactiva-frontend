import ExcelJS from "exceljs";
import { formatCurrency } from "@/lib/format-number";
import {
  fetchClientForOrderGuide,
  loadCompanyLogoDataUri,
  type OrderGuideClientInfo,
} from "@/lib/order-production-guide";
import { getActiveLogoLabels } from "@/lib/order-fields";
import { normalizeTallaCatalog } from "@/lib/talla-catalog";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { Quote, QuoteOrderPayload } from "@/hooks/useQuotes";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMoney(value: string | number): string {
  return `$ ${formatCurrency(value)}`;
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString("es-CO");
}

export type QuotePrintItem = {
  producto_nombre?: string | null;
  subproducto_nombre?: string | null;
  subproducto_id?: string | null;
  talla_nombre?: string | null;
  talla_id?: string | null;
  cantidad: number;
  color?: string | null;
  precio_unitario?: number | null;
  articulo_completo?: string | null;
  fabric_reference?: string | null;
  fabric_proveedor?: string | null;
  fabric_descripcion?: string | null;
};

function labelByVariantId(payload: QuoteOrderPayload): Map<string, string> {
  const map = new Map<string, string>();
  const labels = payload.product_labels || [];
  const seen: string[] = [];
  for (const item of payload.items || []) {
    const id = item.subproducto_id;
    if (!id || seen.includes(id)) continue;
    const idx = seen.length;
    seen.push(id);
    const label = (labels[idx] || "").trim();
    if (label) map.set(id, label);
  }
  return map;
}

function resolveUnitPrice(
  item: QuoteOrderPayload["items"][number],
  fallbackUnit: number | null
): number | null {
  const sale = Number(item.precio_venta_unitario);
  if (Number.isFinite(sale) && sale > 0) return sale;

  if (fallbackUnit !== null && fallbackUnit > 0) return fallbackUnit;
  return null;
}

function buildArticuloText(
  item: {
    producto_nombre?: string | null;
    subproducto_nombre?: string | null;
    talla_nombre?: string | null;
    color?: string | null;
  },
  fabric: {
    reference?: string | null;
    proveedor_nombre?: string | null;
    descripcion?: string | null;
  } | null,
  payload?: QuoteOrderPayload
): string {
  const prod = (item.producto_nombre || "").trim();
  const sub = (item.subproducto_nombre || "").trim();
  const talla = (item.talla_nombre || "").trim();

  let name = "";
  if (prod && sub) {
    if (sub.toLowerCase().startsWith(prod.toLowerCase())) {
      name = sub;
    } else if (prod.toLowerCase().startsWith(sub.toLowerCase())) {
      name = prod;
    } else if (prod.toLowerCase() !== sub.toLowerCase()) {
      name = `${prod} ${sub}`;
    } else {
      name = prod;
    }
  } else {
    name = prod || sub || "Prenda";
  }

  let text = name;

  if (talla) {
    text += ` talla ${talla}`;
  }

  if (fabric?.reference) {
    text += ` en referencia ${fabric.reference}`;
    if (fabric.proveedor_nombre) {
      text += ` Proveedor ${fabric.proveedor_nombre}`;
    }
  }

  if (item.color) {
    text += `, color ${item.color}`;
  }

  if (fabric?.descripcion) {
    const desc = fabric.descripcion.trim();
    if (desc) {
      if (desc.startsWith(",")) {
        text += ` ${desc.replace(/^,\s*/, "")}`;
      } else {
        text += ` composicion ${desc.replace(/^composici[oó]n\s*/i, "")}`;
      }
    }
  }

  const hasLogos =
    Boolean(payload?.estampado?.trim()) ||
    (payload ? getActiveLogoLabels(payload).length > 0 : false);

  if (hasLogos) {
    text += `, con un bordado incluido y especificacion del cliente.`;
  } else {
    text += ` y especificacion del cliente.`;
  }

  return text;
}

/**
 * Resuelve tallas, precios y descripción de telas principales para cotización.
 */
export async function enrichQuotePrintItems(quote: Quote): Promise<QuotePrintItem[]> {
  const payload = (quote.orderPayload || {}) as QuoteOrderPayload;
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  if (!rawItems.length) {
    return (quote.items || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((label) => ({
        producto_nombre: label,
        subproducto_nombre: null,
        talla_nombre: null,
        cantidad: 0,
        color: null,
        precio_unitario: null,
        articulo_completo: label,
      }));
  }

  const needsTallaName = rawItems.some(
    (i) => !(i.talla_nombre || "").trim() && Boolean(i.talla_id)
  );

  let tallaNameById = new Map<string, string>();
  if (needsTallaName) {
    try {
      const tallas = await http<unknown[]>(endpoints.costos.tallas());
      const catalog = normalizeTallaCatalog(tallas);
      tallaNameById = new Map(
        catalog.map((t) => [
          t.id,
          (t.label || t.name || t.code || "").trim() || t.id,
        ])
      );
      for (const t of catalog) {
        if (t.code) tallaNameById.set(String(t.code), (t.label || t.name || t.code).trim());
      }
    } catch {
      /* catálogo opcional */
    }
  }

  // Cargar telas principales para cada subproducto_id
  const uniqueVariantIds = Array.from(
    new Set(
      rawItems
        .map((i) => i.subproducto_id)
        .filter(Boolean) as string[]
    )
  );

  const fabricByVariantId = new Map<
    string,
    { reference: string; proveedor_nombre: string; descripcion: string }
  >();

  if (uniqueVariantIds.length > 0) {
    try {
      const [proveedores, ...fabricsPerVariant] = await Promise.all([
        http<any[]>(endpoints.costos.proveedores()).catch(() => []),
        ...uniqueVariantIds.map((vid) =>
          http<any[]>(endpoints.costos.telaByVariant(vid)).catch(() => [])
        ),
      ]);

      const provMap = new Map(
        (Array.isArray(proveedores) ? proveedores : []).map((p: any) => [
          String(p.id),
          p.name || p.label || "",
        ])
      );

      uniqueVariantIds.forEach((vid, idx) => {
        const list = fabricsPerVariant[idx];
        if (Array.isArray(list) && list.length > 0) {
          const principal = list.find((f: any) => f.es_principal) || list[0];
          const provId = String(principal.proveedor_id || principal.proveedor?.id || "");
          const provName =
            principal.proveedor_nombre ||
            principal.proveedor?.name ||
            (provId && provMap.get(provId)) ||
            "";

          fabricByVariantId.set(vid, {
            reference: (principal.reference || principal.codigo || "").trim(),
            proveedor_nombre: (provName || "").trim(),
            descripcion: (principal.descripcion || "").trim(),
          });
        }
      });
    } catch {
      /* ignore fabric loading errors */
    }
  }

  const totalQty = rawItems.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
  const saleValue = Number(payload.valor_venta_proyectado ?? quote.totalAmount) || 0;
  const hasAnyStoredPrice = rawItems.some(
    (i) => (Number(i.precio_venta_unitario) || 0) > 0
  );
  const fallbackUnit =
    !hasAnyStoredPrice && totalQty > 0 && saleValue > 0
      ? saleValue / totalQty
      : null;

  const variantLabels = labelByVariantId(payload);

  return rawItems.map((item) => {
    const variantLabel = variantLabels.get(item.subproducto_id) || "";
    const tallaFromCatalog =
      (item.talla_id && tallaNameById.get(String(item.talla_id))) || "";
    const fabric = item.subproducto_id ? fabricByVariantId.get(item.subproducto_id) || null : null;

    const producto_nombre = (item.producto_nombre || "").trim() || null;
    const subproducto_nombre =
      (item.subproducto_nombre || "").trim() || variantLabel || null;
    const talla_nombre =
      (item.talla_nombre || "").trim() || tallaFromCatalog || null;

    const articulo_completo = buildArticuloText(
      { producto_nombre, subproducto_nombre, talla_nombre, color: item.color },
      fabric,
      payload
    );

    return {
      producto_nombre,
      subproducto_nombre,
      subproducto_id: item.subproducto_id || null,
      talla_nombre,
      talla_id: item.talla_id || null,
      cantidad: Number(item.cantidad) || 0,
      color: item.color || null,
      precio_unitario: resolveUnitPrice(item, fallbackUnit),
      articulo_completo,
      fabric_reference: fabric?.reference || null,
      fabric_proveedor: fabric?.proveedor_nombre || null,
      fabric_descripcion: fabric?.descripcion || null,
    };
  });
}

export async function loadRepresentativeSignatureDataUri(): Promise<string | null> {
  try {
    const url = `${window.location.origin}/branding/firma-representante-legal.jpg`;
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

function buildQuoteGuideHtml(
  quote: Quote,
  client: OrderGuideClientInfo | null,
  items: QuotePrintItem[],
  logoDataUri?: string | null,
  signatureDataUri?: string | null
): string {
  const payload = (quote.orderPayload || {}) as QuoteOrderPayload;
  const clientName = client?.name || quote.customerName || "—";
  const contact = client?.contact || client?.phone || "—";
  const address = client?.address || "—";
  const quoteDate = fmtDate(quote.createdAt || payload.fecha_estimada_entrega || new Date().toISOString());
  const saleValue = Number(payload.valor_venta_proyectado ?? quote.totalAmount) || 0;

  let linesSaleSum = 0;
  const rows = items
    .map((item) => {
      const qty = Number(item.cantidad) || 0;
      const unit =
        item.precio_unitario !== null &&
        item.precio_unitario !== undefined &&
        Number.isFinite(item.precio_unitario)
          ? Number(item.precio_unitario)
          : null;
      const lineTotal = unit !== null && qty > 0 ? unit * qty : null;
      if (lineTotal !== null) linesSaleSum += lineTotal;

      const articuloText = item.articulo_completo || item.producto_nombre || "—";

      return `
        <tr>
          <td class="cell-cant">${qty > 0 ? qty : ""}</td>
          <td class="cell-art">${escapeHtml(articuloText)}</td>
          <td class="cell-num">${unit !== null ? escapeHtml(fmtMoney(unit)) : "$ -"}</td>
          <td class="cell-num">${lineTotal !== null ? escapeHtml(fmtMoney(lineTotal)) : "$ -"}</td>
        </tr>`;
    })
    .join("");

  const invoiceTotal = linesSaleSum > 0 ? linesSaleSum : saleValue;

  const logoBlock = logoDataUri
    ? `<img class="logo-img" src="${logoDataUri}" alt="Activa Uniformes" />`
    : `<div class="logo-text">ACTIVA<br/><span style="font-size:12px;font-weight:600;letter-spacing:2px;">UNIFORMES</span></div>`;

  const signatureBlock = signatureDataUri
    ? `<img class="signature-img" src="${signatureDataUri}" alt="Firma María de la Paz Parada" />`
    : `<div class="signature-space"></div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page {
      size: auto;
      margin: 0;
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
      line-height: 1.3;
      background: #fff;
    }
    .sheet {
      max-width: 195mm;
      margin: 0 auto;
      padding: 7mm 12mm 8mm;
    }

    /* HEADER */
    .header-container {
      position: relative;
      width: 100%;
      margin-bottom: 8px;
      min-height: 74px;
    }
    .header-logo-wrap {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 100px;
      text-align: left;
    }
    .logo-img {
      max-width: 95px;
      max-height: 70px;
      object-fit: contain;
    }
    .logo-text {
      font-size: 16px;
      font-weight: 900;
      color: #111;
      text-align: left;
      line-height: 1.1;
    }
    .header-info-wrap {
      width: 100%;
      text-align: center;
      margin: 0 auto;
    }
    .company-title {
      font-size: 25px;
      font-weight: 900;
      color: #c00000;
      margin: 0 0 2px;
      letter-spacing: 0.5px;
    }
    .company-nit {
      font-size: 12px;
      font-weight: 800;
      margin: 1px 0;
      color: #111;
    }
    .company-desc {
      font-size: 10px;
      margin: 2px 0;
      color: #222;
    }
    .company-address {
      font-size: 10px;
      font-weight: 600;
      margin: 1.5px 0;
    }
    .company-contact {
      font-size: 10px;
      font-weight: 600;
      margin: 1.5px 0;
    }

    /* TITLE */
    .quote-title {
      color: #c00000;
      font-size: 20px;
      font-weight: 900;
      text-align: center;
      margin: 8px 0 8px;
      letter-spacing: 1.5px;
    }

    /* CLIENT TABLE */
    .client-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
    }
    .client-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 10.5px;
    }
    .client-header {
      background-color: #c00000 !important;
      color: #fff !important;
      font-weight: 800;
      text-align: center;
      width: 13%;
      text-transform: uppercase;
    }
    .client-val {
      color: #000;
      font-weight: 600;
    }
    .date-header {
      background-color: #c00000 !important;
      color: #fff !important;
      font-weight: 800;
      text-align: center;
      width: 10%;
    }
    .date-val {
      text-align: center;
      font-weight: 800;
      width: 15%;
    }

    /* PRODUCTS TABLE */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: -1px;
      margin-bottom: 0;
    }
    .items-table th {
      background-color: #c00000 !important;
      color: #fff !important;
      font-weight: 800;
      font-size: 10.5px;
      border: 1px solid #000;
      padding: 5px 4px;
      text-align: center;
      text-transform: uppercase;
    }
    .col-cant { width: 8%; }
    .col-art { width: 66%; }
    .col-unit { width: 13%; }
    .col-tot { width: 13%; }

    .items-table td {
      border: 1px solid #000;
      padding: 5px 6px;
      font-size: 10px;
      vertical-align: middle;
    }
    .cell-cant {
      text-align: center;
      font-weight: 700;
    }
    .cell-art {
      text-align: center;
      line-height: 1.3;
    }
    .cell-num {
      text-align: center;
      white-space: nowrap;
      font-weight: 600;
    }

    /* TOTAL ROW */
    .total-header {
      background-color: #c00000 !important;
      color: #fff !important;
      font-weight: 900;
      text-align: right;
      padding-right: 12px !important;
      font-size: 11px;
      border: 1px solid #000;
    }
    .total-val {
      font-weight: 800;
      font-size: 11px;
      text-align: center;
      white-space: nowrap;
      border: 1px solid #000;
    }

    /* NOTE BOX */
    .note-box {
      border: 1px solid #000;
      border-top: none;
      padding: 6px 10px;
      font-size: 9.5px;
      line-height: 1.3;
      text-align: center;
      margin-bottom: 8px;
    }
    .note-line {
      margin: 0 0 3px;
    }
    .note-zese {
      font-weight: 800;
      margin: 3px 0 0;
    }

    /* CONDITIONS SECTION */
    .conditions-wrapper {
      margin-top: 4px;
    }
    .conditions-main-title {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 14.5px;
      font-weight: 900;
      text-align: center;
      margin: 6px 0 5px;
      letter-spacing: 0.5px;
    }
    .condition-block {
      margin-bottom: 4px;
      font-size: 9.5px;
      line-height: 1.28;
    }
    .condition-block-title {
      font-size: 10px;
      font-weight: 800;
      margin-bottom: 1px;
    }
    .condition-text {
      margin: 1.5px 0 1.5px 12px;
      text-indent: -8px;
    }
    .condition-alert {
      margin: 2px 0 2px 12px;
      font-weight: 800;
      font-size: 9.5px;
    }

    /* CLOSING & SIGNATURE */
    .closing-text {
      font-size: 9.5px;
      margin: 6px 0 4px;
    }
    .signature-area {
      margin-top: 6px;
      font-size: 10px;
      page-break-inside: avoid;
    }
    .signature-wrapper {
      margin-top: 4px;
      display: inline-block;
      text-align: left;
    }
    .signature-img {
      display: block;
      height: 46px;
      width: auto;
      max-width: 190px;
      object-fit: contain;
      margin-bottom: 1px;
      mix-blend-mode: multiply;
    }
    .signature-space {
      height: 32px;
    }
    .signature-name {
      font-weight: 800;
      font-size: 11px;
      line-height: 1.2;
    }
    .signature-role {
      font-weight: 400;
      font-size: 10px;
      line-height: 1.2;
    }

    @media print {
      html, body {
        background: #fff;
        margin: 0;
        padding: 0;
      }
      .no-print { display: none !important; }
      .sheet {
        padding: 7mm 12mm 8mm;
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <!-- HEADER -->
    <div class="header-container">
      <div class="header-logo-wrap">
        ${logoBlock}
      </div>
      <div class="header-info-wrap">
        <div class="company-title">Uniformes Activa</div>
        <div class="company-nit">NIT 1090431678-0 &nbsp; Régimen Simplificado</div>
        <div class="company-desc">Empresa productora y comercializadora de prendas de alta calidad para dotación empresarial e institucional</div>
        <div class="company-address">📍 Calle 2 N° 5-53 Barrio Pescadero-Cúcuta</div>
        <div class="company-contact">📞 3208931421 &nbsp;&nbsp; ✉ comercialuniformesactiva@gmail.com</div>
      </div>
    </div>

    <div class="quote-title">COTIZACIÓN</div>

    <!-- CLIENT INFO -->
    <table class="client-table">
      <tr>
        <td class="client-header">CLIENTE</td>
        <td class="client-val" colspan="3">${escapeHtml(clientName)}</td>
      </tr>
      <tr>
        <td class="client-header">CONTACTO</td>
        <td class="client-val" colspan="3">${escapeHtml(contact)}</td>
      </tr>
      <tr>
        <td class="client-header">DIRECCIÓN</td>
        <td class="client-val">${escapeHtml(address)}</td>
        <td class="date-header">FECHA:</td>
        <td class="date-val">${escapeHtml(quoteDate)}</td>
      </tr>
    </table>

    <!-- PRODUCTS TABLE -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-cant">CANT</th>
          <th class="col-art">ARTICULO</th>
          <th class="col-unit">VR. UNIT</th>
          <th class="col-tot">VR. TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows ||
          `<tr><td colspan="4" style="text-align: center; padding: 10px;">Sin prendas registradas en esta cotización.</td></tr>`
        }
        <tr>
          <td colspan="3" class="total-header">TOTAL</td>
          <td class="total-val">${invoiceTotal > 0 ? escapeHtml(fmtMoney(invoiceTotal)) : "$ -"}</td>
        </tr>
      </tbody>
    </table>

    <!-- NOTE BOX -->
    <div class="note-box">
      <div class="note-line"><strong>Nota:</strong> La Fecha de entrega es de 20 dias hábiles, para iniciar el proceso de producción de la presente cotización es importante dar un abono del 50% del valor de la factura. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; La presente cotización tiene una validez 8 dias calendario a partir de la fecha la cual fue recibida.</div>
      <div class="note-zese">Favor abstenerse de aplicar retenciones ya que nos encontramos acogidos al regimen especial ZESE art 268 ley 1955/2019</div>
    </div>

    <!-- CONDICIONES DE LA OFERTA -->
    <div class="conditions-wrapper">
      <div class="conditions-main-title">CONDICIONES DE LA OFERTA</div>

      <div class="condition-block">
        <div class="condition-block-title">1. CONDICIONES PARA LA TOMA DE MEDIDAS Y ENTREGA DE UNIFORMES</div>
        <div class="condition-text">- Las tallas se miden de acuerdo a nuestro tallaje para confirmar con exactitud la talla solicitada.</div>
        <div class="condition-text">- El personal de la organización debe permitir que el asesor de Uniformes Activa verifique que la talla seleccionada sea la indicada, y tener en cuenta las recomendaciones realizadas, de lo contrario no se responderá por ajustes en el momento de la entrega.</div>
        <div class="condition-text">- Las personas que se mida las tallas con faja, deberá así mismo tenerla el día de la entrega de las prendas, esto con el fin de evitar inconformidades en los ajustes.</div>
        <div class="condition-text">- Se realizará un único ajuste posterior a la entrega de los uniformes relacionados a corrección de defectos de fábrica, tamaño de las prendas y/o especificaciones indicadas en el momento del tallaje. Por lo tanto, el personal debe comprobar el uniforme en el momento de la entrega o hasta el tiempo permitido y reportar todas las novedades, ya que no se realizará una segunda revisión.</div>
        <div class="condition-text">- No se realizarán ajustes personalizados que no correspondan al diseño inicial de los uniformes. Los pantalones serán entregan sin ruedos.</div>
      </div>

      <div class="condition-block">
        <div class="condition-block-title">2. TIEMPO DE ENTREGA</div>
        <div class="condition-text">- El tiempo de entrega es de 20 días hábiles. El tiempo de entrega inicia desde que se recibe el anticipo y se completa la toma del tallaje. En caso de modificaciones en el tiempo de entrega ocasionada por cambios con el proveedor, se informará al cliente oportunamente.</div>
        <div class="condition-alert">(PARA MAS DE 100 PRENDAS EL TIEMPO DE ENTREGA ES DE 30 DÍAS HABILES)</div>
      </div>

      <div class="condition-block">
        <div class="condition-block-title">3. TIEMPO DE MODIFICACIONES</div>
        <div class="condition-text">- Las modificaciones deben ser reportadas máximo un día hábil posterior a la entrega de la dotación. No se realizarán ajustes a prendas ya utilizadas o sucias o que hayan sido alteradas o modificadas por terceros.</div>
      </div>

      <div class="condition-block">
        <div class="condition-block-title">4. FORMA DE PAGO</div>
        <div class="condition-text">- Para el ingreso del pedido a producción se requiere el pago del 50% del valor total de la oferta, el 50% restante será cancelado dentro de los 8 días hábiles siguientes al recibido a satisfacción del pedido.</div>
      </div>

      <div class="condition-block">
        <div class="condition-block-title">5. VALIDEZ DE LA OFERTA</div>
        <div class="condition-text">- La oferta presentada tendrá una validez de 8 días calendario</div>
      </div>

      <div class="closing-text">Agradecemos su atención y estamos a su orden ante cualquier solicitud o requerimiento adicional.</div>

      <div class="signature-area">
        <div>Atentamente,</div>
        <div class="signature-wrapper">
          ${signatureBlock}
          <div class="signature-name">María de la Paz Parada</div>
          <div class="signature-role">Representante Legal</div>
        </div>
      </div>
    </div>
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
 * Abre el recibo/cotización lista para imprimir / guardar como PDF.
 * Abre la ventana de forma síncrona (gesto del usuario) y luego carga datos.
 */
export async function printQuoteProductionGuide(
  quote: Quote,
  options?: { refreshQuote?: () => Promise<Quote | null | undefined> }
): Promise<void> {
  const win = window.open("", "_blank", "width=920,height=1100");
  if (!win) {
    throw new Error(
      "El navegador bloqueó la ventana emergente. Permite pop-ups para este sitio e inténtalo de nuevo."
    );
  }

  win.document.open();
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" />
    <title>Generando cotización…</title>
    <style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#444}
    p{font-size:14px}</style></head>
    <body><p>Generando cotización…</p></body></html>`);
  win.document.close();

  try {
    let finalQuote = quote;
    if (options?.refreshQuote) {
      const refreshed = await options.refreshQuote();
      if (refreshed) finalQuote = refreshed;
    }

    const clienteId =
      finalQuote.customerId ||
      ((finalQuote.orderPayload || {}) as QuoteOrderPayload).cliente_id ||
      "";

    const [client, logoDataUri, signatureDataUri, printItems] = await Promise.all([
      clienteId ? fetchClientForOrderGuide(clienteId) : Promise.resolve(null),
      loadCompanyLogoDataUri(),
      loadRepresentativeSignatureDataUri(),
      enrichQuotePrintItems(finalQuote),
    ]);

    if (win.closed) {
      throw new Error("La ventana de impresión se cerró antes de generar la cotización.");
    }

    const html = buildQuoteGuideHtml(
      finalQuote,
      client,
      printItems,
      logoDataUri,
      signatureDataUri
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
 * Genera y descarga la cotización en formato Excel (.xlsx) con el mismo diseño y formato editable.
 */
export async function exportQuoteToExcel(
  quote: Quote,
  options?: { refreshQuote?: () => Promise<Quote | null | undefined> }
): Promise<void> {
  let finalQuote = quote;
  if (options?.refreshQuote) {
    const refreshed = await options.refreshQuote();
    if (refreshed) finalQuote = refreshed;
  }

  const payload = (finalQuote.orderPayload || {}) as QuoteOrderPayload;
  const clienteId =
    finalQuote.customerId ||
    payload.cliente_id ||
    "";

  const [client, logoDataUri, signatureDataUri, printItems] = await Promise.all([
    clienteId ? fetchClientForOrderGuide(clienteId) : Promise.resolve(null),
    loadCompanyLogoDataUri(),
    loadRepresentativeSignatureDataUri(),
    enrichQuotePrintItems(finalQuote),
  ]);

  const clientName = client?.name || finalQuote.customerName || "—";
  const contact = client?.contact || client?.phone || "—";
  const address = client?.address || "—";
  const quoteDate = fmtDate(finalQuote.createdAt || payload.fecha_estimada_entrega || new Date().toISOString());

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Uniformes Activa";
  workbook.lastModifiedBy = "Uniformes Activa";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet("Cotización", {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 1, // Letter
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
    },
  });

  worksheet.columns = [
    { key: "cant", width: 10 },
    { key: "articulo", width: 72 },
    { key: "unit", width: 16 },
    { key: "total", width: 16 },
  ];

  const redHeaderFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC00000" },
  };

  const whiteHeaderFont: Partial<ExcelJS.Font> = {
    name: "Calibri",
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 11,
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };

  // Insert logo if available
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
        tl: { col: 0.1, row: 0.15 },
        ext: { width: 100, height: 68 },
      });
    } catch {
      /* ignore image error */
    }
  }

  // Row 1: Title
  worksheet.mergeCells("A1:D1");
  const r1 = worksheet.getCell("A1");
  r1.value = "Uniformes Activa";
  r1.font = { name: "Calibri", size: 20, bold: true, color: { argb: "FFC00000" } };
  r1.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 26;

  // Row 2: NIT
  worksheet.mergeCells("A2:D2");
  const r2 = worksheet.getCell("A2");
  r2.value = "NIT 1090431678-0   Régimen Simplificado";
  r2.font = { name: "Calibri", size: 11, bold: true };
  r2.alignment = { horizontal: "center", vertical: "middle" };

  // Row 3: Tagline
  worksheet.mergeCells("A3:D3");
  const r3 = worksheet.getCell("A3");
  r3.value = "Empresa productora y comercializadora de prendas de alta calidad para dotación empresarial e institucional";
  r3.font = { name: "Calibri", size: 9.5 };
  r3.alignment = { horizontal: "center", vertical: "middle" };

  // Row 4: Address
  worksheet.mergeCells("A4:D4");
  const r4 = worksheet.getCell("A4");
  r4.value = "Calle 2 N° 5-53 Barrio Pescadero-Cúcuta";
  r4.font = { name: "Calibri", size: 9.5, bold: true };
  r4.alignment = { horizontal: "center", vertical: "middle" };

  // Row 5: Contact
  worksheet.mergeCells("A5:D5");
  const r5 = worksheet.getCell("A5");
  r5.value = "3208931421    comercialuniformesactiva@gmail.com";
  r5.font = { name: "Calibri", size: 9.5, bold: true };
  r5.alignment = { horizontal: "center", vertical: "middle" };

  // Row 6: Cotización Title
  worksheet.mergeCells("A6:D6");
  const r6 = worksheet.getCell("A6");
  r6.value = "COTIZACIÓN";
  r6.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFC00000" } };
  r6.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(6).height = 24;

  // Row 7: Cliente
  worksheet.getCell("A7").value = "CLIENTE";
  worksheet.getCell("A7").fill = redHeaderFill;
  worksheet.getCell("A7").font = whiteHeaderFont;
  worksheet.getCell("A7").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell("A7").border = thinBorder;

  worksheet.mergeCells("B7:D7");
  worksheet.getCell("B7").value = clientName;
  worksheet.getCell("B7").font = { name: "Calibri", size: 10.5, bold: true };
  worksheet.getCell("B7").alignment = { horizontal: "left", vertical: "middle" };
  ["B7", "C7", "D7"].forEach((c) => (worksheet.getCell(c).border = thinBorder));

  // Row 8: Contacto
  worksheet.getCell("A8").value = "CONTACTO";
  worksheet.getCell("A8").fill = redHeaderFill;
  worksheet.getCell("A8").font = whiteHeaderFont;
  worksheet.getCell("A8").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell("A8").border = thinBorder;

  worksheet.mergeCells("B8:D8");
  worksheet.getCell("B8").value = contact;
  worksheet.getCell("B8").font = { name: "Calibri", size: 10 };
  worksheet.getCell("B8").alignment = { horizontal: "left", vertical: "middle" };
  ["B8", "C8", "D8"].forEach((c) => (worksheet.getCell(c).border = thinBorder));

  // Row 9: Dirección y Fecha
  worksheet.getCell("A9").value = "DIRECCIÓN";
  worksheet.getCell("A9").fill = redHeaderFill;
  worksheet.getCell("A9").font = whiteHeaderFont;
  worksheet.getCell("A9").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell("A9").border = thinBorder;

  worksheet.getCell("B9").value = address;
  worksheet.getCell("B9").font = { name: "Calibri", size: 10 };
  worksheet.getCell("B9").alignment = { horizontal: "left", vertical: "middle" };
  worksheet.getCell("B9").border = thinBorder;

  worksheet.getCell("C9").value = "FECHA:";
  worksheet.getCell("C9").fill = redHeaderFill;
  worksheet.getCell("C9").font = whiteHeaderFont;
  worksheet.getCell("C9").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell("C9").border = thinBorder;

  worksheet.getCell("D9").value = quoteDate;
  worksheet.getCell("D9").font = { name: "Calibri", size: 10, bold: true };
  worksheet.getCell("D9").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell("D9").border = thinBorder;

  // Row 10: Table Headers
  const tableHeaders = ["CANT", "ARTICULO", "VR. UNIT", "VR. TOTAL"];
  ["A10", "B10", "C10", "D10"].forEach((ref, idx) => {
    const c = worksheet.getCell(ref);
    c.value = tableHeaders[idx];
    c.fill = redHeaderFill;
    c.font = whiteHeaderFont;
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = thinBorder;
  });
  worksheet.getRow(10).height = 20;

  // Items rows
  let curRow = 11;
  const startItemRow = curRow;

  if (printItems.length === 0) {
    worksheet.mergeCells(`A${curRow}:D${curRow}`);
    const emptyCell = worksheet.getCell(`A${curRow}`);
    emptyCell.value = "Sin prendas registradas en esta cotización.";
    emptyCell.alignment = { horizontal: "center", vertical: "middle" };
    emptyCell.border = thinBorder;
    curRow++;
  } else {
    for (const item of printItems) {
      const qty = item.cantidad > 0 ? item.cantidad : 0;
      const unit = item.precio_unitario || 0;
      const articulo = item.articulo_completo || item.producto_nombre || "—";

      const cA = worksheet.getCell(`A${curRow}`);
      cA.value = qty > 0 ? qty : "";
      cA.alignment = { horizontal: "center", vertical: "middle" };
      cA.border = thinBorder;
      cA.font = { name: "Calibri", size: 10, bold: true };

      const cB = worksheet.getCell(`B${curRow}`);
      cB.value = articulo;
      cB.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cB.border = thinBorder;
      cB.font = { name: "Calibri", size: 9.5 };

      const cC = worksheet.getCell(`C${curRow}`);
      cC.value = unit > 0 ? unit : 0;
      cC.numFmt = '"$"#,##0';
      cC.alignment = { horizontal: "center", vertical: "middle" };
      cC.border = thinBorder;
      cC.font = { name: "Calibri", size: 10, bold: true };

      const cD = worksheet.getCell(`D${curRow}`);
      if (qty > 0 && unit > 0) {
        cD.value = { formula: `A${curRow}*C${curRow}`, result: qty * unit };
      } else {
        cD.value = unit > 0 ? unit : 0;
      }
      cD.numFmt = '"$"#,##0';
      cD.alignment = { horizontal: "center", vertical: "middle" };
      cD.border = thinBorder;
      cD.font = { name: "Calibri", size: 10, bold: true };

      worksheet.getRow(curRow).height = 36;
      curRow++;
    }
  }

  const endItemRow = curRow - 1;

  // Total Row
  worksheet.mergeCells(`A${curRow}:C${curRow}`);
  const totLabel = worksheet.getCell(`A${curRow}`);
  totLabel.value = "TOTAL";
  totLabel.fill = redHeaderFill;
  totLabel.font = whiteHeaderFont;
  totLabel.alignment = { horizontal: "right", vertical: "middle" };
  [`A${curRow}`, `B${curRow}`, `C${curRow}`].forEach((c) => (worksheet.getCell(c).border = thinBorder));

  const totVal = worksheet.getCell(`D${curRow}`);
  if (printItems.length > 0) {
    totVal.value = { formula: `SUM(D${startItemRow}:D${endItemRow})` };
  } else {
    totVal.value = 0;
  }
  totVal.numFmt = '"$"#,##0';
  totVal.font = { name: "Calibri", size: 11, bold: true };
  totVal.alignment = { horizontal: "center", vertical: "middle" };
  totVal.border = thinBorder;
  worksheet.getRow(curRow).height = 20;
  curRow++;

  // Note Box
  worksheet.mergeCells(`A${curRow}:D${curRow}`);
  const noteCell = worksheet.getCell(`A${curRow}`);
  noteCell.value =
    "Nota: La Fecha de entrega es de 20 dias hábiles, para iniciar el proceso de producción de la presente cotización es importante dar un abono del 50% del valor de la factura.          La presente cotización tiene una validez 8 dias calendario a partir de la fecha la cual fue recibida.\nFavor abstenerse de aplicar retenciones ya que nos encontramos acogidos al regimen especial ZESE art 268 ley 1955/2019";
  noteCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  noteCell.font = { name: "Calibri", size: 9 };
  [`A${curRow}`, `B${curRow}`, `C${curRow}`, `D${curRow}`].forEach((c) => (worksheet.getCell(c).border = thinBorder));
  worksheet.getRow(curRow).height = 42;
  curRow += 2;

  // Condiciones de la oferta
  worksheet.mergeCells(`A${curRow}:D${curRow}`);
  const condTitle = worksheet.getCell(`A${curRow}`);
  condTitle.value = "CONDICIONES DE LA OFERTA";
  condTitle.font = { name: "Times New Roman", size: 13, bold: true };
  condTitle.alignment = { horizontal: "center", vertical: "middle" };
  curRow++;

  const conditionsLines = [
    { title: "1. CONDICIONES PARA LA TOMA DE MEDIDAS Y ENTREGA DE UNIFORMES", bold: true },
    { text: "- Las tallas se miden de acuerdo a nuestro tallaje para confirmar con exactitud la talla solicitada." },
    { text: "- El personal de la organización debe permitir que el asesor de Uniformes Activa verifique que la talla seleccionada sea la indicada, y tener en cuenta las recomendaciones realizadas, de lo contrario no se responderá por ajustes en el momento de la entrega." },
    { text: "- Las personas que se mida las tallas con faja, deberá así mismo tenerla el día de la entrega de las prendas, esto con el fin de evitar inconformidades en los ajustes." },
    { text: "- Se realizará un único ajuste posterior a la entrega de los uniformes relacionados a corrección de defectos de fábrica, tamaño de las prendas y/o especificaciones indicadas en el momento del tallaje. Por lo tanto, el personal debe comprobar el uniforme en el momento de la entrega o hasta el tiempo permitido y reportar todas las novedades, ya que no se realizará una segunda revisión." },
    { text: "- No se realizarán ajustes personalizados que no correspondan al diseño inicial de los uniformes. Los pantalones serán entregan sin ruedos." },
    { title: "2. TIEMPO DE ENTREGA", bold: true },
    { text: "- El tiempo de entrega es de 20 días hábiles. El tiempo de entrega inicia desde que se recibe el anticipo y se completa la toma del tallaje. En caso de modificaciones en el tiempo de entrega ocasionada por cambios con el proveedor, se informará al cliente oportunamente." },
    { text: "(PARA MAS DE 100 PRENDAS EL TIEMPO DE ENTREGA ES DE 30 DÍAS HABILES)", bold: true },
    { title: "3. TIEMPO DE MODIFICACIONES", bold: true },
    { text: "- Las modificaciones deben ser reportadas máximo un día hábil posterior a la entrega de la dotación. No se realizarán ajustes a prendas ya utilizadas o sucias o que hayan sido alteradas o modificadas por terceros." },
    { title: "4. FORMA DE PAGO", bold: true },
    { text: "- Para el ingreso del pedido a producción se requiere el pago del 50% del valor total de la oferta, el 50% restante será cancelado dentro de los 8 días hábiles siguientes al recibido a satisfacción del pedido." },
    { title: "5. VALIDEZ DE LA OFERTA", bold: true },
    { text: "- La oferta presentada tendrá una validez de 8 días calendario" },
    { text: "" },
    { text: "Agradecemos su atención y estamos a su orden ante cualquier solicitud o requerimiento adicional." },
  ];

  for (const line of conditionsLines) {
    worksheet.mergeCells(`A${curRow}:D${curRow}`);
    const c = worksheet.getCell(`A${curRow}`);
    c.value = line.title || line.text || "";
    c.font = { name: "Calibri", size: 9.5, bold: Boolean(line.bold) };
    c.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    curRow++;
  }

  // Atentamente y Firma
  worksheet.mergeCells(`A${curRow}:D${curRow}`);
  const cAtentamente = worksheet.getCell(`A${curRow}`);
  cAtentamente.value = "Atentamente,";
  cAtentamente.font = { name: "Calibri", size: 9.5, bold: true };
  curRow++;

  // Fila para la firma
  const signatureRowIndex = curRow;
  worksheet.getRow(signatureRowIndex).height = 42;

  if (signatureDataUri) {
    try {
      const match = signatureDataUri.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
      const base64 = match ? match[2] : signatureDataUri;
      const extension = match && match[1].toLowerCase() === "png" ? "png" : "jpeg";
      const signImageId = workbook.addImage({
        base64: base64,
        extension: extension as "png" | "jpeg",
      });
      worksheet.addImage(signImageId, {
        tl: { col: 0.05, row: signatureRowIndex - 1 + 0.1 },
        ext: { width: 145, height: 40 },
      });
    } catch {
      /* ignore signature image error */
    }
  }
  curRow++;

  // Nombre y cargo de la representante legal
  worksheet.mergeCells(`A${curRow}:D${curRow}`);
  const repName = worksheet.getCell(`A${curRow}`);
  repName.value = "María de la Paz Parada";
  repName.font = { name: "Calibri", size: 10.5, bold: true };
  curRow++;

  worksheet.mergeCells(`A${curRow}:D${curRow}`);
  const repRole = worksheet.getCell(`A${curRow}`);
  repRole.value = "Representante Legal";
  repRole.font = { name: "Calibri", size: 9.5 };
  curRow++;

  // Trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeClient = clientName.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 30);
  a.download = `Cotizacion_${safeClient || shortQuoteId(finalQuote.id)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
