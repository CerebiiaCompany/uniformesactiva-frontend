import type { FieldDefinition } from "@/components/ui/ModalForm";

export const INSUMO_CATEGORIA_OPTIONS = [
    { value: "Botonería", label: "Botonería" },
    { value: "Cierres/Cremalleras", label: "Cierres/Cremalleras" },
    { value: "Hilos", label: "Hilos" },
    { value: "Marroquinería/Herrajes", label: "Marroquinería/Herrajes" },
    { value: "Etiquetas/Empaque", label: "Etiquetas/Empaque" },
    { value: "Interlon/Entretelas", label: "Interlon/Entretelas" },
    { value: "Otros", label: "Otros" },
];

export const UNIDAD_MEDIDA_OPTIONS = [
    { value: "Unidad", label: "Unidad (piezas/botones)" },
    { value: "Metros", label: "Metros" },
    { value: "Conos", label: "Conos" },
    { value: "Yardas", label: "Yardas" },
    { value: "Centímetros cuadrados", label: "Centímetros cuadrados" },
    { value: "Pliegos", label: "Pliegos" },
    { value: "Gramos", label: "Gramos" },
    { value: "Kilos", label: "Kilos" },
];

/** Campos compartidos del formulario "Tipo de insumo" (Líneas + Inventario) */
export function getNewInsumoTipoFields(): FieldDefinition[] {
    return [
        {
            name: "name",
            label: "Nombre del insumo *",
            type: "text",
            placeholder: "Ej. Botón de pasta",
        },
        {
            name: "categoria",
            label: "Categoría / Clasificación *",
            type: "select",
            options: INSUMO_CATEGORIA_OPTIONS,
        },
        {
            name: "unidad_medida",
            label: "Unidad de medida *",
            type: "select",
            options: UNIDAD_MEDIDA_OPTIONS,
        },
        {
            name: "stock_inicial",
            label: "Stock inicial",
            type: "number",
            placeholder: "0.00",
            defaultValue: "0",
            required: false,
            row: "stock-row",
        },
        {
            name: "stock_minimo",
            label: "Stock mínimo",
            type: "number",
            placeholder: "0.00",
            defaultValue: "0",
            required: false,
            row: "stock-row",
        },
        {
            name: "precio_unitario_default",
            label: "Costo unit.",
            type: "number",
            placeholder: "0.00",
            defaultValue: "0",
            required: false,
            row: "stock-row",
        },
        {
            name: "codigo_sku",
            label: "Código SKU / Referencia",
            type: "text",
            placeholder: "Ej. INS-BOT-001",
            required: false,
        },
        {
            name: "proveedor_marca",
            label: "Proveedor / Marca habitual",
            type: "text",
            placeholder: "Ej. YKK, Coats Cadena",
            required: false,
        },
        {
            name: "color",
            label: "Color / Tono",
            type: "text",
            placeholder: "Ej. Negro, Níquel",
            required: false,
        },
    ];
}
