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
  return `$${formatCurrency(value)}`;
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString("es-CO");
}

function shortQuoteId(id: string): string {
  return `COT-${id.slice(-3).toUpperCase()}`;
}

function colorEstampadoLabel(
  payload: QuoteOrderPayload | undefined,
  itemColor?: string | null
): string {
  const color =
    (itemColor || "").trim() || (payload?.color || "").trim() || "—";
  const estampado = (payload?.estampado || "").trim();
  const logos = getActiveLogoLabels(payload || {});
  const printParts = [estampado, logos.length ? logos.join(", ") : ""]
    .filter(Boolean)
    .join(" · ");
  if (!printParts) return color;
  return `${color} / ${printParts}`;
}

type QuotePrintItem = {
  producto_nombre?: string | null;
  subproducto_nombre?: string | null;
  talla_nombre?: string | null;
  talla_id?: string | null;
  cantidad: number;
  color?: string | null;
  /** Precio unitario mostrado (venta preferida, luego costo) */
  precio_unitario?: number | null;
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

/**
 * Resuelve tallas/precios faltantes (cotizaciones antiguas solo guardaban IDs).
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
      // También indexar por code por si talla_id es código
      for (const t of catalog) {
        if (t.code) tallaNameById.set(String(t.code), (t.label || t.name || t.code).trim());
      }
    } catch {
      /* catálogo opcional */
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

    return {
      producto_nombre: (item.producto_nombre || "").trim() || null,
      subproducto_nombre:
        (item.subproducto_nombre || "").trim() || variantLabel || null,
      talla_nombre:
        (item.talla_nombre || "").trim() || tallaFromCatalog || null,
      talla_id: item.talla_id || null,
      cantidad: Number(item.cantidad) || 0,
      color: item.color || null,
      precio_unitario: resolveUnitPrice(item, fallbackUnit),
    };
  });
}

