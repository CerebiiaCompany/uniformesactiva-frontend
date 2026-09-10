import { endpoints } from "@/lib/api-endpoints";
import { formatCurrency, parseApiNumber } from "@/lib/format-number";
import { http } from "@/lib/http";
import { formatOrderShortId, getActiveLogoLabels } from "@/lib/order-fields";
import type { Order } from "@/hooks/useOrders";
import { resolveEffectivePaymentStatus } from "@/lib/payment-status";

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

function fmtMoney(value: string | number): string {
  return `$${formatCurrency(value)}`;
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString("es-CO");
}

function paymentLabel(order: Order): string {
  const status = resolveEffectivePaymentStatus(order);
  if (status === "parcial") return "Pagado parcial";
  if (status === "pagado") return "Pagado";
  return "No pagado";
}

function resolveSaleUnitPrice(
  item: Order["items"][number],
  fallbackUnit: number | null
): number {
  const sale = parseApiNumber(item.precio_venta_unitario ?? 0);
  if (sale > 0) return sale;
  if (fallbackUnit !== null && fallbackUnit > 0) return fallbackUnit;
  return 0;
}

function estampadoLabel(order: Order, _itemColor?: string | null): string {
  const estampado = (order.estampado || "").trim();
  const logos = getActiveLogoLabels(order);
  const printParts = [estampado, logos.length ? logos.join(", ") : ""]
    .filter(Boolean)
    .join(" · ");
  return printParts || "—";
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

function buildGuideHtml(
  order: Order,
  client: OrderGuideClientInfo | null,
  logoDataUri?: string | null
): string {
  const orderCode = formatOrderShortId(order.id);
  const printedAt = new Date().toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "medium",
  });
  const totalQty = (order.items || []).reduce(
    (s, i) => s + (Number(i.cantidad) || 0),
    0
  );
  const clientName = client?.name || order.cliente_nombre || "—";
  const contact = client?.contact || "—";
  const address = client?.address || "—";
  const tomadaPor = (order.tomado_por_nombre || "").trim() || "—";
  const creacionEntrega = `${fmtDate(order.fecha_creacion)} | ${fmtDate(order.fecha_estimada_entrega)}`;
  const comments = (order.comentarios || "").trim();

  const hasStoredSale = (order.items || []).some(
    (i) => parseApiNumber(i.precio_venta_unitario ?? 0) > 0
  );
  const saleTotalOrder = parseApiNumber(order.valor_venta_proyectado);
  const fallbackUnit =
    !hasStoredSale && totalQty > 0 && saleTotalOrder > 0
      ? saleTotalOrder / totalQty
      : null;

  let linesSaleSum = 0;
  const rows = (order.items || [])
    .map((item) => {
      const product = (item.producto_nombre || order.producto_nombre || "").trim();
      const variant = (item.subproducto_nombre || "").trim();
      const productLabel =
        product && variant && product !== variant
          ? `${product} · ${variant}`
          : product || variant || "—";
      const qty = Number(item.cantidad) || 0;
      const unit = resolveSaleUnitPrice(item, fallbackUnit);
      const lineTotal = unit * qty;
      linesSaleSum += lineTotal;
      return `
        <tr>
          <td>${escapeHtml(productLabel)}</td>
          <td>${escapeHtml((item.talla_nombre || "—").trim() || "—")}</td>
          <td>${escapeHtml(estampadoLabel(order, item.color))}</td>
          <td class="num">${qty}</td>
          <td class="num">${escapeHtml(fmtMoney(unit))}</td>
          <td class="num">${escapeHtml(fmtMoney(lineTotal))}</td>
        </tr>`;
    })
    .join("");

  const invoiceTotal =
    linesSaleSum > 0 ? linesSaleSum : saleTotalOrder;

  const logoBlock = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Activa Uniformes" />`
    : `<h1 class="brand">ACTIVA UNIFORMES</h1>`;

  // title vacío + @page margin:0 evita cabeceras del navegador (fecha / título)
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
        <p class="subtitle">Guía de orden de producción</p>
      </div>
      <div class="meta">
        <p class="order">Orden ${escapeHtml(orderCode)}</p>
        <p class="when">${escapeHtml(printedAt)}</p>
      </div>
    </div>

    <div class="info">
      <div class="info-row"><span class="k">Cliente:</span> ${escapeHtml(clientName)}</div>
      <div class="info-row"><span class="k">Contacto:</span> ${escapeHtml(contact)}</div>
      <div class="info-row"><span class="k">Dirección:</span> ${escapeHtml(address)}</div>
      <div class="info-row"><span class="k">Tomada por:</span> ${escapeHtml(tomadaPor)}</div>
      <div class="info-row"><span class="k">Creación / Entrega:</span> ${escapeHtml(creacionEntrega)}</div>
      <div class="info-row"><span class="k">Cantidad total:</span> ${totalQty} unidades</div>
      <div class="info-row"><span class="k">Pago:</span> ${escapeHtml(paymentLabel(order))}</div>
    </div>

    <h2 class="section-title">Prendas</h2>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th>Talla</th>
          <th>Estampado</th>
          <th class="num">Cant.</th>
          <th class="num">P. unit.</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows ||
          `<tr><td colspan="6" class="muted">Sin prendas registradas en esta orden.</td></tr>`
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
        <span>Responsable de producción</span>
      </div>
      <div class="sign">
        <div class="line"></div>
        <span>Recibido por</span>
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
 * Abre la guía de producción lista para imprimir / guardar como PDF.
 * Abre la ventana de forma síncrona (gesto del usuario) y luego carga datos.
 */
export async function printOrderProductionGuide(
  order: Order,
  options?: { refreshOrder?: () => Promise<Order | null | undefined> }
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
    <body><p>Generando guía de producción…</p></body></html>`);
  win.document.close();

  try {
    let finalOrder = order;
    if (options?.refreshOrder) {
      const refreshed = await options.refreshOrder();
      if (refreshed) finalOrder = refreshed;
    }

    const [client, logoDataUri] = await Promise.all([
      finalOrder.cliente_id
        ? fetchClientForOrderGuide(finalOrder.cliente_id)
        : Promise.resolve(null),
      loadCompanyLogoDataUri(),
    ]);

    if (win.closed) {
      throw new Error("La ventana de impresión se cerró antes de generar la guía.");
    }

    const html = buildGuideHtml(finalOrder, client, logoDataUri);
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
