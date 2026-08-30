import { loadCompanyLogoDataUri } from "@/lib/order-production-guide";
import type { TNSInventoryMovementHistoryResponse, TNSInventoryMovementHistoryRow } from "@/types/tns";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString("es-CO");
}

function fmtQty(value: number, unidad: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const formatted = n.toLocaleString("es-CO", { maximumFractionDigits: 4 });
  const unit = (unidad || "").trim().toLowerCase();
  if (unit === "metro" || unit === "metros" || unit === "m") {
    return `${formatted} m`;
  }
  return `${formatted} ${unidad || "u."}`.trim();
}

/** Stock después: negativo → "Agotado" (sin stock TNS previo al consumo informado). */
function fmtStockDespues(value: number, unidad: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n < 0) return "Agotado";
  return fmtQty(n, unidad);
}

function fmtStockDespuesCell(value: number, unidad: string): string {
  const n = Number(value);
  const label = fmtStockDespues(value, unidad);
  const cls = Number.isFinite(n) && n < 0 ? ' class="num stock-agotado"' : ' class="num"';
  return `<td${cls}>${escapeHtml(label)}</td>`;
}

/** Sin stock en TNS al generar el reporte (stock antes = 0 o no registrado). */
function rowHasNoTnsStock(row: TNSInventoryMovementHistoryRow): boolean {
  const stock = Number(row.stock_antes);
  return !Number.isFinite(stock) || stock <= 0;
}

function reportHasNoStockRows(report: TNSInventoryMovementHistoryResponse): boolean {
  const all = [
    ...report.telas_consumidas,
    ...report.insumos_usados,
    ...report.consumido_satellite,
  ];
  return all.some(rowHasNoTnsStock);
}

function buildTableRows(rows: TNSInventoryMovementHistoryRow[]): string {
  if (!rows.length) {
    return `<tr><td colspan="5" class="muted">Sin registros en el período seleccionado.</td></tr>`;
  }
  return rows
    .map((row) => {
      const noStock = rowHasNoTnsStock(row);
      const rowClass = noStock ? ' class="row-no-stock"' : "";
      return `
        <tr${rowClass}>
          <td>${escapeHtml(row.codigo || "—")}</td>
          <td>${escapeHtml(row.nombre || "—")}</td>
          <td class="num">${escapeHtml(fmtQty(row.cantidad_consumida, row.unidad))}</td>
          <td class="num">${escapeHtml(fmtQty(row.stock_antes, row.unidad))}</td>
          ${fmtStockDespuesCell(row.stock_despues, row.unidad)}
        </tr>`;
    })
    .join("");
}

