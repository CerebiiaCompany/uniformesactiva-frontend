/**
 * Desglose INFORMATIVO de materiales entregados por prenda / variante.
 * No modifica ni alimenta el costo real del pedido (ese sigue siendo el agregado).
 */
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { formatUnitCost, parseApiNumber } from "@/lib/format-number";
import type { OrderItem } from "@/hooks/useOrders";

export type DeliveredInfoLine = {
  label: string;
  detail: string;
  quantity: number;
  unit: string;
  unitCost: number;
  amount: number;
  materialKind: "tela" | "insumo";
};

export type DeliveredVariantInfo = {
  key: string;
  variantId: string;
  variantName: string;
  productId: string;
  productName: string;
  units: number;
  lines: DeliveredInfoLine[];
  total: number;
};

export type DeliveredProductInfo = {
  key: string;
  productId: string;
  productName: string;
  units: number;
  variants: DeliveredVariantInfo[];
  lines: DeliveredInfoLine[];
  total: number;
};

export type DeliveredMaterialsInfo = {
  byVariant: DeliveredVariantInfo[];
  byProduct: DeliveredProductInfo[];
};

type VariantCostBundle = {
  fabrics: Array<{
    reference: string;
    codigo?: string;
    meters: number;
    price_per_meter: number;
    es_principal: boolean;
  }>;
  supplies: Array<{
    name: string;
    codigo?: string;
    quantity: number;
    unit_price: number;
    talla_id?: string | null;
  }>;
  consumptions: Array<{ talla_id: string; consumption: number }>;
};

function money(n: number) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function qtyFmt(n: number) {
  return n.toLocaleString("es-CO", { maximumFractionDigits: 4 });
}

