/**
 * Impresión PDF de reportes con la misma plantilla ACTIVA UNIFORMES
 * usada en guías de órdenes, cotizaciones e inventario.
 */
import { loadCompanyLogoDataUri } from "@/lib/order-production-guide";

export type ReportPrintColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type ReportPrintSummaryItem = {
  label: string;
  value: string;
};

export type ReportPrintOptions = {
  /** Título bajo el logo (ej. "Reporte de Órdenes") */
  title: string;
  /** Identificador a la derecha (ej. "Informe de órdenes") */
  documentLabel: string;
  /** Filas KPI opcionales bajo el encabezado */
  summary?: ReportPrintSummaryItem[];
  columns: ReportPrintColumn[];
  /** Celdas ya formateadas, en el mismo orden que columns */
  rows: string[][];
  /** Fila de totales: mismas columnas; usar "" para celdas vacías */
  totalsRow?: string[];
  notes?: string;
  signLeft?: string;
  signRight?: string;
};

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReportHtml(
  options: ReportPrintOptions,
  logoDataUri?: string | null
): string {
  const printedAt = new Date().toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "medium",
  });

  const logoBlock = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Activa Uniformes" />`
    : `<h1 class="brand">ACTIVA UNIFORMES</h1>`;

  const summaryHtml =
    options.summary && options.summary.length
      ? `<div class="info">
          ${options.summary
            .map(
              (item) =>
                `<div class="info-row"><span class="k">${escapeHtml(item.label)}:</span> ${escapeHtml(item.value)}</div>`
            )
            .join("")}
        </div>`
      : "";

  const headCells = options.columns
    .map((col) => {
      const cls = col.align === "right" ? ' class="num"' : "";
      return `<th${cls}>${escapeHtml(col.label)}</th>`;
    })
    .join("");

  const bodyRows =
    options.rows.length > 0
      ? options.rows
          .map((cells) => {
            const tds = options.columns
              .map((col, idx) => {
                const cls = col.align === "right" ? ' class="num"' : "";
                return `<td${cls}>${escapeHtml(String(cells[idx] ?? "—"))}</td>`;
              })
              .join("");
            return `<tr>${tds}</tr>`;
          })
          .join("")
      : `<tr><td colspan="${options.columns.length}" class="muted">Sin registros para imprimir.</td></tr>`;

  const totalsHtml =
    options.totalsRow && options.totalsRow.length
      ? `<tr class="totals-row">
          ${options.columns
            .map((col, idx) => {
              const cls = col.align === "right" ? ' class="num"' : "";
              const raw = options.totalsRow?.[idx];
              const text = raw == null || raw === "" ? "" : String(raw);
              const strong = idx === 0 || col.align === "right";
              const content = text
                ? strong
                  ? `<span class="strong">${escapeHtml(text)}</span>`
                  : escapeHtml(text)
                : "";
              return `<td${cls}>${content}</td>`;
            })
            .join("")}
        </tr>`
      : "";

  const notes = (options.notes || "").trim() || "—";
  const signLeft = options.signLeft || "Elaborado por";
  const signRight = options.signRight || "Revisado por";

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
      padding: 14mm 12mm 16mm;
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
      font-size: 13px; font-weight: 800; margin: 0 0 8px;
      padding-bottom: 4px; border-bottom: 1px solid #ddd;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    thead th {
      text-align: left; font-size: 10px; font-weight: 700;
      border-bottom: 1px solid #222; padding: 6px 3px;
    }
    tbody td {
      padding: 6px 3px; border-bottom: 1px solid #e5e5e5;
      vertical-align: top; font-size: 10.5px;
    }
    th.num, td.num { text-align: right; white-space: nowrap; }
    tr.totals-row td {
      border-top: 1px solid #222;
      border-bottom: none;
      font-weight: 700;
      padding-top: 8px;
    }
    .strong { font-weight: 800; }
    .comments-title { font-weight: 800; margin: 18px 0 6px; }
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
      .sheet { padding: 12mm 10mm 14mm; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand-wrap">
        ${logoBlock}
        <p class="subtitle">${escapeHtml(options.title)}</p>
      </div>
      <div class="meta">
        <p class="doc-title">${escapeHtml(options.documentLabel)}</p>
        <p class="when">${escapeHtml(printedAt)}</p>
      </div>
    </div>

    ${summaryHtml}

    <h2 class="section-title">Detalle (${options.rows.length} ${
      options.rows.length === 1 ? "registro" : "registros"
    })</h2>
    <table>
      <thead>
        <tr>${headCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
        ${totalsHtml}
      </tbody>
    </table>

    <p class="comments-title">Comentarios / Observaciones</p>
    <p class="comments-body">${escapeHtml(notes)}</p>

    <div class="signs">
      <div class="sign">
        <div class="line"></div>
        <span>${escapeHtml(signLeft)}</span>
      </div>
      <div class="sign">
        <div class="line"></div>
        <span>${escapeHtml(signRight)}</span>
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
 * Abre una ventana con la plantilla ACTIVA e invoca el diálogo de impresión PDF.
 */
export async function printReportDocument(options: ReportPrintOptions): Promise<void> {
  const printWin = window.open("", "_blank");
  if (!printWin) {
    throw new Error(
      "El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo."
    );
  }

  printWin.document.write(
    `<!DOCTYPE html><html><head><title></title></head><body style="font-family:Arial,sans-serif;padding:24px;color:#333">Generando PDF…</body></html>`
  );
  printWin.document.close();

  const logoDataUri = await loadCompanyLogoDataUri();
  const html = buildReportHtml(options, logoDataUri);
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
