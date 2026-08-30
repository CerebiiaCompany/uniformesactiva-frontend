import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Plus, Loader2, Trash2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useGetProductDetail } from "@/hooks/useGetProductDetail";
import { useGetVariants } from "@/hooks/useGetVariants";
import { useDeleteVariant } from "@/hooks/useDeleteVariant";
import type { ProductVariant } from "@/types/variant";
import { useGetFabricCosts } from "@/hooks/useGetFabricCosts";
import { useGetLaborCosts } from "@/hooks/useGetLaborCosts";
import { useGetExtraCosts } from "@/hooks/useGetExtraCosts";
import { useGetCIFCosts } from "@/hooks/useGetCIFCosts";
import { useGetSizeConsumption } from "@/hooks/useGetSizeConsumption";
import { useGetSupplyCosts } from "@/hooks/useGetSupplyCosts";
import { useGetCostCatalogs } from "@/hooks/useGetCostCatalogs";
import { useGetCostSummary } from "@/hooks/useGetCostSummary";
import { useFabricCosts } from "@/hooks/useFabricCost";
import { useSupplyCosts } from "@/hooks/useSupplyCosts";
import { useLaborCosts } from "@/hooks/useLaborCosts";
import { useExtraCosts } from "@/hooks/useExtraCosts";
import { useCIFCosts } from "@/hooks/useCIFCosts";
import { useSizeConsumption } from "@/hooks/useSizeConsumption";
import { useCreateProveedor } from "@/hooks/useCreateProveedor";
import { useCreateInsumoTipo } from "@/hooks/useCreateInsumoTipo";
import { useCreateManoDeObraFase } from "@/hooks/useCreateManoDeObraFase";
import { useCreateVariant } from "@/hooks/useCreateVariant";

import { FabricCostsTable } from "@/components/variant-cost/FabricCostsTable";
import { SuppliesTable } from "@/components/variant-cost/SuppliesTable";
import {
    SupplyFormDialog,
    type InventorySupplyRef,
    type SupplyFormSubmitData,
} from "@/components/variant-cost/SupplyFormDialog";
import { LaborCostsTable } from "@/components/variant-cost/LaborCostsTable";
import { ExtraCostsTable } from "@/components/variant-cost/ExtraCostsTable";
import { CIFCard } from "@/components/variant-cost/CIFCard";
import { SizeConsumptionTable } from "@/components/variant-cost/SizeConsumptionTable";
import { VariantSizeCostBreakdownTable } from "@/components/variant-cost/VariantSizeCostBreakdownTable";
import { ModalForm, FieldDefinition } from "@/components/ui/ModalForm";
import { getNewInsumoTipoFields } from "@/lib/insumo-tipo-form";
import { normalizeDecimalInput } from "@/lib/decimal-input";
import { formatCurrency, formatDecimal, formatForInput } from "@/lib/format-number";
import { sumApplicableCostLines } from "@/lib/cost-summary";
import type { UpdateLaborPayload, UpdateSupplyPayload, UpdateExtraCostPayload } from "@/types/variant";
import { cn } from "@/lib/utils";
import {
    getAllTNSInventario,
    parseTNSDescription,
    parseTNSNumber,
    resolveTNSMaterialUnitCost,
    clasificarArticuloTNS,
    getTNSItemUnit,
    cleanTNSProveedorName,
    resolveTNSProveedorPrincipal,
} from "@/services/tnsService";
import type { TNSInventarioItem } from "@/types/tns";
import {
    classifyFabricBodega,
    cleanFabricBodegaDisplayName,
    type FabricBodegaKind,
} from "@/lib/tns-fabric-bodega";

/** IVA Colombia (19%). */
const IVA_RATE = 0.19;
/** Margen sobre el costo de la prenda (como en la hoja de costeo). */
const DEFAULT_MARGIN_ON_COST = 0.17;

function roundPesos(value: number): number {
    return Math.round(Number.isFinite(value) ? value : 0);
}

/** Precio sugerido: costo → margen 17% → sin IVA → IVA 19% → con IVA. */
function buildSuggestedSalePricing(costoTotal: number) {
    const costo = roundPesos(costoTotal);
    if (costo <= 0) return null;
    const margenMonto = roundPesos(costo * DEFAULT_MARGIN_ON_COST);
    const precioSinIva = roundPesos(costo + margenMonto);
    const iva = roundPesos(precioSinIva * IVA_RATE);
    const precioConIva = roundPesos(precioSinIva + iva);
    return {
        costoTotal: costo,
        margenPct: DEFAULT_MARGIN_ON_COST * 100,
        margenMonto,
        precioSinIva,
        iva,
        precioConIva,
    };
}

/** Si el usuario edita el precio con IVA, recalcula el desglose (margen sobre costo). */
function buildSalePricingFromPriceWithIva(precioConIvaInput: number, costoTotal: number) {
    const costo = roundPesos(costoTotal);
    const precioConIva = roundPesos(precioConIvaInput);
    if (precioConIva <= 0) return null;
    const precioSinIva = roundPesos(precioConIva / (1 + IVA_RATE));
    const iva = roundPesos(precioConIva - precioSinIva);
    const margenMonto = roundPesos(precioSinIva - costo);
    const margenPct = costo > 0 ? (margenMonto / costo) * 100 : 0;
    return {
        costoTotal: costo,
        margenPct,
        margenMonto,
        precioSinIva,
        iva,
        precioConIva,
    };
}

const resolveTallaId = (value: string) => (value ? value : null);

type ModalType =
    | "new_variant"
    | "supply"
    | "edit_supply"
    | "edit_fabric"
    | "labor"
    | "edit_labor"
    | "extra"
    | "edit_extra"
    | "new_proveedor"
    | "new_insumo_tipo"
    | "new_labor_fase"
    | "";

