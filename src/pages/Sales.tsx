import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Receipt, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { TNSFacturasTab } from "@/components/inventory/TNSFacturasTab";
import { TNSVentasDetalladasTab } from "@/components/inventory/TNSVentasDetalladasTab";

export default function Sales() {
  const [activeTab, setActiveTab] = useState<"facturas" | "ventas-detalladas">("facturas");

  return (
    <AppLayout
      title="Ventas TNS"
      subtitle={
        activeTab === "facturas"
          ? "Consulta de facturas de venta fiscales, CUFE, estado DIAN, clientes y desglose de artículos en TNS."
          : "Reporte detallado y transaccional de ventas, clientes, roles y comprobantes sincronizados desde TNS."
      }
      eyebrow="Comercial"
    >
      <div className="space-y-6">
        {/* Selector de Pestañas del Módulo Ventas */}
        <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("facturas")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all rounded-t-lg shrink-0",
              activeTab === "facturas"
                ? "border-red-600 text-red-600 dark:text-red-500 bg-red-50/30 dark:bg-red-950/20"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <Receipt className="h-4 w-4" />
            <span>Facturas de Ventas TNS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ventas-detalladas")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all rounded-t-lg shrink-0",
              activeTab === "ventas-detalladas"
                ? "border-red-600 text-red-600 dark:text-red-500 bg-red-50/30 dark:bg-red-950/20"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Ventas Detalladas TNS</span>
          </button>
        </div>

        {/* Contenido de la pestaña activa */}
        {activeTab === "facturas" && <TNSFacturasTab />}
        {activeTab === "ventas-detalladas" && <TNSVentasDetalladasTab />}
      </div>
    </AppLayout>
  );
}
