import type { PedidoCompra, DetallePedidoCompra } from "@/types/tns";
import type { KanbanEtapa } from "@/hooks/useKanbanEtapas";

/**
 * Normaliza un texto eliminando acentos, caracteres especiales y espacios redundantes.
 */
export function normalizeText(str?: string | null): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convierte un nombre en MAYÚSCULAS o desordenado a formato Title Case limpio.
 * Ejemplo: "LUZ ZENAIDA CARRILLO LEON" -> "Luz Zenaida Carrillo Leon"
 */
export function cleanContactName(rawName?: string | null): string {
  if (!rawName) return "";
  // Eliminar sufijos comunes de TNS como "/ SATELITE", "/ CORTADORA", "/ TALLER"
  const cleaned = rawName
    .replace(/\s*\/\s*(satelite|satélite|taller|cortadora|corte|confeccion|confección|bordado|estampado|proveedor|servicios?)\s*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/i, "")
    .trim();

  if (!cleaned) return "";

  return cleaned
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      // Dejar conectores en minúsculas si no es la primera palabra
      if (["de", "del", "la", "las", "los", "y", "e"].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Categorías de producción y sus patrones de búsqueda en nomMat, codMat y nomTercero.
 */
interface StageRule {
  category:
    | "confeccion"
    | "corte"
    | "bordado"
    | "estampado"
    | "diseno"
    | "calidad"
    | "empaque"
    | "arreglos";
  aliasKeys: string[];
  aliasLabels: string[];
  patterns: string[];
  codePrefixes: string[];
}

const STAGE_RULES: StageRule[] = [
  {
    category: "arreglos",
    aliasKeys: ["arreglos", "arreglo", "servicio_arreglos", "reparaciones", "ajustes"],
    aliasLabels: [
      "arreglos",
      "arreglo",
      "servicio arreglos",
      "servicio de arreglos",
      "reparación",
      "reparacion",
    ],
    patterns: [
      "servicio arreglo",
      "servicio arreglos",
      "servicio de arreglos",
      "arreglo",
      "arreglos",
      "ser-arre",
      "reparacion",
      "reparación",
      "ajuste de prenda",
      "entalle",
      "basta",
      "cambio de cremallera",
      "cambio cuello",
      "zurcido",
      "reproceso",
    ],
    codePrefixes: ["SER-ARRE", "ARRE", "REP", "REPR"],
  },
  {
    category: "confeccion",
    aliasKeys: ["sewing", "confeccion", "confección", "costura", "taller"],
    aliasLabels: ["confeccion", "confección", "costura", "satelite", "satélite"],
    patterns: [
      "confeccion",
      "confeccionar",
      "costura",
      "coser",
      "camibuso",
      "pantalon",
      "camisa",
      "overol",
      "falda",
      "dotacion",
      "dobladillo",
      "satelite",
      "satélite",
      "ensamble",
      "maquinista",
      "filete",
      "plana",
    ],
    codePrefixes: ["CONF", "COST", "SAT"],
  },
  {
    category: "corte",
    aliasKeys: ["cutting", "corte", "cortadora"],
    aliasLabels: ["corte", "cortador", "cortadora"],
    patterns: [
      "corte",
      "cortar",
      "cortador",
      "cortadora",
      "trazo",
      "extendido",
      "despiece",
      "troquel",
      "tizada",
    ],
    codePrefixes: ["CORT", "TRAZ", "EXT"],
  },
  {
    category: "bordado",
    aliasKeys: ["embroidery", "bordado", "bordadora"],
    aliasLabels: ["bordado", "bordadora", "bordados"],
    patterns: [
      "bordado",
      "bordador",
      "bordadora",
      "bordar",
      "aplique",
      "parche",
      "puntada",
    ],
    codePrefixes: ["BORD", "APL"],
  },
  {
    category: "estampado",
    aliasKeys: ["printing", "estampado", "sublimacion", "estampa"],
    aliasLabels: ["estampado", "sublimación", "sublimacion", "serigrafía", "serigrafia", "dtf"],
    patterns: [
      "estampado",
      "estampa",
      "estampador",
      "sublimacion",
      "sublimar",
      "dtf",
      "serigrafia",
      "screen",
      "transfer",
      "planchado estampado",
      "vinilo",
    ],
    codePrefixes: ["EST", "SUBL", "DTF", "SERIG", "TRAN"],
  },
  {
    category: "diseno",
    aliasKeys: ["design", "diseno", "diseño", "patronaje", "molderia"],
    aliasLabels: ["diseño", "diseno", "patronaje", "moldería", "molderia"],
    patterns: [
      "diseno",
      "diseño",
      "patronaje",
      "molderia",
      "moldería",
      "escalado",
      "muestra",
      "digitalizacion",
      "plotter",
    ],
    codePrefixes: ["DIS", "PATR", "MOLD"],
  },
  {
    category: "calidad",
    aliasKeys: ["quality", "calidad", "control_calidad"],
    aliasLabels: ["calidad", "control de calidad", "revisión", "revision"],
    patterns: [
      "calidad",
      "revision",
      "revisión",
      "auditoria",
      "control calidad",
      "deshebre",
      "pulido",
    ],
    codePrefixes: ["CAL", "REV", "AUD"],
  },
  {
    category: "empaque",
    aliasKeys: ["dispatch", "empaque", "despacho", "terminado"],
    aliasLabels: ["empaque", "despacho", "terminación", "terminacion", "acabados"],
    patterns: [
      "empaque",
      "despacho",
      "terminado",
      "terminacion",
      "acabado",
      "etiquetado",
      "doblado",
      "embolsado",
      "ojal",
      "boton",
      "plancha",
    ],
    codePrefixes: ["EMP", "DESP", "TERM", "OJAL", "BOT"],
  },
];

export interface StageInferenceResult {
  stageKeys: string[];
  stageLabels: string[];
  detectedCategory: string | null;
  detectedFrom: string | null;
  confidence: "high" | "medium" | "low" | "none";
}

/**
 * Busca una etapa en el sistema que coincida con una categoría.
 */
export function findEtapaForCategory(
  category:
    | "confeccion"
    | "corte"
    | "bordado"
    | "estampado"
    | "diseno"
    | "calidad"
    | "empaque"
    | "arreglos",
  etapas: KanbanEtapa[]
): KanbanEtapa | null {
  const rule = STAGE_RULES.find((r) => r.category === category);
  if (!rule) return null;

  return (
    etapas.find((e) => {
      if (e.activo === false) return false;
      const eKey = normalizeText(e.key);
      const eLabel = normalizeText(e.label);

      if (rule.aliasKeys.some((k) => eKey === normalizeText(k) || eKey.includes(normalizeText(k)))) {
        return true;
      }
      if (rule.aliasLabels.some((l) => eLabel === normalizeText(l) || eLabel.includes(normalizeText(l)))) {
        return true;
      }
      return false;
    }) || null
  );
}

/**
 * Devuelve las capas por defecto para un satélite de arreglos:
 * Calidad, Confección (Costura) y Despacho (Empaque).
 */
export function getArreglosSatelliteStageKeys(etapas: KanbanEtapa[]): string[] {
  const targetCategories: ("calidad" | "confeccion" | "empaque")[] = [
    "calidad",
    "confeccion",
    "empaque",
  ];
  const keys: string[] = [];
  for (const cat of targetCategories) {
    const found = findEtapaForCategory(cat, etapas);
    if (found && !keys.includes(found.key)) {
      keys.push(found.key);
    }
  }
  return keys;
}

/**
 * Devuelve las capas por defecto para un satélite de confección:
 * Corte, Confección (Costura) y Bordado.
 */
export function getDefaultSatelliteStageKeys(etapas: KanbanEtapa[]): string[] {
  const targetCategories: ("corte" | "confeccion" | "bordado")[] = [
    "corte",
    "confeccion",
    "bordado",
  ];
  const keys: string[] = [];
  for (const cat of targetCategories) {
    const found = findEtapaForCategory(cat, etapas);
    if (found && !keys.includes(found.key)) {
      keys.push(found.key);
    }
  }
  return keys;
}

/**
 * Analiza un pedido o conjunto de detalles de TNS (principalmente `nomMat`, y también `codMat` o `nomTercero`)
 * y determina a qué capa(s) Kanban del sistema corresponde.
 */
export function inferStagesFromTns(
  pedidoOrDetalles: {
    detalles?: DetallePedidoCompra[];
    nomMat?: string;
    codMat?: string;
    nomTercero?: string;
    observacion?: string;
  } | null | undefined,
  etapas: KanbanEtapa[]
): StageInferenceResult {
  if (!pedidoOrDetalles) {
    return {
      stageKeys: [],
      stageLabels: [],
      detectedCategory: null,
      detectedFrom: null,
      confidence: "none",
    };
  }

  const detalles = pedidoOrDetalles.detalles || [];
  const directNomMat = pedidoOrDetalles.nomMat || "";
  const directCodMat = pedidoOrDetalles.codMat || "";
  const nomTercero = pedidoOrDetalles.nomTercero || "";

  // 1. Recopilar todos los textos de materiales
  const itemTexts: { nomMat: string; codMat: string }[] = [];
  if (directNomMat || directCodMat) {
    itemTexts.push({ nomMat: directNomMat, codMat: directCodMat });
  }
  for (const d of detalles) {
    const n = d.nomMat || d.descripcion || d.DESCRIP || "";
    const c = d.codMat || d.codigo || d.CODIGO || "";
    if (n || c) {
      itemTexts.push({ nomMat: n, codMat: c });
    }
  }

  // 2. Evaluar cada detalle con los patrones de stage
  const matchedCategories = new Map<string, { count: number; sample: string }>();

  for (const item of itemTexts) {
    const normNom = normalizeText(item.nomMat);
    const normCod = normalizeText(item.codMat);

    for (const rule of STAGE_RULES) {
      let matched = false;

      // Coincidencia en nomMat
      for (const pattern of rule.patterns) {
        if (normNom.includes(pattern)) {
          matched = true;
          break;
        }
      }

      // Coincidencia en prefijos de código
      if (!matched && normCod) {
        for (const prefix of rule.codePrefixes) {
          if (normCod.startsWith(normalizeText(prefix))) {
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        const prev = matchedCategories.get(rule.category) || { count: 0, sample: item.nomMat || item.codMat };
        matchedCategories.set(rule.category, {
          count: prev.count + 1,
          sample: prev.sample || item.nomMat || item.codMat,
        });
      }
    }
  }

  // 3. Si no hubo coincidencia en detalles, evaluar nomTercero (ej. "LUZ CARRILLO / SATELITE" o "JUAN / CORTADORA")
  if (matchedCategories.size === 0 && nomTercero) {
    const normTercero = normalizeText(nomTercero);
    for (const rule of STAGE_RULES) {
      for (const pattern of rule.patterns) {
        if (normTercero.includes(pattern)) {
          matchedCategories.set(rule.category, {
            count: 1,
            sample: `${nomTercero} (Tercero TNS)`,
          });
          break;
        }
      }
    }
  }

  // 4. Mapear categorías detectadas a las `etapas` reales configuradas en la aplicación
  const matchedStageKeys: string[] = [];
  const matchedStageLabels: string[] = [];
  let primaryCategory: string | null = null;
  let primarySample: string | null = null;

  if (matchedCategories.size > 0) {
    // Ordenar categorías por mayor frecuencia
    const sorted = Array.from(matchedCategories.entries()).sort((a, b) => b[1].count - a[1].count);
    primaryCategory = sorted[0][0];
    primarySample = sorted[0][1].sample;

    for (const [cat] of sorted) {
      if (cat === "arreglos") {
        // En satélites de servicios de arreglos, incluir Calidad, Confección (Costura) y Despacho/Empaque
        const bundle: ("calidad" | "confeccion" | "empaque")[] = [
          "calidad",
          "confeccion",
          "empaque",
        ];
        for (const bCat of bundle) {
          const bEtapa = findEtapaForCategory(bCat, etapas);
          if (bEtapa && !matchedStageKeys.includes(bEtapa.key)) {
            matchedStageKeys.push(bEtapa.key);
            matchedStageLabels.push(bEtapa.label);
          }
        }
      } else if (cat === "confeccion") {
        // En satélites de confección/costura, incluir automáticamente Corte, Confección y Bordado
        const bundle: ("corte" | "confeccion" | "bordado")[] = ["corte", "confeccion", "bordado"];
        for (const bCat of bundle) {
          const bEtapa = findEtapaForCategory(bCat, etapas);
          if (bEtapa && !matchedStageKeys.includes(bEtapa.key)) {
            matchedStageKeys.push(bEtapa.key);
            matchedStageLabels.push(bEtapa.label);
          }
        }
      } else {
        const matchingEtapa = findEtapaForCategory(cat as any, etapas);
        if (matchingEtapa && !matchedStageKeys.includes(matchingEtapa.key)) {
          matchedStageKeys.push(matchingEtapa.key);
          matchedStageLabels.push(matchingEtapa.label);
        }
      }
    }
  }

  // 5. Si aún no encontró etapas pero hay `etapas` en el sistema, intentar coincidencia literal con nombres de etapa
  if (matchedStageKeys.length === 0 && itemTexts.length > 0) {
    for (const item of itemTexts) {
      const normNom = normalizeText(item.nomMat);
      for (const etapa of etapas) {
        if (etapa.activo === false) continue;
        const normLabel = normalizeText(etapa.label);
        if (normLabel.length > 2 && normNom.includes(normLabel)) {
          if (!matchedStageKeys.includes(etapa.key)) {
            matchedStageKeys.push(etapa.key);
            matchedStageLabels.push(etapa.label);
            primarySample = item.nomMat;
          }
        }
      }
    }
  }

  const confidence: "high" | "medium" | "low" | "none" =
    matchedStageKeys.length > 0 && itemTexts.length > 0
      ? "high"
      : matchedStageKeys.length > 0
        ? "medium"
        : "none";

  return {
    stageKeys: matchedStageKeys,
    stageLabels: matchedStageLabels,
    detectedCategory: primaryCategory,
    detectedFrom: primarySample ? `nomMat: «${primarySample}»` : null,
    confidence,
  };
}

export interface TnsExtractedSatelliteData {
  name: string;
  nit: string;
  person_name: string;
  phone: string;
  address: string;
  cargo: string;
  production_stage_keys: string[];
  stageLabels: string[];
  detectedFrom: string | null;
  sampleMaterial: string | null;
  tnsNumero?: string;
  sourcePedido: PedidoCompra;
}

/**
 * Extrae y estructura los datos completos de un pedido de TNS para registrar un satélite.
 */
export function extractTnsSatelliteData(
  pedido: PedidoCompra,
  etapas: KanbanEtapa[]
): TnsExtractedSatelliteData {
  const name = (
    pedido.nomTercero ||
    pedido.tercero_nombre ||
    pedido.RAZONSOCIAL ||
    pedido.proveedor ||
    ""
  ).trim();

  const nit = (
    pedido.nitTercero ||
    pedido.codTercero ||
    pedido.tercero_nit ||
    pedido.NIT ||
    pedido.tercero_id ||
    ""
  ).trim();

  const person_name = cleanContactName(name);
  const phone = (pedido.telefono || "").trim();
  const address = (pedido.dirTercero || "").trim();

  const stageInference = inferStagesFromTns(pedido, etapas);

  // Cargo sugerido
  let cargo = "Satélite";
  if (stageInference.detectedCategory === "arreglos") {
    cargo = "Satélite Arreglos";
  } else if (stageInference.stageLabels.length > 0) {
    cargo = `Satélite ${stageInference.stageLabels.join(" / ")}`;
  }

  // Muestra de material
  const sampleMat =
    pedido.detalles?.[0]?.nomMat ||
    pedido.items?.[0]?.nomMat ||
    pedido.detalles?.[0]?.descripcion ||
    null;

  return {
    name,
    nit,
    person_name,
    phone,
    address,
    cargo,
    production_stage_keys: stageInference.stageKeys,
    stageLabels: stageInference.stageLabels,
    detectedFrom: stageInference.detectedFrom,
    sampleMaterial: sampleMat,
    tnsNumero: pedido.numero || pedido.NUMDOC || undefined,
    sourcePedido: pedido,
  };
}

export interface UniqueTnsTercero {
  nit: string;
  name: string;
  contactName: string;
  phone: string;
  address: string;
  sampleMaterial: string;
  pedidosCount: number;
  stageKeys: string[];
  stageLabels: string[];
  detectedFrom: string | null;
  latestPedido: PedidoCompra;
}

/**
 * Agrupa y consolida los terceros únicos provenientes de una lista de PedidoCompra de TNS.
 */
export function getUniqueTnsTerceros(
  pedidos: PedidoCompra[],
  etapas: KanbanEtapa[]
): UniqueTnsTercero[] {
  const map = new Map<string, UniqueTnsTercero>();

  for (const ped of pedidos) {
    const nit = (
      ped.nitTercero ||
      ped.codTercero ||
      ped.tercero_nit ||
      ped.NIT ||
      ped.tercero_id ||
      ""
    ).trim();

    const name = (
      ped.nomTercero ||
      ped.tercero_nombre ||
      ped.RAZONSOCIAL ||
      ped.proveedor ||
      ""
    ).trim();

    if (!name && !nit) continue;

    const key = nit ? `nit:${nit}` : `name:${normalizeText(name)}`;
    const existing = map.get(key);

    if (existing) {
      existing.pedidosCount += 1;
      // Si el existente no tenía teléfono/dirección y este sí, complementar
      if (!existing.phone && ped.telefono) existing.phone = ped.telefono.trim();
      if (!existing.address && ped.dirTercero) existing.address = ped.dirTercero.trim();
      // Si este tiene detalles y el existente no tenía stageKeys
      if (existing.stageKeys.length === 0 && ped.detalles && ped.detalles.length > 0) {
        const inf = inferStagesFromTns(ped, etapas);
        if (inf.stageKeys.length > 0) {
          existing.stageKeys = inf.stageKeys;
          existing.stageLabels = inf.stageLabels;
          existing.detectedFrom = inf.detectedFrom;
        }
      }
    } else {
      const extracted = extractTnsSatelliteData(ped, etapas);
      map.set(key, {
        nit: extracted.nit,
        name: extracted.name,
        contactName: extracted.person_name,
        phone: extracted.phone,
        address: extracted.address,
        sampleMaterial: extracted.sampleMaterial || "",
        pedidosCount: 1,
        stageKeys: extracted.production_stage_keys,
        stageLabels: extracted.stageLabels,
        detectedFrom: extracted.detectedFrom,
        latestPedido: ped,
      });
    }
  }

  return Array.from(map.values());
}