export default function VariantCostPage() {
    const { productId, variantId } = useParams<{ productId: string; variantId?: string }>();
    const [searchParams] = useSearchParams();
    const lineCode = searchParams.get("lineCode");
    const navigate = useNavigate();

    const { product, isLoading: isProductLoading } = useGetProductDetail(productId);
    const { variants, isLoading: isVariantsLoading, refetch: refetchVariants } = useGetVariants(productId);
    const { sizes, supplyTypes, laborPhases, proveedores, refetchProveedores, refetchSupplyTypes, refetchLaborPhases } =
        useGetCostCatalogs();
    const { createProveedor } = useCreateProveedor();
    const { createInsumoTipo } = useCreateInsumoTipo();
    const { createManoDeObraFase } = useCreateManoDeObraFase();

    const { createVariant } = useCreateVariant();
    const { deleteVariant, isLoading: isDeletingVariant } = useDeleteVariant();
    const [deletingVariant, setDeletingVariant] = useState<ProductVariant | null>(null);
    const { addFabric, updateFabric, deleteFabric, setFabricPrincipal, loading: isFabricLoading } =
        useFabricCosts();
    const { addSupply, updateSupply, deleteSupply } = useSupplyCosts();
    const { addLabor, updateLabor, deleteLabor } = useLaborCosts();
    const { addExtra, updateExtra, deleteExtra } = useExtraCosts();
    const { addCIF, updateCIF, deleteCIF } = useCIFCosts();
    const { updateSizeConsumption, loading: isSalePriceSaving } = useSizeConsumption();

    const activeVariantId = variantId ?? "";
    const hasActiveVariant = !!variantId;

    const { data: fabrics } = useGetFabricCosts(activeVariantId);
    const { data: labor } = useGetLaborCosts(activeVariantId);
    const { data: extras } = useGetExtraCosts(activeVariantId);
    const { data: cifData } = useGetCIFCosts(activeVariantId);
    const { data: sizeCons } = useGetSizeConsumption(activeVariantId);
    const { data: supplies } = useGetSupplyCosts(activeVariantId);
    const [tnsItems, setTnsItems] = useState<TNSInventarioItem[]>([]);
    const [tnsLoading, setTnsLoading] = useState<boolean>(false);

    useEffect(() => {
        let isMounted = true;
        setTnsLoading(true);
        getAllTNSInventario()
            .then((res) => {
                if (isMounted) setTnsItems(res.data || []);
            })
            .catch((err) => console.error("Error al cargar materiales TNS en costeo:", err))
            .finally(() => {
                if (isMounted) setTnsLoading(false);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const NON_FABRIC_KEYWORDS = useMemo(
        () => [
            "AGUAS",
            "ELECTRICA",
            "ENERGIA",
            "TELECOMUNICACIONES",
            "CLARO",
            "MOVISTAR",
            "TIGO",
            "CAMARA DE COMERCIO",
            "DIAN",
            "ALCALDIA",
            "BANCO",
            "CLINICA",
            "URGENCIAS",
            "MEGA PARTES",
            "SATELITE",
            "CORTADOR",
            "CORTADORA",
            "COSTURITAS",
            "MENSAJERIA",
            "SERVIENTREGA",
            "INTERRAPIDISIMO",
            "GAS",
            "ASEO",
        ],
        []
    );

    // Proveedores 100% extraídos de las telas registradas en TNS
    const allProveedores = useMemo(() => {
        const provMap = new Map<string, Proveedor>();

        const isNonFabricSupplier = (name: string) => {
            const upper = name.toUpperCase();
            return NON_FABRIC_KEYWORDS.some((kw) => upper.includes(kw));
        };

        // Extraer proveedores de telas en bodega materia prima o producción
        const tnsTelas = tnsItems.filter((item) => {
            const c = clasificarArticuloTNS(item);
            if (c.categoria !== "Telas") return false;
            return classifyFabricBodega(item.bodega_Desc, item.bodega_Cod) !== null;
        });

        tnsTelas.forEach((item) => {
            const addValidName = (rawName?: string | null, code?: string) => {
                if (!rawName) return;
                const cleaned = cleanTNSProveedorName(rawName);
                if (!cleaned || cleaned.length < 2 || isNonFabricSupplier(cleaned)) return;
                const key = cleaned.toLowerCase();
                if (!provMap.has(key)) {
                    // Si ya existe en la base de datos de proveedores local de Django, reusar su UUID
                    const localMatch = (proveedores || []).find(
                        (p) => p.name.trim().toLowerCase() === key || p.id === code
                    );
                    provMap.set(key, { id: localMatch ? localMatch.id : code || cleaned, name: cleaned });
                }
            };

            addValidName(item.proveedor_principal);
            addValidName(item.ter_Emp_Nom);
            addValidName(resolveTNSProveedorPrincipal(item));
            if (Array.isArray(item.proveedores)) {
                item.proveedores.forEach((p) => {
                    addValidName(p.ter_Emp_Nom, p.ter_Emp_Cod);
                });
            }
        });

        return Array.from(provMap.values()).sort((a, b) => a.name.localeCompare(b.name, "es-CO"));
    }, [tnsItems, proveedores, NON_FABRIC_KEYWORDS]);

    // Telas de inventario TNS: solo bodega materia prima y producción
    const inventoryFabricRefs = useMemo(() => {
        const tnsTelas = tnsItems.filter((item) => {
            const c = clasificarArticuloTNS(item);
            if (c.categoria !== "Telas") return false;
            return classifyFabricBodega(item.bodega_Desc, item.bodega_Cod) !== null;
        });

        return tnsTelas.map((m) => {
            const parsed = parseTNSDescription(m.prod_Dist_Desc);
            const mainProv = cleanTNSProveedorName(
                resolveTNSProveedorPrincipal(m) || m.proveedor_principal || m.ter_Emp_Nom
            );
            const unitCost = resolveTNSMaterialUnitCost(m, mainProv);
            const rawProvList = [
                resolveTNSProveedorPrincipal(m),
                m.proveedor_principal,
                m.ter_Emp_Nom,
                ...(m.proveedores?.map((p) => p.ter_Emp_Nom || p.nombre) || []),
            ]
                .filter(Boolean)
                .map((s) => cleanTNSProveedorName(s))
                .filter((s) => s.length > 0);

            const bodega_kind = classifyFabricBodega(m.bodega_Desc, m.bodega_Cod) as FabricBodegaKind;

            return {
                code: m.prod_Dist_Cod,
                reference: parsed.name || m.prod_Dist_Desc,
                full_desc: m.prod_Dist_Desc,
                unit_cost: unitCost,
                color: parsed.color || "",
                proveedor: mainProv || "",
                proveedoresList: [...new Set(rawProvList)],
                stock: parseTNSNumber(m.cant_Stock),
                bodega_cod: m.bodega_Cod || "",
                bodega_desc: cleanFabricBodegaDisplayName(m.bodega_Desc || m.bodega_Cod),
                bodega_kind,
            };
        });
    }, [tnsItems]);

    // Insumos de todo el inventario TNS (todas las bodegas)
    const inventorySupplyRefs: InventorySupplyRef[] = useMemo(() => {
        const map = new Map<string, InventorySupplyRef>();

        tnsItems
            .filter((item) => {
                const c = clasificarArticuloTNS(item);
                return c.categoria === "Accesorios" || c.categoria === "Insumos";
            })
            .forEach((m) => {
                const parsed = parseTNSDescription(m.prod_Dist_Desc);
                const mainProv = cleanTNSProveedorName(resolveTNSProveedorPrincipal(m));
                const unitCost = resolveTNSMaterialUnitCost(m, mainProv);
                const bodega_kind = classifyFabricBodega(m.bodega_Desc, m.bodega_Cod) as FabricBodegaKind | null;
                const key =
                    (m.prod_Dist_Cod || "").trim().toUpperCase() ||
                    (parsed.name || m.prod_Dist_Desc).trim().toUpperCase();

                if (!key) return;

                const stock = parseTNSNumber(m.cant_Stock);
                const existing = map.get(key);
                if (
                    !existing ||
                    stock > (existing.stock || 0) ||
                    (!existing.unit_cost && unitCost > 0)
                ) {
                    map.set(key, {
                        code: m.prod_Dist_Cod,
                        reference: parsed.name || m.prod_Dist_Desc,
                        full_desc: m.prod_Dist_Desc,
                        categoria: "Insumos",
                        unit_cost: unitCost > 0 ? unitCost : existing?.unit_cost || 0,
                        unidad: getTNSItemUnit(m),
                        color: parsed.color || "",
                        stock: Math.max(stock, existing?.stock || 0),
                        bodega_cod: m.bodega_Cod || "",
                        bodega_desc: cleanFabricBodegaDisplayName(m.bodega_Desc || m.bodega_Cod),
                        bodega_kind: bodega_kind || undefined,
                    });
                }
            });

        return Array.from(map.values()).sort((a, b) =>
            a.reference.localeCompare(b.reference, "es", { sensitivity: "base" })
        );
    }, [tnsItems]);

    const { data: summary, isLoading: isSummaryLoading } = useGetCostSummary(activeVariantId);
    const [selectedCostSizeId, setSelectedCostSizeId] = useState<string>("");
    const [salePriceInput, setSalePriceInput] = useState("");
    const [isEditingSalePrice, setIsEditingSalePrice] = useState(false);
    /** true cuando el usuario editó el precio a mano (no sobrescribir con sugerencia). */
    const salePriceManualRef = useRef(false);

    useEffect(() => {
        setSelectedCostSizeId("");
        salePriceManualRef.current = false;
        setIsEditingSalePrice(false);
    }, [activeVariantId]);

    // Solo auto-elegir al inicio (sin talla). No pelear si el usuario eligió una sin consumo.
    useEffect(() => {
        if (selectedCostSizeId) return;
        const firstConfigured = (summary?.sizes || []).find((s) => Boolean(s.talla_id))?.talla_id;
        if (firstConfigured) setSelectedCostSizeId(firstConfigured);
    }, [summary?.sizes, selectedCostSizeId]);

    const selectedSizeCost = useMemo(
        () => summary?.sizes?.find((s) => s.talla_id === selectedCostSizeId),
        [summary?.sizes, selectedCostSizeId]
    );

    const hasConfiguredConsumptions = (summary?.sizes?.length ?? 0) > 0;
    /** Hay materiales/costos de variante aunque aún no haya consumo por talla. */
    const hasVariantMaterialCosts =
        Number(summary?.supplies_total ?? 0) > 0 ||
        Number(summary?.labor_total ?? 0) > 0 ||
        Number(summary?.extras_total ?? 0) > 0 ||
        Number(summary?.fabric_price_per_meter ?? 0) > 0 ||
        (fabrics?.length ?? 0) > 0 ||
        (supplies?.length ?? 0) > 0 ||
        (labor?.length ?? 0) > 0 ||
        (extras?.length ?? 0) > 0;

    const formatMeters = (value: number) => formatDecimal(value);

    const fabricTotal = Number(selectedSizeCost?.fabric_total ?? summary?.fabric_total ?? 0);
    const suppliesTotal = Number(selectedSizeCost?.supplies_total ?? summary?.supplies_total ?? 0);
    const laborTotal = Number(selectedSizeCost?.labor_total ?? summary?.labor_total ?? 0);
    const extrasTotal = Number(selectedSizeCost?.extras_total ?? summary?.extras_total ?? 0);
    const overallTotal = Number(selectedSizeCost?.overall_total ?? summary?.overall_total ?? 0);

    const cifList = useMemo(() => {
        if (cifData && cifData.length > 0) return cifData;
        return (extras || []).filter(
            (e) => e.concepto.toUpperCase().includes("CIF") || e.concepto.toUpperCase().includes("INDIRECTO")
        );
    }, [cifData, extras]);

    const nonCifExtras = useMemo(() => {
        return (extras || []).filter(
            (e) => !e.concepto.toUpperCase().includes("CIF") && !e.concepto.toUpperCase().includes("INDIRECTO")
        );
    }, [extras]);

    const consumptionTallaIds = useMemo(() => new Set(sizes.map((s) => s.id)), [sizes]);

    const cifTotal = useMemo(() => {
        return sumApplicableCostLines(cifList, selectedCostSizeId, consumptionTallaIds);
    }, [cifList, selectedCostSizeId, consumptionTallaIds]);

    const pureExtrasTotal = useMemo(() => {
        return sumApplicableCostLines(nonCifExtras, selectedCostSizeId, consumptionTallaIds);
    }, [nonCifExtras, selectedCostSizeId, consumptionTallaIds]);

    const sizeConsumption = Number(selectedSizeCost?.consumption ?? summary?.average_consumption ?? 0);
    const fabricPricePerMeter = Number(summary?.fabric_price_per_meter ?? 0);
    const showFabricBreakdown = sizeConsumption > 0 && fabricPricePerMeter > 0;
    const selectedSizeName =
        selectedSizeCost?.talla_nombre ||
        sizes.find((s) => s.id === selectedCostSizeId)?.label ||
        sizes.find((s) => s.id === selectedCostSizeId)?.name;

    const parsedSalePrice = useMemo(() => {
        const normalized = salePriceInput.replace(/\./g, "").replace(",", ".").trim();
        if (!normalized) return null;
        const value = Number(normalized);
        return Number.isFinite(value) && value > 0 ? value : null;
    }, [salePriceInput]);

    /** Sugerido desde costo talla (margen 17% + IVA 19%). */
    const suggestedPricing = useMemo(
        () => buildSuggestedSalePricing(overallTotal),
        [overallTotal]
    );

    /** Desglose visible: sugerido o recalculado si el usuario cambió el precio. */
    const salePricing = useMemo(() => {
        if (overallTotal <= 0) return null;
        if (parsedSalePrice != null && parsedSalePrice > 0) {
            if (
                suggestedPricing &&
                Math.abs(parsedSalePrice - suggestedPricing.precioConIva) <= 1
            ) {
                return suggestedPricing;
            }
            return buildSalePricingFromPriceWithIva(parsedSalePrice, overallTotal);
        }
        return suggestedPricing;
    }, [overallTotal, parsedSalePrice, suggestedPricing]);

    useEffect(() => {
        if (isEditingSalePrice) return;

        const fromSelected = selectedSizeCost?.precio_venta;
        const savedRaw =
            fromSelected != null && fromSelected !== ""
                ? fromSelected
                : summary?.sizes?.find(
                      (s) =>
                          s.precio_venta != null &&
                          s.precio_venta !== "" &&
                          Number(s.precio_venta) > 0
                  )?.precio_venta;
        const saved =
            savedRaw != null && savedRaw !== ""
                ? Number(String(savedRaw).replace(",", "."))
                : null;

        if (saved != null && Number.isFinite(saved) && saved > 0) {
            setSalePriceInput(formatForInput(saved));
            return;
        }

        if (suggestedPricing?.precioConIva) {
            setSalePriceInput(formatForInput(suggestedPricing.precioConIva));
            return;
        }

        setSalePriceInput("");
    }, [
        selectedCostSizeId,
        selectedSizeCost?.precio_venta,
        summary?.sizes,
        suggestedPricing?.precioConIva,
        isEditingSalePrice,
    ]);

    const handleSaveSalePrice = async () => {
        if (!activeVariantId) return;

        const configured = sizeCons || [];
        if (configured.length === 0) {
            if (salePriceInput.trim()) {
                toast.error(
                    "Configura el consumo de al menos una talla antes de guardar el precio de venta proyectado."
                );
            }
            return;
        }

        const nextValue = parsedSalePrice;
        const currentValues = (summary?.sizes || [])
            .map((s) =>
                s.precio_venta == null || s.precio_venta === ""
                    ? null
                    : Number(String(s.precio_venta).replace(",", "."))
            )
            .filter((n): n is number => n != null && Number.isFinite(n) && n > 0);
        const allSame =
            currentValues.length > 0 &&
            currentValues.every((v) => Math.abs(v - (currentValues[0] || 0)) < 0.001);
        const currentCommon = allSame ? currentValues[0] : null;

        if (nextValue == null && !salePriceInput.trim()) {
            if (currentValues.length === 0) return;
            for (let i = 0; i < configured.length; i++) {
                const rec = configured[i];
                const isLast = i === configured.length - 1;
                const result = await updateSizeConsumption(
                    rec.id,
                    { precio_venta: null },
                    activeVariantId,
                    { skipCacheUpdate: !isLast }
                );
                if (result === false) {
                    toast.error("No se pudo actualizar el precio de venta proyectado");
                    return;
                }
            }
            toast.success("Precio de venta proyectado eliminado de la variante");
            return;
        }

        if (nextValue == null) {
            toast.error("Ingresa un precio de venta proyectado válido.");
            return;
        }

        if (currentCommon != null && Math.abs(currentCommon - nextValue) < 0.001) return;

        for (let i = 0; i < configured.length; i++) {
            const rec = configured[i];
            const isLast = i === configured.length - 1;
            const result = await updateSizeConsumption(
                rec.id,
                { precio_venta: nextValue },
                activeVariantId,
                { skipCacheUpdate: !isLast }
            );
            if (result === false) {
                toast.error("No se pudo guardar el precio de venta proyectado");
                return;
            }
        }
        toast.success("Precio de venta proyectado guardado (con IVA incluido)");
    };

    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        type: ModalType;
        title: string;
        fields: FieldDefinition[];
        initialData?: any;
    }>({
        isOpen: false,
        type: "",
        title: "",
        fields: [],
    });

    const backToProducts = () => {
        if (lineCode) {
            navigate(`/products?lineCode=${encodeURIComponent(lineCode)}`);
            return;
        }
        navigate("/lines");
    };

    const variantCostingUrl = (id: string) => {
        const query = lineCode ? `?lineCode=${encodeURIComponent(lineCode)}` : "";
        return `/products/${productId}/variants/${id}/costing${query}`;
    };

    const handleDeleteVariantConfirm = async () => {
        if (!productId || !deletingVariant) return;

        if (variants.length <= 1) {
            toast.error("No se puede eliminar la única variante de un producto.");
            setDeletingVariant(null);
            return;
        }

        const removedId = deletingVariant.id;
        const result = await deleteVariant(productId, removedId);

        if (!result.success) {
            toast.error(result.error || "No se pudo eliminar la variante");
            return;
        }

        toast.success("Variante eliminada correctamente");
        setDeletingVariant(null);
        await refetchVariants();

        if (removedId === variantId) {
            const next = variants.find((v) => v.id !== removedId);
            if (next) {
                navigate(variantCostingUrl(next.id), { replace: true });
            } else {
                const query = lineCode ? `?lineCode=${encodeURIComponent(lineCode)}` : "";
                navigate(`/products/${productId}${query}`, { replace: true });
            }
        }
    };

    const ensureValidProveedorId = async (provIdentifier?: string): Promise<string | undefined> => {
        if (!provIdentifier) return undefined;
        const trimmed = provIdentifier.trim();
        if (!trimmed) return undefined;

        // 1. Si ya es un ID existente en el catálogo local de Postgres
        const byId = proveedores.find((p) => p.id === trimmed);
        if (byId) return byId.id;

        // 2. Si coincide por nombre con el catálogo local
        const byName = proveedores.find(
            (p) => p.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (byName) return byName.id;

        // 3. Crear automáticamente el proveedor en la base de datos para obtener su UUID válido
        try {
            const res = await createProveedor(trimmed);
            if (res.success && res.data?.id) {
                return res.data.id;
            }
        } catch (err) {
            console.warn("No se pudo auto-crear el proveedor:", err);
        }

        // 4. Si el catálogo tiene algún proveedor, usarlo como fallback seguro
        return proveedores[0]?.id || undefined;
    };

    const [isSupplyDialogOpen, setIsSupplyDialogOpen] = useState<boolean>(false);
    const [editingSupplyData, setEditingSupplyData] = useState<any | null>(null);

    const ensureValidSupplyTypeId = async (
        tipoIdentifier?: string,
        refName?: string,
        refCategory?: string,
        refUnitCost?: number,
        refCode?: string
    ): Promise<string | undefined> => {
        const target = (refName || tipoIdentifier || "").trim();
        const code = (refCode || "").trim();
        if (!target && !code) return undefined;

        const codeNorm = code.toUpperCase();

        // 1. Priorizar coincidencia exacta por código TNS (prod_Dist_Cod / codigo_sku)
        if (codeNorm) {
            const byCode = supplyTypes.find((t) => {
                const sku = String(t.codigo_sku || t.code || "").trim().toUpperCase();
                return sku && sku === codeNorm;
            });
            if (byCode) return byCode.id;
        }

        // 2. Si coincide con algún supplyType existente por ID
        const byId = supplyTypes.find((t) => t.id === target || t.id === tipoIdentifier);
        if (byId) return byId.id;

        // 3. Por nombre (legacy)
        const byName = supplyTypes.find(
            (t) =>
                t.name.trim().toLowerCase() === target.toLowerCase() ||
                (t.label && t.label.trim().toLowerCase() === target.toLowerCase())
        );
        if (byName) return byName.id;

        // 4. Si no existe, crear automáticamente el InsumoTipo con código TNS
        try {
            const res = await createInsumoTipo({
                name: target || code,
                categoria: refCategory || "Insumos",
                unidad_medida: "UND",
                codigo_sku: code,
                precio_unitario_default: refUnitCost != null && refUnitCost > 0 ? refUnitCost : null,
            });
            if (res.success && res.data?.id) {
                await refetchSupplyTypes();
                return res.data.id;
            }
        } catch (err) {
            console.warn("No se pudo auto-crear el tipo de insumo:", err);
        }

        return supplyTypes[0]?.id || undefined;
    };

    const handleSaveSupplyModal = async (data: SupplyFormSubmitData): Promise<boolean> => {
        if (!activeVariantId) return false;

        const resolvedTipoId = await ensureValidSupplyTypeId(
            undefined,
            data.reference,
            data.tipo_categoria,
            Number(data.unit_price) || 0,
            data.code
        );

        if (!resolvedTipoId) {
            toast.error("No se pudo resolver el tipo de insumo.");
            return false;
        }

        if (editingSupplyData?.id) {
            const payload: Record<string, string | null> = {
                tipo_id: resolvedTipoId,
                talla_id: resolveTallaId(data.talla_id),
                quantity: data.quantity,
                unit_price: data.unit_price,
            };
            const ok = await updateSupply(editingSupplyData.id, payload, activeVariantId);
            if (ok) {
                toast.success("Insumo actualizado");
                setIsSupplyDialogOpen(false);
                setEditingSupplyData(null);
                return true;
            } else {
                toast.error("No se pudo actualizar el insumo");
                return false;
            }
        } else {
            const ok = await addSupply({
                variant_id: activeVariantId,
                tipo_id: resolvedTipoId,
                talla_id: resolveTallaId(data.talla_id),
                quantity: data.quantity,
                unit_price: data.unit_price,
            });
            if (ok) {
                toast.success("Insumo agregado correctamente");
                setIsSupplyDialogOpen(false);
                setEditingSupplyData(null);
                return true;
            } else {
                toast.error("No se pudo agregar el insumo");
                return false;
            }
        }
    };

    const handleAddFabric = async (payload: any) => {
        const finalProveedorId = await ensureValidProveedorId(payload.proveedor_id);
        const ok = await addFabric({
            ...payload,
            proveedor_id: finalProveedorId,
        });
        if (ok) {
            toast.success("Tela agregada correctamente");
        } else {
            toast.error("Error al agregar el costo de tela");
        }
        return ok;
    };

    const handleOpenModal = (
        type: ModalType,
        title: string,
        fields: FieldDefinition[],
        initialData?: any
    ) => {
        setModalConfig({ isOpen: true, type, title, fields, initialData });
    };

    const handleSubmit = async (data: Record<string, string>) => {
        if (!productId) return;

        try {
            if (modalConfig.type === "new_variant") {
                const result = await createVariant(productId, {
                    name: data.name,
                    code: data.code,
                });

                if (result.success) {
                    toast.success("Variante creada correctamente");
                    await refetchVariants();
                    const newVariantId = (result.data as { id: string })?.id;
                    if (newVariantId) {
                        navigate(variantCostingUrl(newVariantId));
                    }
                } else {
                    toast.error(result.error || "No se pudo crear la variante");
                }
            } else if (modalConfig.type === "supply" && hasActiveVariant) {
                const ok = await addSupply({
                    variant_id: activeVariantId,
                    tipo_id: data.tipo_id,
                    talla_id: resolveTallaId(data.talla_id),
                    quantity: data.quantity,
                    unit_price: data.unit_price,
                });
                if (ok) toast.success("Insumo agregado");
                else toast.error("No se pudo agregar el insumo");
            } else if (modalConfig.type === "edit_supply" && modalConfig.initialData?.id && hasActiveVariant) {
                const initial = modalConfig.initialData;
                const payload: Record<string, string | null> = {};
                const initialTipoId = initial.tipo_id || initial.tipo;
                const initialTallaId = initial.talla_id || "";

                if (data.tipo_id !== initialTipoId) payload.tipo_id = data.tipo_id;
                if (data.quantity !== initial.quantity) payload.quantity = data.quantity;
                if (data.unit_price !== initial.unit_price) payload.unit_price = data.unit_price;
                if ((data.talla_id || "") !== initialTallaId) {
                    payload.talla_id = resolveTallaId(data.talla_id);
                }

                if (Object.keys(payload).length === 0) {
                    toast.info("No hay cambios para guardar");
                } else {
                    const ok = await updateSupply(initial.id, payload, activeVariantId);
                    if (ok) toast.success("Insumo actualizado");
                    else toast.error("No se pudo actualizar el insumo");
                }
            } else if (modalConfig.type === "edit_fabric" && modalConfig.initialData?.id && hasActiveVariant) {
                const initial = modalConfig.initialData;
                const payload: Record<string, string | boolean> = {};
                const tieneIva = data.tiene_iva === "true";
                const initialTieneIva = Boolean(initial.tiene_iva);
                const meters = normalizeDecimalInput(data.meters);
                const pricePerMeter = normalizeDecimalInput(data.price_per_meter);

                if (data.proveedor_id !== initial.proveedor_id) {
                    const resolvedProvId = await ensureValidProveedorId(data.proveedor_id);
                    if (resolvedProvId) payload.proveedor_id = resolvedProvId;
                }
                if (data.reference !== initial.reference) payload.reference = data.reference;
                const nextCodigo = (data.codigo || "").trim();
                const initialCodigo = String(initial.codigo || "").trim();
                if (nextCodigo !== initialCodigo) payload.codigo = nextCodigo;
                // Si cambió la referencia, intentar resolver código desde TNS
                if (data.reference !== initial.reference && !nextCodigo) {
                    const refLower = data.reference.trim().toLowerCase();
                    const match = inventoryFabricRefs.find(
                        (r) =>
                            (nextCodigo && r.code?.trim().toLowerCase() === nextCodigo.toLowerCase()) ||
                            r.reference.trim().toLowerCase() === refLower ||
                            (r.code && r.code.trim().toLowerCase() === refLower)
                    );
                    if (match?.code) payload.codigo = match.code.trim();
                }
                if (meters !== normalizeDecimalInput(String(initial.meters))) payload.meters = meters;
                if (pricePerMeter !== normalizeDecimalInput(String(initial.price_per_meter))) {
                    payload.price_per_meter = pricePerMeter;
                }
                if (tieneIva !== initialTieneIva) payload.tiene_iva = tieneIva;

                if (Object.keys(payload).length === 0) {
                    toast.info("No hay cambios para guardar");
                } else {
                    const ok = await updateFabric(initial.id, payload, activeVariantId);
                    if (ok) toast.success("Costo de tela actualizado");
                    else toast.error("No se pudo actualizar el costo de tela");
                }
            } else if (modalConfig.type === "labor" && hasActiveVariant) {
                const ok = await addLabor({
                    variant_id: activeVariantId,
                    fase_id: data.fase_id,
                    talla_id: resolveTallaId(data.talla_id),
                    cantidad: data.cantidad || "1",
                    unit_price: data.unit_price,
                });
                if (ok) toast.success("Fase de mano de obra agregada");
                else toast.error("No se pudo agregar la fase");
            } else if (modalConfig.type === "edit_labor" && modalConfig.initialData?.id) {
                const initial = modalConfig.initialData;
                const payload: Record<string, string | null> = {};
                const initialFaseId = initial.fase_id || initial.fase;
                const initialTallaId = initial.talla_id || "";

                if (data.fase_id !== initialFaseId) payload.fase_id = data.fase_id;
                if (data.cantidad !== initial.cantidad) payload.cantidad = data.cantidad;
                if (data.unit_price !== initial.unit_price) payload.unit_price = data.unit_price;
                if ((data.talla_id || "") !== initialTallaId) {
                    payload.talla_id = resolveTallaId(data.talla_id);
                }

                if (Object.keys(payload).length === 0) {
                    toast.info("No hay cambios para guardar");
                } else {
                    const ok = await updateLabor(initial.id, payload, activeVariantId);
                    if (ok) toast.success("Fase actualizada");
                    else toast.error("No se pudo actualizar la fase");
                }
            } else if (modalConfig.type === "extra" && hasActiveVariant) {
                const concepto = (data.concepto || "").trim();
                if (!concepto) {
                    toast.error("El concepto es obligatorio");
                } else {
                    const ok = await addExtra({
                        variant_id: activeVariantId,
                        concepto,
                        talla_id: resolveTallaId(data.talla_id),
                        cantidad: data.cantidad || "1",
                        unit_price: data.unit_price,
                    });
                    if (ok) toast.success("Costo extra agregado");
                    else toast.error("No se pudo agregar el costo extra");
                }
            } else if (modalConfig.type === "edit_extra" && modalConfig.initialData?.id && hasActiveVariant) {
                const initial = modalConfig.initialData;
                const payload: UpdateExtraCostPayload = {};
                const initialTallaId = initial.talla_id || "";
                const concepto = (data.concepto || "").trim();

                if (concepto !== (initial.concepto || "")) payload.concepto = concepto;
                if (data.cantidad !== initial.cantidad) payload.cantidad = data.cantidad;
                if (data.unit_price !== initial.unit_price) payload.unit_price = data.unit_price;
                if ((data.talla_id || "") !== initialTallaId) {
                    payload.talla_id = resolveTallaId(data.talla_id);
                }

                if (Object.keys(payload).length === 0) {
                    toast.info("No hay cambios para guardar");
                } else if (payload.concepto !== undefined && !payload.concepto) {
                    toast.error("El concepto es obligatorio");
                } else {
                    const ok = await updateExtra(initial.id, payload, activeVariantId);
                    if (ok) toast.success("Costo extra actualizado");
                    else toast.error("No se pudo actualizar el costo extra");
                }
            } else if (modalConfig.type === "new_proveedor") {
                const result = await createProveedor(data.name);
                if (result.success) {
                    toast.success("Proveedor creado");
                    await refetchProveedores();
                } else {
                    toast.error(result.error || "No se pudo crear el proveedor");
                }
            } else if (modalConfig.type === "new_insumo_tipo") {
                const result = await createInsumoTipo({
                    name: data.name,
                    categoria: data.categoria,
                    unidad_medida: data.unidad_medida,
                    precio_unitario_default: data.precio_unitario_default
                        ? Number(data.precio_unitario_default)
                        : null,
                    codigo_sku: data.codigo_sku,
                    proveedor_marca: data.proveedor_marca,
                    color: "",
                    stock_minimo: data.stock_minimo ? Number(data.stock_minimo) : null,
                    stock_inicial: data.stock_inicial ? Number(data.stock_inicial) : null,
                });
                if (result.success) {
                    toast.success("Tipo de insumo creado");
                    await refetchSupplyTypes();
                } else {
                    toast.error(result.error || "No se pudo crear el tipo de insumo");
                }
            } else if (modalConfig.type === "new_labor_fase") {
                const result = await createManoDeObraFase({
                    name: data.name,
                    orden: data.orden ? Number(data.orden) : 0,
                });
                if (result.success) {
                    toast.success("Fase de mano de obra creada");
                    await refetchLaborPhases();
                } else {
                    toast.error(result.error || "No se pudo crear la fase");
                }
            }
        } finally {
            setModalConfig((prev) => ({ ...prev, isOpen: false }));
        }
    };

    const handleSaveCIF = async ({
        id,
        unit_price,
        talla_id,
    }: {
        id?: string;
        unit_price: string;
        talla_id: string | null;
    }) => {
        if (!hasActiveVariant) return false;
        if (id) {
            const ok = await updateCIF(
                id,
                {
                    concepto: "Costos Indirectos de Fabricación (CIF)",
                    unit_price,
                    cantidad: "1",
                    talla_id: resolveTallaId(talla_id),
                },
                activeVariantId
            );
            if (ok) toast.success("CIF actualizado correctamente");
            else toast.error("No se pudo actualizar el CIF");
            return ok;
        } else {
            const ok = await addCIF({
                variant_id: activeVariantId,
                concepto: "Costos Indirectos de Fabricación (CIF)",
                unit_price,
                cantidad: "1",
                talla_id: resolveTallaId(talla_id),
            });
            if (ok) toast.success("CIF asignado correctamente");
            else toast.error("No se pudo asignar el CIF");
            return ok;
        }
    };

    const handleDeleteCIF = async (id: string) => {
        if (!hasActiveVariant) return false;
        const ok = await deleteCIF(id, activeVariantId);
        if (ok) toast.success("CIF eliminado");
        else toast.error("No se pudo eliminar el CIF");
        return ok;
    };

    const supplyTypeOptions = supplyTypes.map((t) => ({
        value: t.id,
        label: t.label || t.name,
        defaultUnitPrice: t.precio_unitario_default ?? null,
    }));

    const newInsumoTipoFields: FieldDefinition[] = getNewInsumoTipoFields();

    const laborPhaseOptions = laborPhases.map((f) => ({
        value: f.id,
        label: f.label || f.name,
    }));

    const sizeScopeOptions = [
        { value: "", label: "Todas las tallas (compartido)" },
        ...sizes.map((s) => ({
            value: s.id,
            label: `${s.label || s.name || s.code || s.id} (solo esta talla)`,
        })),
    ];

    const supplyTallaField = {
        name: "talla_id",
        label: "Alcance por talla",
        type: "select" as const,
        required: false,
        options: sizeScopeOptions,
    };

    const laborTallaField = {
        name: "talla_id",
        label: "Alcance por talla",
        type: "select" as const,
        required: false,
        options: sizeScopeOptions,
    };

    const extraTallaField = {
        name: "talla_id",
        label: "Alcance por talla",
        type: "select" as const,
        required: false,
        options: sizeScopeOptions,
    };

    const proveedorOptions = allProveedores.map((p) => ({
        value: p.id,
        label: p.name,
    }));

    const ivaOptions = [
        { value: "false", label: "No" },
        { value: "true", label: "Sí" },
    ];

    const fabricEditFields: FieldDefinition[] = [
        { name: "proveedor_id", label: "Proveedor", type: "select", options: proveedorOptions },
        { name: "reference", label: "Referencia", type: "text", placeholder: "REF-001" },
        { name: "codigo", label: "Código TNS", type: "text", placeholder: "Código exacto inventario" },
        {
            name: "meters",
            label: "metro",
            type: "decimal",
            placeholder: "1",
        },
        {
            name: "price_per_meter",
            label: "Precio por metro",
            type: "decimal",
            placeholder: "5000,00",
        },
        { name: "tiene_iva", label: "IVA", type: "select", options: ivaOptions },
    ];

    return (
        <AppLayout
            title={product?.name || "Producto"}
            subtitle="Variantes, tallas y estructura de costos"
            eyebrow="Operación"
        >
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={backToProducts} className="pl-0">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Volver a productos
                    </Button>
                    <h2 className="text-xl font-bold">
                        {isProductLoading ? (
                            <span className="text-muted-foreground font-normal inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                            </span>
                        ) : (
                            product?.name || "Producto"
                        )}
                    </h2>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                        <CardTitle className="text-lg font-bold tracking-tight">Variantes</CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                handleOpenModal("new_variant", "Añadir variante", [
                                    { name: "name", label: "Nombre", placeholder: "Talla especial", type: "text" },
                                    { name: "code", label: "Código", placeholder: "CAM001-V1", type: "text" },
                                ])
                            }
                        >
                            <Plus className="h-4 w-4 mr-2" /> Añadir variante
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isVariantsLoading ? (
                            <div className="px-6 py-8 flex justify-center">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : variants.length ? (
                            variants.map((v) => {
                                const isActive = v.id === variantId;
                                const canDelete = variants.length > 1;
                                return (
                                    <div
                                        key={v.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            if (!isActive) navigate(variantCostingUrl(v.id));
                                        }}
                                        onKeyDown={(e) => {
                                            if ((e.key === "Enter" || e.key === " ") && !isActive) {
                                                e.preventDefault();
                                                navigate(variantCostingUrl(v.id));
                                            }
                                        }}
                                        className={cn(
                                            "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] px-6 py-3 border-b items-center text-sm cursor-pointer transition-colors hover:bg-primary/5",
                                            isActive && "bg-primary/5"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "truncate",
                                                isActive ? "text-primary font-bold" : "text-foreground"
                                            )}
                                        >
                                            {v.code}
                                        </span>
                                        <div className="min-w-0 flex items-center justify-between gap-2 text-left">
                                            <span className="truncate">
                                                {v.name}
                                                {isActive && (
                                                    <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                        Activa
                                                    </span>
                                                )}
                                            </span>
                                            {v.estimated_cost != null && Number(v.estimated_cost) > 0 && (
                                                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                                                    ${formatCurrency(v.estimated_cost)}
                                                </span>
                                            )}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                                            title={
                                                canDelete
                                                    ? "Eliminar variante"
                                                    : "No se puede eliminar la única variante"
                                            }
                                            disabled={!canDelete || isDeletingVariant}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!canDelete) {
                                                    toast.error(
                                                        "No se puede eliminar la única variante de un producto."
                                                    );
                                                    return;
                                                }
                                                setDeletingVariant(v);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                                Añade una variante para configurar tallas y costos.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {!hasActiveVariant ? (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            Selecciona una variante para ver tallas, consumos y costos.
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <SizeConsumptionTable
                                    data={sizeCons || []}
                                    variantId={activeVariantId}
                                    sizes={sizes}
                                    selectedSizeId={selectedCostSizeId}
                                    onSelectedSizeChange={setSelectedCostSizeId}
                                />
                            </div>
                            <div className="lg:col-span-1">
                                <Card className="h-full">
                                    <CardHeader className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="costo-venta" className="text-xs text-muted-foreground">
                                                Precio de venta IVA incluido
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                                    $
                                                </span>
                                                <Input
                                                    id="costo-venta"
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder={suggestedPricing ? formatForInput(suggestedPricing.precioConIva) : "Se calcula solo"}
                                                    value={salePriceInput}
                                                    onFocus={() => setIsEditingSalePrice(true)}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/[^\d.,]/g, "");
                                                        salePriceManualRef.current = Boolean(raw.trim());
                                                        setSalePriceInput(raw);
                                                    }}
                                                    onBlur={() => {
                                                        setIsEditingSalePrice(false);
                                                        handleSaveSalePrice();
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    disabled={
                                                        isSalePriceSaving ||
                                                        !(sizeCons && sizeCons.length > 0)
                                                    }
                                                    className="pl-7 tabular-nums font-semibold text-base"
                                                />
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Autocompletado: costo + margen{" "}
                                                {Math.round(DEFAULT_MARGIN_ON_COST * 100)}% + IVA{" "}
                                                {Math.round(IVA_RATE * 100)}%. Editable; se aplica a
                                                todas las tallas.
                                            </p>
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold tracking-tight">Resumen de costos</CardTitle>
                                            {selectedSizeName && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Talla {selectedSizeName}
                                                    {selectedSizeCost
                                                        ? null
                                                        : hasConfiguredConsumptions
                                                          ? " — sin consumo en esta talla"
                                                          : " — sin consumo de tela configurado"}
                                                </p>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm">
                                        {isSummaryLoading && !summary ? (
                                            <div className="flex items-center gap-2 text-muted-foreground py-4">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Calculando resumen...
                                            </div>
                                        ) : selectedCostSizeId &&
                                          !selectedSizeCost &&
                                          hasConfiguredConsumptions ? (
                                            <p className="text-sm text-muted-foreground py-4">
                                                Esta talla aún no tiene consumo de tela. Elige una talla con
                                                consumo guardado o guarda los metros de{" "}
                                                {selectedSizeName ? `la talla ${selectedSizeName}` : "esta talla"}{" "}
                                                en la tabla de la izquierda.
                                            </p>
                                        ) : !hasConfiguredConsumptions && !hasVariantMaterialCosts ? (
                                            <p className="text-sm text-muted-foreground py-4">
                                                Configura costos de tela/insumos/mano de obra y guarda el
                                                consumo de tela por talla para ver el resumen.
                                            </p>
                                        ) : (
                                            <>
                                                {!hasConfiguredConsumptions ? (
                                                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-snug">
                                                        Ya hay materiales/costos de variante, pero falta el{" "}
                                                        <strong>consumo de tela por talla</strong> (metros).
                                                        Guárdalo a la izquierda para calcular la tela y el
                                                        costo por talla. Mientras tanto se muestran insumos,
                                                        mano de obra y extras.
                                                    </p>
                                                ) : null}
                                                <div className="flex justify-between items-start gap-3">
                                                    <div>
                                                        <span>Tela</span>
                                                        {showFabricBreakdown ? (
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {formatMeters(sizeConsumption)} m × $
                                                                {formatCurrency(fabricPricePerMeter)}/m
                                                            </p>
                                                        ) : fabricPricePerMeter > 0 && !hasConfiguredConsumptions ? (
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                Precio tela ${formatCurrency(fabricPricePerMeter)}
                                                                /m · falta consumo por talla
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <span>${formatCurrency(fabricTotal)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Insumos</span>
                                                    <span>${formatCurrency(suppliesTotal)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Mano de obra</span>
                                                    <span>${formatCurrency(laborTotal)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Costos extra</span>
                                                    <span>${formatCurrency(pureExtrasTotal)}</span>
                                                </div>
                                                <div className="flex justify-between font-medium text-foreground">
                                                    <span>CIF (Costos Indirectos)</span>
                                                    <span className="font-mono">${formatCurrency(cifTotal)}</span>
                                                </div>
                                                {selectedSizeCost &&
                                                    (supplies?.length || labor?.length) &&
                                                    suppliesTotal === 0 &&
                                                    laborTotal === 0 && (
                                                        <p className="text-[11px] text-muted-foreground leading-snug">
                                                            Hay líneas de insumos/mano de obra, pero ninguna aplica a
                                                            esta talla. Usa &quot;Todas las tallas&quot; o la misma
                                                            talla del resumen.
                                                        </p>
                                                    )}
                                                <div className="border-t pt-2 flex justify-between text-base rounded-md bg-sky-50 px-2 py-2 -mx-0.5">
                                                    <span>Costo total prenda</span>
                                                    <span className="tabular-nums">
                                                        ${formatCurrency(overallTotal)}
                                                    </span>
                                                </div>

                                                {salePricing ? (
                                                    <div className="border-t pt-3 space-y-2.5">
                                                        <div className="flex justify-between font-medium">
                                                            <span>Margen (%)</span>
                                                            <span
                                                                className={cn(
                                                                    "tabular-nums",
                                                                    salePricing.margenPct < 0
                                                                        ? "text-red-600"
                                                                        : "text-emerald-600"
                                                                )}
                                                            >
                                                                {salePricing.margenPct.toFixed(2)}%
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between font-medium">
                                                            <span>Margen ($)</span>
                                                            <span
                                                                className={cn(
                                                                    "tabular-nums",
                                                                    salePricing.margenMonto < 0
                                                                        ? "text-red-600"
                                                                        : "text-emerald-600"
                                                                )}
                                                            >
                                                                ${formatCurrency(salePricing.margenMonto)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Precio de venta sin IVA</span>
                                                            <span className="tabular-nums">
                                                                ${formatCurrency(salePricing.precioSinIva)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>IVA ({Math.round(IVA_RATE * 100)}%)</span>
                                                            <span className="tabular-nums">
                                                                ${formatCurrency(salePricing.iva)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-base rounded-md bg-amber-100 px-2 py-2 -mx-0.5 border border-amber-200">
                                                            <span>Precio de venta IVA incluido</span>
                                                            <span className="tabular-nums">
                                                                ${formatCurrency(salePricing.precioConIva)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-muted-foreground border-t pt-3">
                                                        Completa el costo de la talla para calcular margen,
                                                        IVA y precio de venta automáticamente.
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <VariantSizeCostBreakdownTable
                            sizes={summary?.sizes ?? []}
                            selectedSizeId={selectedCostSizeId}
                            onSelectSize={setSelectedCostSizeId}
                            averageConsumption={summary?.average_consumption}
                        />

                        <FabricCostsTable
                            data={fabrics || []}
                            variantId={activeVariantId}
                            proveedores={allProveedores}
                            inventoryFabricRefs={inventoryFabricRefs}
                            isSettingPrincipal={isFabricLoading}
                            onAdd={handleAddFabric}
                            onSetPrincipal={async (id) => {
                                const ok = await setFabricPrincipal(id, activeVariantId);
                                if (ok) toast.success("Tela marcada como principal para el costeo");
                                else toast.error("No se pudo marcar la tela como principal");
                                return ok;
                            }}
                            onEdit={(item) =>
                                handleOpenModal("edit_fabric", "Editar costo de tela", fabricEditFields, {
                                    ...item,
                                    meters: formatForInput(item.meters),
                                    price_per_meter: formatForInput(item.price_per_meter),
                                    tiene_iva: item.tiene_iva ? "true" : "false",
                                })
                            }
                            onDelete={async (id) => {
                                const ok = await deleteFabric(id, activeVariantId);
                                if (ok) toast.success("Costo de tela eliminado");
                                else toast.error("No se pudo eliminar el costo de tela");
                            }}
                        />

                        <SuppliesTable
                            data={supplies || []}
                            onAdd={() => {
                                setEditingSupplyData(null);
                                setIsSupplyDialogOpen(true);
                            }}
                            onEdit={(item) => {
                                setEditingSupplyData(item);
                                setIsSupplyDialogOpen(true);
                            }}
                            onDelete={(id) => deleteSupply(id, activeVariantId)}
                        />

                        <LaborCostsTable
                            data={labor || []}
                            onCreateFase={() =>
                                handleOpenModal("new_labor_fase", "Crear fase", [
                                    {
                                        name: "name",
                                        label: "Nombre de la fase",
                                        type: "text",
                                        placeholder: "Ej. Planchado, Empaque...",
                                    },
                                ])
                            }
                            onAdd={() =>
                                handleOpenModal(
                                    "labor",
                                    "Nueva fase de mano de obra",
                                    [
                                        {
                                            name: "fase_id",
                                            label: "Fase",
                                            type: "select",
                                            options: laborPhaseOptions,
                                        },
                                        laborTallaField,
                                        { name: "cantidad", label: "Cantidad", type: "number", placeholder: "1" },
                                        {
                                            name: "unit_price",
                                            label: "Precio unitario",
                                            type: "number",
                                            placeholder: "25000",
                                        },
                                    ],
                                    {
                                        talla_id: "",
                                        cantidad: "1",
                                    }
                                )
                            }
                            onEdit={(item) =>
                                handleOpenModal(
                                    "edit_labor",
                                    "Editar fase de mano de obra",
                                    [
                                        {
                                            name: "fase_id",
                                            label: "Fase",
                                            type: "select",
                                            options: laborPhaseOptions,
                                        },
                                        laborTallaField,
                                        { name: "cantidad", label: "Cantidad", type: "number" },
                                        { name: "unit_price", label: "Precio unitario", type: "number" },
                                    ],
                                    {
                                        ...item,
                                        fase_id: item.fase_id || item.fase,
                                        talla_id: item.talla_id || "",
                                        cantidad: formatForInput(item.cantidad),
                                        unit_price: formatForInput(item.unit_price),
                                    }
                                )
                            }
                            onDelete={(id) => deleteLabor(id, activeVariantId)}
                        />

                        <ExtraCostsTable
                            data={nonCifExtras}
                            onAdd={() =>
                                handleOpenModal(
                                    "extra",
                                    "Nuevo costo extra",
                                    [
                                        {
                                            name: "concepto",
                                            label: "Concepto",
                                            type: "text",
                                            placeholder: "Flete, acabado, diseño…",
                                        },
                                        extraTallaField,
                                        { name: "cantidad", label: "Cantidad", type: "number", placeholder: "1" },
                                        {
                                            name: "unit_price",
                                            label: "Precio unitario",
                                            type: "number",
                                            placeholder: "6",
                                        },
                                    ],
                                    {
                                        talla_id: "",
                                        cantidad: "1",
                                    }
                                )
                            }
                            onEdit={(item) =>
                                handleOpenModal(
                                    "edit_extra",
                                    "Editar costo extra",
                                    [
                                        {
                                            name: "concepto",
                                            label: "Concepto",
                                            type: "text",
                                        },
                                        extraTallaField,
                                        { name: "cantidad", label: "Cantidad", type: "number" },
                                        { name: "unit_price", label: "Precio unitario", type: "number" },
                                    ],
                                    {
                                        ...item,
                                        talla_id: item.talla_id || "",
                                        cantidad: formatForInput(item.cantidad),
                                        unit_price: formatForInput(item.unit_price),
                                    }
                                )
                            }
                            onDelete={(id) => deleteExtra(id, activeVariantId)}
                        />

                        <CIFCard
                            data={cifList}
                            sizes={sizes}
                            onSave={handleSaveCIF}
                            onDelete={handleDeleteCIF}
                        />
                    </>
                )}

                <SupplyFormDialog
                    isOpen={isSupplyDialogOpen}
                    onClose={() => {
                        setIsSupplyDialogOpen(false);
                        setEditingSupplyData(null);
                    }}
                    onSubmit={handleSaveSupplyModal}
                    initialData={editingSupplyData}
                    inventorySupplyRefs={inventorySupplyRefs}
                    sizes={sizes}
                    defaultTallaId=""
                    isEditing={Boolean(editingSupplyData)}
                />

                <ModalForm
                    key={`${modalConfig.type}-${modalConfig.initialData?.id ?? "new"}-${modalConfig.isOpen}`}
                    isOpen={modalConfig.isOpen}
                    title={modalConfig.title}
                    fields={modalConfig.fields}
                    initialData={modalConfig.initialData}
                    onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
                    onSubmit={handleSubmit}
                />

                <AlertDialog
                    open={!!deletingVariant}
                    onOpenChange={(open) => !open && !isDeletingVariant && setDeletingVariant(null)}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar variante?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Se eliminará <strong>{deletingVariant?.name}</strong> (código{" "}
                                {deletingVariant?.code}) junto con su costeo asociado. Esta acción no se
                                puede deshacer.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeletingVariant}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault();
                                    void handleDeleteVariantConfirm();
                                }}
                                disabled={isDeletingVariant}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {isDeletingVariant ? "Eliminando..." : "Eliminar"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </AppLayout>
    );
}