function mergeLines(lines: DeliveredInfoLine[]): DeliveredInfoLine[] {
  const map = new Map<string, DeliveredInfoLine>();
  for (const line of lines) {
    const key = `${line.materialKind}|${line.label.trim().toLowerCase()}|${line.unit}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...line });
      continue;
    }
    const quantity = prev.quantity + line.quantity;
    const amount = money(prev.amount + line.amount);
    const unitCost = quantity > 0 ? money(amount / quantity) : prev.unitCost;
    map.set(key, {
      ...prev,
      quantity,
      amount,
      unitCost,
      detail: `(${qtyFmt(quantity)} ${prev.unit} × $${formatUnitCost(unitCost)})`,
    });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

async function fetchVariantBundle(variantId: string): Promise<VariantCostBundle> {
  const [fabricsRaw, suppliesRaw, consumptionsRaw, tiposRaw] = await Promise.all([
    http<any[]>(endpoints.costos.telaByVariant(variantId)).catch(() => []),
    http<any[]>(endpoints.costos.insumosByVariant(variantId)).catch(() => []),
    http<any[]>(endpoints.costos.tallasConsumoByVariant(variantId)).catch(() => []),
    http<any[]>(endpoints.costos.tiposInsumo()).catch(() => []),
  ]);

  const tipoName = new Map<string, string>();
  const tipoCode = new Map<string, string>();
  for (const t of tiposRaw || []) {
    const id = String(t.id || "");
    if (!id) continue;
    tipoName.set(id, String(t.name || t.label || "").trim());
    const code = String(t.codigo_sku || t.code || "").trim();
    if (code) tipoCode.set(id, code);
  }

  const fabrics = (fabricsRaw || []).map((f) => ({
    reference: String(f.reference || "").trim(),
    codigo: String(f.codigo || f.code || "").trim() || undefined,
    meters: parseApiNumber(f.meters),
    price_per_meter: parseApiNumber(f.price_per_meter),
    es_principal: Boolean(f.es_principal),
  }));

  const supplies = (suppliesRaw || []).map((s) => {
    const tipoId = String(s.tipo_id || (typeof s.tipo === "object" ? s.tipo?.id : s.tipo) || "");
    const name =
      String(s.tipo_label || s.tipo_nombre || "").trim() ||
      tipoName.get(tipoId) ||
      String(typeof s.tipo === "string" ? s.tipo : "").trim() ||
      "Insumo";
    const codigo =
      String(s.codigo || s.codigo_sku || "").trim() ||
      tipoCode.get(tipoId) ||
      undefined;
    return {
      name,
      codigo,
      quantity: parseApiNumber(s.quantity),
      unit_price: parseApiNumber(s.unit_price),
      talla_id: s.talla_id ? String(s.talla_id) : null,
    };
  });

  const consumptions = (consumptionsRaw || []).map((c) => ({
    talla_id: String(c.talla_id || c.size_id || c.talla?.id || c.size?.id || ""),
    consumption: parseApiNumber(c.consumption ?? c.consumo),
  }));

  return { fabrics, supplies, consumptions };
}

function linesForOrderItem(
  item: OrderItem,
  bundle: VariantCostBundle
): DeliveredInfoLine[] {
  const qty = Number(item.cantidad) || 0;
  if (qty <= 0) return [];

  const lines: DeliveredInfoLine[] = [];
  const tallaId = item.talla_id ? String(item.talla_id) : "";

  let principalMetersFromSize = 0;
  if (tallaId) {
    const match = bundle.consumptions.find((c) => c.talla_id === tallaId);
    if (match) principalMetersFromSize = match.consumption;
  }
  if (principalMetersFromSize <= 0 && bundle.consumptions.length) {
    principalMetersFromSize =
      bundle.consumptions.reduce((s, c) => s + c.consumption, 0) /
      bundle.consumptions.length;
  }

  for (const fabric of bundle.fabrics) {
    // Solo la tela marcada para el costeo (es_principal). Nunca telas auxiliares / plus.
    if (!fabric.es_principal) continue;
    const metersPerUnit =
      principalMetersFromSize > 0 ? principalMetersFromSize : fabric.meters;
    if (metersPerUnit <= 0) continue;
    const quantity = money(metersPerUnit * qty);
    const unitCost = fabric.price_per_meter;
    const amount = money(quantity * unitCost);
    const label = [fabric.codigo, fabric.reference].filter(Boolean).join(" ").trim();
    lines.push({
      label: label || "Tela",
      detail: `(${qtyFmt(quantity)} m × $${formatUnitCost(unitCost)} costeo)`,
      quantity,
      unit: "m",
      unitCost,
      amount,
      materialKind: "tela",
    });
  }

  for (const supply of bundle.supplies) {
    if (supply.talla_id && tallaId && supply.talla_id !== tallaId) continue;
    const perUnit = supply.quantity;
    if (perUnit <= 0) continue;
    const quantity = money(perUnit * qty);
    const unitCost = supply.unit_price;
    const amount = money(quantity * unitCost);
    const label = [supply.codigo, supply.name].filter(Boolean).join(" ").trim();
    lines.push({
      label: label || "Insumo",
      detail: `(${qtyFmt(quantity)} uds × $${formatUnitCost(unitCost)} costeo)`,
      quantity,
      unit: "uds",
      unitCost,
      amount,
      materialKind: "insumo",
    });
  }

  return lines;
}

/** Construye vistas informativas por variante y por prenda a partir de los ítems de la orden. */
export async function buildDeliveredMaterialsInfo(
  items: OrderItem[]
): Promise<DeliveredMaterialsInfo> {
  const safeItems = (items || []).filter(
    (i) => i?.subproducto_id && (Number(i.cantidad) || 0) > 0
  );
  if (!safeItems.length) {
    return { byVariant: [], byProduct: [] };
  }

  const variantIds = [...new Set(safeItems.map((i) => String(i.subproducto_id)))];
  const bundles = new Map<string, VariantCostBundle>();
  await Promise.all(
    variantIds.map(async (id) => {
      bundles.set(id, await fetchVariantBundle(id));
    })
  );

  const variantMap = new Map<string, DeliveredVariantInfo>();

  for (const item of safeItems) {
    const variantId = String(item.subproducto_id);
    const bundle = bundles.get(variantId);
    if (!bundle) continue;

    const variantName =
      (item.subproducto_nombre || "").trim() || "Variante";
    const productId = String(item.producto_id || item.linea_id || "sin-producto");
    const productName =
      (item.producto_nombre || "").trim() ||
      (item.linea_nombre || "").trim() ||
      "Prenda";
    const units = Number(item.cantidad) || 0;
    const itemLines = linesForOrderItem(item, bundle);
    const key = `${productId}|${variantId}`;

    const existing = variantMap.get(key);
    if (!existing) {
      variantMap.set(key, {
        key,
        variantId,
        variantName,
        productId,
        productName,
        units,
        lines: itemLines,
        total: money(itemLines.reduce((s, l) => s + l.amount, 0)),
      });
    } else {
      existing.units += units;
      existing.lines = mergeLines([...existing.lines, ...itemLines]);
      existing.total = money(existing.lines.reduce((s, l) => s + l.amount, 0));
    }
  }

  const byVariant = [...variantMap.values()].sort((a, b) => {
    const p = a.productName.localeCompare(b.productName, "es");
    return p !== 0 ? p : a.variantName.localeCompare(b.variantName, "es");
  });

  const productMap = new Map<string, DeliveredProductInfo>();
  for (const v of byVariant) {
    const existing = productMap.get(v.productId);
    if (!existing) {
      productMap.set(v.productId, {
        key: v.productId,
        productId: v.productId,
        productName: v.productName,
        units: v.units,
        variants: [v],
        lines: [...v.lines],
        total: v.total,
      });
    } else {
      existing.units += v.units;
      existing.variants.push(v);
      existing.lines = mergeLines([...existing.lines, ...v.lines]);
      existing.total = money(existing.lines.reduce((s, l) => s + l.amount, 0));
    }
  }

  const byProduct = [...productMap.values()].sort((a, b) =>
    a.productName.localeCompare(b.productName, "es")
  );

  return { byVariant, byProduct };
}
