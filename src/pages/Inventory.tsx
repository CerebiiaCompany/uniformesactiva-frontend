import { AppLayout } from "@/components/AppLayout";
import { TNSInventarioTab } from "@/components/inventory/TNSInventarioTab";

export default function Inventory() {
  return (
    <AppLayout
      title="Inventario TNS"
      subtitle="Consulta en tiempo real del inventario transaccional de materiales y productos sincronizados con el ERP TNS."
      eyebrow="Operación"
    >
      <div className="space-y-6">
        <TNSInventarioTab />
      </div>
    </AppLayout>
  );
}