function buildQuoteGuideHtml(
  quote: Quote,
  client: OrderGuideClientInfo | null,
  items: QuotePrintItem[],
  logoDataUri?: string | null
): string {
  const payload = (quote.orderPayload || {}) as QuoteOrderPayload;
  const quoteCode = shortQuoteId(quote.id);
  const printedAt = new Date().toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "medium",
  });
  const totalQty = items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
  const clientName = client?.name || quote.customerName || "—";
  const contact = client?.contact || "—";
  const address = client?.address || "—";
  const tomadaPor = (quote.takenBy || "").trim() || "—";
  const creacionEnvio = `${fmtDate(quote.createdAt)} | ${fmtDate(
    quote.shippingDate || payload.fecha_estimada_entrega
  )}`;
  const comments = (payload.comentarios || "").trim();
  const saleValue = Number(payload.valor_venta_proyectado ?? quote.totalAmount) || 0;

  let linesSaleSum = 0;
  const rows = items
    .map((item) => {
      const product = (item.producto_nombre || "").trim();
      const variant = (item.subproducto_nombre || "").trim();
      const productLabel =
        product && variant && product !== variant
          ? `${product} · ${variant}`
          : product || variant || "—";
      const qty = Number(item.cantidad) || 0;
      const unit =
        item.precio_unitario !== null &&
        item.precio_unitario !== undefined &&
        Number.isFinite(item.precio_unitario)
          ? Number(item.precio_unitario)
          : null;
      const lineTotal = unit !== null ? unit * qty : null;
      if (lineTotal !== null) linesSaleSum += lineTotal;
      return `
        <tr>
          <td>${escapeHtml(productLabel)}</td>
          <td>${escapeHtml((item.talla_nombre || "—").trim() || "—")}</td>
          <td>${escapeHtml(colorEstampadoLabel(payload, item.color))}</td>
          <td class="num">${qty || "—"}</td>
          <td class="num">${escapeHtml(unit !== null ? fmtMoney(unit) : "—")}</td>
          <td class="num">${escapeHtml(lineTotal !== null ? fmtMoney(lineTotal) : "—")}</td>
        </tr>`;
    })
    .join("");

  const invoiceTotal = linesSaleSum > 0 ? linesSaleSum : saleValue;

  const logoBlock = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Activa Uniformes" />`
    : `<h1 class="brand">ACTIVA UNIFORMES</h1>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.35;
      background: #fff;
    }
    .sheet {
      max-width: 190mm;
      margin: 0 auto;
      padding: 14mm 14mm 16mm;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid #222;
      margin-bottom: 14px;
    }
    .brand-wrap { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
    .logo {
      display: block;
      height: 92px;
      width: auto;
      max-width: 280px;
      object-fit: contain;
      background: transparent;
      padding: 0;
    }
    .brand { font-size: 22px; font-weight: 800; letter-spacing: 0.02em; margin: 0; }
    .subtitle { margin: 0; color: #555; font-size: 13px; font-weight: 500; }
    .meta { text-align: right; }
    .meta .order { font-size: 14px; font-weight: 700; margin: 0; }
    .meta .when { margin: 4px 0 0; color: #555; font-size: 11px; }
    .info { margin-bottom: 16px; }
    .info-row { margin: 3px 0; }
    .info-row .k { font-weight: 700; }
    .section-title {
      font-size: 13px; font-weight: 800; margin: 0 0 8px;
      padding-bottom: 4px; border-bottom: 1px solid #ddd;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    thead th {
      text-align: left; font-size: 11px; font-weight: 700;
      border-bottom: 1px solid #222; padding: 6px 4px;
    }
    tbody td {
      padding: 7px 4px; border-bottom: 1px solid #e5e5e5;
      vertical-align: top; font-size: 11.5px;
    }
    th.num, td.num { text-align: right; white-space: nowrap; }
    .totals {
      text-align: right; margin: 8px 0 18px; font-size: 13px;
    }
    .totals div { margin: 4px 0; }
    .totals .strong { font-weight: 800; }
    .comments-title { font-weight: 800; margin: 0 0 6px; }
    .comments-body { margin: 0 0 28px; color: #222; white-space: pre-wrap; }
    .signs {
      display: flex; justify-content: space-between; gap: 40px;
      margin-top: 48px; padding-top: 8px;
    }
    .sign { width: 42%; text-align: center; }
    .sign .line {
      border-top: 1px solid #222; margin-bottom: 6px; height: 1px;
    }
    .sign span { font-size: 11px; color: #333; }
    .muted { color: #666; }
    @media print {
      html, body { background: #fff; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .sheet { padding: 12mm 12mm 14mm; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand-wrap">
        ${logoBlock}
        <p class="subtitle">Cotización</p>
      </div>
      <div class="meta">
        <p class="order">Cotización ${escapeHtml(quoteCode)}</p>
        <p class="when">${escapeHtml(printedAt)}</p>
      </div>
    </div>

    <div class="info">
      <div class="info-row"><span class="k">Cliente:</span> ${escapeHtml(clientName)}</div>
      <div class="info-row"><span class="k">Contacto:</span> ${escapeHtml(contact)}</div>
      <div class="info-row"><span class="k">Dirección:</span> ${escapeHtml(address)}</div>
      <div class="info-row"><span class="k">Tomada por:</span> ${escapeHtml(tomadaPor)}</div>
      <div class="info-row"><span class="k">Creación / Envío estimado:</span> ${escapeHtml(creacionEnvio)}</div>
      <div class="info-row"><span class="k">Válida hasta:</span> ${escapeHtml(fmtDate(quote.validUntil))}</div>
      <div class="info-row"><span class="k">Cantidad total:</span> ${totalQty || "—"} unidades</div>
    </div>

    <h2 class="section-title">Prendas</h2>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th>Talla</th>
          <th>Color / Estampado</th>
          <th class="num">Cant.</th>
          <th class="num">P. unit.</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows ||
          `<tr><td colspan="6" class="muted">Sin prendas registradas en esta cotización.</td></tr>`
        }
      </tbody>
    </table>

    <div class="totals">
      <div><span class="strong">Valor total:</span> ${escapeHtml(fmtMoney(invoiceTotal))}</div>
    </div>

    <p class="comments-title">Comentarios / Observaciones</p>
    <p class="comments-body">${escapeHtml(comments || "—")}</p>

    <div class="signs">
      <div class="sign">
        <div class="line"></div>
        <span>Elaborado por</span>
      </div>
      <div class="sign">
        <div class="line"></div>
        <span>Aceptado por el cliente</span>
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
    <title></title>
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

    const [client, logoDataUri, printItems] = await Promise.all([
      clienteId ? fetchClientForOrderGuide(clienteId) : Promise.resolve(null),
      loadCompanyLogoDataUri(),
      enrichQuotePrintItems(finalQuote),
    ]);

    if (win.closed) {
      throw new Error("La ventana de impresión se cerró antes de generar la cotización.");
    }

    const html = buildQuoteGuideHtml(finalQuote, client, printItems, logoDataUri);
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