function buildHistoryHtml(
  report: TNSInventoryMovementHistoryResponse,
  logoDataUri?: string | null
): string {
  const printedAt = new Date().toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "medium",
  });
  const desde = fmtDate(report.fecha_desde);
  const hasta = fmtDate(report.fecha_hasta);

  const logoBlock = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Activa Uniformes" />`
    : `<h1 class="brand">ACTIVA UNIFORMES</h1>`;

  const tableHead = `
    <thead>
      <tr>
        <th>Código</th>
        <th>Nombre</th>
        <th class="num">Cant. consumida</th>
        <th class="num">Stock antes</th>
        <th class="num">Stock después</th>
      </tr>
    </thead>`;

  const stockLegend = reportHasNoStockRows(report)
    ? `<div class="stock-legend">
        <span class="legend-swatch" aria-hidden="true"></span>
        <p>
          <strong>Resaltado en rojo claro:</strong> productos que no contaban con stock en TNS
          al momento del reporte (stock antes = 0). El consumo se registra de forma informativa;
          en stock después se muestra <strong>Agotado</strong> cuando no había existencias suficientes.
        </p>
      </div>`
    : "";

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
    .meta .doc-title { font-size: 14px; font-weight: 700; margin: 0; }
    .meta .when { margin: 4px 0 0; color: #555; font-size: 11px; }
    .info { margin-bottom: 16px; }
    .info-row { margin: 3px 0; }
    .info-row .k { font-weight: 700; }
    .section-title {
      font-size: 13px; font-weight: 800; margin: 18px 0 8px;
      padding-bottom: 4px; border-bottom: 1px solid #ddd;
    }
    .section-title:first-of-type { margin-top: 0; }
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
    td.stock-agotado {
      font-weight: 700;
      color: #b91c1c;
      font-style: italic;
    }
    tbody tr.row-no-stock td {
      background-color: #fef2f2;
      border-bottom-color: #fecaca;
    }
    tbody tr.row-no-stock td:first-child {
      box-shadow: inset 3px 0 0 #fca5a5;
    }
    .stock-legend {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin: 0 0 14px;
      padding: 8px 10px;
      border: 1px solid #fecaca;
      border-radius: 4px;
      background: #fffafa;
      font-size: 10.5px;
      color: #444;
      line-height: 1.45;
    }
    .stock-legend p { margin: 0; }
    .legend-swatch {
      flex-shrink: 0;
      width: 28px;
      height: 14px;
      margin-top: 2px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-left: 3px solid #fca5a5;
      border-radius: 2px;
    }
    .note {
      margin-top: 16px; font-size: 10.5px; color: #666;
      border-top: 1px solid #ddd; padding-top: 10px;
    }
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
      .sheet { padding: 12mm 12mm 14mm; }
      tbody tr.row-no-stock td,
      .stock-legend,
      .legend-swatch {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand-wrap">
        ${logoBlock}
        <p class="subtitle">Historial de movimiento de inventario</p>
      </div>
      <div class="meta">
        <p class="doc-title">Reporte TNS</p>
        <p class="when">${escapeHtml(printedAt)}</p>
      </div>
    </div>

    <div class="info">
      <div class="info-row"><span class="k">Desde:</span> ${escapeHtml(desde)}</div>
      <div class="info-row"><span class="k">Hasta:</span> ${escapeHtml(hasta)}</div>
    </div>

    ${stockLegend}

    <h2 class="section-title">Telas consumidas</h2>
    <table>
      ${tableHead}
      <tbody>${buildTableRows(report.telas_consumidas)}</tbody>
    </table>

    <h2 class="section-title">Insumos usados</h2>
    <table>
      ${tableHead}
      <tbody>${buildTableRows(report.insumos_usados)}</tbody>
    </table>

    <h2 class="section-title">Consumido por satélite</h2>
    <table>
      ${tableHead}
      <tbody>${buildTableRows(report.consumido_satellite)}</tbody>
    </table>

    ${
      report.nota
        ? `<p class="note">${escapeHtml(report.nota)}</p>`
        : ""
    }

    <div class="signs">
      <div class="sign">
        <div class="line"></div>
        <span>Responsable de inventario</span>
      </div>
      <div class="sign">
        <div class="line"></div>
        <span>Revisado por</span>
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
 * Abre el historial de movimientos listo para imprimir / guardar como PDF.
 * Puede recibir una ventana ya abierta (gesto del usuario) para evitar bloqueo de pop-ups.
 */
export async function printInventoryMovementHistory(
  report: TNSInventoryMovementHistoryResponse,
  existingWindow?: Window | null
): Promise<void> {
  const win =
    existingWindow ??
    window.open("", "_blank", "width=920,height=1100");
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
    <body><p>Generando historial de movimientos…</p></body></html>`);
  win.document.close();

  try {
    const logoDataUri = await loadCompanyLogoDataUri();

    if (win.closed) {
      throw new Error("La ventana de impresión se cerró antes de generar el reporte.");
    }

    const html = buildHistoryHtml(report, logoDataUri);
    win.document.open();
    win.document.write(html);
    win.document.close();
    try {
      win.focus();
    } catch {
      /* ignore */
    }
  } catch (err) {
    if (!existingWindow) {
      try {
        if (!win.closed) win.close();
      } catch {
        /* ignore */
      }
    }
    throw err;
  }
}
