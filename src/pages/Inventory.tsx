import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetMaterials } from "@/hooks/useGetMaterials";
import { useAddMaterialStock } from "@/hooks/useAddMaterialStock";
import { useCreateMaterial } from "@/hooks/useCreateMaterial";
import { useGetCostCatalogs } from "@/hooks/useGetCostCatalogs";
import { useCreateProveedor } from "@/hooks/useCreateProveedor";
import { useCreateInsumoTipo } from "@/hooks/useCreateInsumoTipo";
import { ProveedorCombobox } from "@/components/ProveedorCombobox";
import { ModalForm } from "@/components/ui/ModalForm";
import { getNewInsumoTipoFields } from "@/lib/insumo-tipo-form";
import { toast } from "sonner";

interface Material {
  id: string;
  name: string;
  category: string;
  supplier: string;
  unit: string;
  stock: number;
  min_stock: number;
  unit_cost: number;
  status: string;
  is_low_stock: boolean;
}

export default function Inventory() {
  const [categoryFilter, setCategoryFilter] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    category: "",
    supplier: "",
    unit: "",
    stock: "",
    min_stock: "",
    unit_cost: "",
  });
  const [createError, setCreateError] = useState("");

  const [isProveedorModalOpen, setIsProveedorModalOpen] = useState(false);
  const [proveedorName, setProveedorName] = useState("");
  const [proveedorError, setProveedorError] = useState("");
  const [isInsumoTipoModalOpen, setIsInsumoTipoModalOpen] = useState(false);

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [newQuantity, setNewQuantity] = useState("");
  const [reference, setReference] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { materials: allMaterials, isLoading: isLoadingAll } = useGetMaterials({});
  const { materials: filteredMaterials, isLoading: isLoadingFiltered, refetch } = useGetMaterials({
    category: categoryFilter,
  });
  const { proveedores, refetchProveedores } = useGetCostCatalogs();
  const { createProveedor, isLoading: isCreatingProveedor } = useCreateProveedor();
  const { createInsumoTipo, isLoading: isCreatingInsumoTipo } = useCreateInsumoTipo();

  const { addStock, isPending: isSubmitting } = useAddMaterialStock();
  const { createMaterial, isPending: isCreating } = useCreateMaterial();
  const newInsumoTipoFields = useMemo(() => getNewInsumoTipoFields(), []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allMaterials.forEach((m) => {
      counts[m.category] = (counts[m.category] || 0) + 1;
    });
    return counts;
  }, [allMaterials]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(allMaterials.map((m) => m.category)));
  }, [allMaterials]);

  const sortedProveedores = useMemo(
    () => [...proveedores].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })),
    [proveedores]
  );

  const handleOpenCreateModal = () => {
    setNewMaterial({
      name: "",
      category: "",
      supplier: "",
      unit: "",
      stock: "",
      min_stock: "",
      unit_cost: "",
    });
    setCreateError("");
    setIsCreateModalOpen(true);
  };

  const handleOpenProveedorModal = () => {
    setProveedorName("");
    setProveedorError("");
    setIsProveedorModalOpen(true);
  };

  const handleCreateInsumoTipo = async (data: Record<string, string>) => {
    const result = await createInsumoTipo({
      name: data.name,
      categoria: data.categoria,
      unidad_medida: data.unidad_medida,
      precio_unitario_default: data.precio_unitario_default
        ? Number(data.precio_unitario_default)
        : null,
      codigo_sku: data.codigo_sku,
      proveedor_marca: data.proveedor_marca,
      color: data.color,
      stock_minimo: data.stock_minimo ? Number(data.stock_minimo) : null,
      stock_inicial: data.stock_inicial ? Number(data.stock_inicial) : null,
    });
    if (result.success) {
      toast.success("Tipo de insumo creado y registrado en inventario");
      setIsInsumoTipoModalOpen(false);
      refetch();
    } else {
      toast.error(result.error || "No se pudo crear el tipo de insumo");
    }
  };

  const handleCreateProveedorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProveedorError("");

    const name = proveedorName.trim();
    if (!name) {
      setProveedorError("Ingresa el nombre del proveedor.");
      return;
    }

    const result = await createProveedor(name);
    if (!result.success) {
      setProveedorError(result.error || "No se pudo crear el proveedor.");
      return;
    }

    await refetchProveedores();
    toast.success("Proveedor creado");
    setIsProveedorModalOpen(false);

    if (result.data?.name) {
      setNewMaterial((prev) => ({ ...prev, supplier: result.data!.name }));
    }
  };

  const handleCreateMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!newMaterial.supplier.trim()) {
      setCreateError("Selecciona un proveedor.");
      return;
    }

    try {
      await createMaterial({
        name: newMaterial.name,
        category: newMaterial.category,
        supplier: newMaterial.supplier,
        unit: newMaterial.unit,
        stock: parseFloat(newMaterial.stock) || 0,
        min_stock: parseFloat(newMaterial.min_stock) || 0,
        unit_cost: parseFloat(newMaterial.unit_cost) || 0,
      });
      setIsCreateModalOpen(false);
      refetch();
    } catch (err: any) {
      setCreateError(err.message || "Error al crear el material");
    }
  };

  const handleOpenAddStock = (material: Material) => {
    setSelectedMaterial(material);
    setNewQuantity("");
    setReference("");
    setErrorMsg("");
    setIsStockModalOpen(true);
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;

    setErrorMsg("");
    try {
      await addStock({
        materialId: selectedMaterial.id,
        quantity: parseFloat(newQuantity),
        reference: reference,
      });
      setIsStockModalOpen(false);
      refetch();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al actualizar stock");
    }
  };

  const formatStock = (value: any) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "0.00";
    return num.toFixed(2);
  };

  const formatCurrency = (value: any) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "0";
    return num.toLocaleString("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const displayMaterials = filteredMaterials;
  const isLoading = isLoadingAll || isLoadingFiltered;

  return (
    <AppLayout title="Inventario" subtitle="Control de materias primas">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">Materiales en stock</CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsInsumoTipoModalOpen(true)}
              className="inline-flex items-center gap-1 px-4 py-1.5 border border-border bg-background hover:bg-muted text-foreground text-sm font-medium rounded-md transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Tipo de insumo
            </button>
            <button
              type="button"
              onClick={handleOpenProveedorModal}
              className="inline-flex items-center gap-1 px-4 py-1.5 border border-border bg-background hover:bg-muted text-foreground text-sm font-medium rounded-md transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Proveedor
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Añadir material
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b">
            <button
              onClick={() => setCategoryFilter("")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                categoryFilter === ""
                  ? "bg-red-600 text-white"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              Todos ({allMaterials.length})
            </button>
            {uniqueCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                  categoryFilter === cat
                    ? "bg-red-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                {cat} ({categoryCounts[cat] || 0})
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando materiales...</div>
          ) : displayMaterials.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No se encontraron materiales.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Costo unit.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayMaterials.map((m) => {
                  const isLow = Boolean(m.is_low_stock);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.category}</TableCell>
                      <TableCell>{m.supplier}</TableCell>
                      <TableCell>{m.unit}</TableCell>
                      <TableCell className="text-right">{formatStock(m.stock)}</TableCell>
                      <TableCell className="text-right">{formatStock(m.min_stock)}</TableCell>
                      <TableCell className="text-right">${formatCurrency(m.unit_cost)}</TableCell>
                      <TableCell>
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" /> Bajo stock
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">OK</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => handleOpenAddStock(m)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
                        >
                          ↑ Añadir
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card text-card-foreground border rounded-lg shadow-lg w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Añadir Nuevo Material</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 hover:bg-muted rounded-md transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMaterialSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  NOMBRE DEL MATERIAL *
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  placeholder="Ej. Tela Oxford Azul"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  CATEGORÍA *
                </label>
                <select
                  required
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={newMaterial.category}
                  onChange={(e) => setNewMaterial({ ...newMaterial, category: e.target.value })}
                >
                  <option value="">Seleccionar categoría</option>
                  <option value="Telas">Telas</option>
                  <option value="Insumos">Insumos</option>
                  <option value="Accesorios">Accesorios</option>
                  <option value="Empaque">Empaque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  PROVEEDOR *
                </label>
                <ProveedorCombobox
                  value={newMaterial.supplier}
                  proveedores={sortedProveedores}
                  onChange={(name) => setNewMaterial({ ...newMaterial, supplier: name })}
                  placeholder="Buscar o seleccionar proveedor..."
                />
                {sortedProveedores.length === 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    No hay proveedores. Usa el botón <strong>+ Proveedor</strong> para crear uno.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  UNIDAD *
                </label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  placeholder="Ej. metros, conos, piezas"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={newMaterial.unit}
                  onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    STOCK INICIAL
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                    value={newMaterial.stock}
                    onChange={(e) => setNewMaterial({ ...newMaterial, stock: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    STOCK MÍNIMO
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                    value={newMaterial.min_stock}
                    onChange={(e) => setNewMaterial({ ...newMaterial, min_stock: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    COSTO UNIT.
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                    value={newMaterial.unit_cost}
                    onChange={(e) => setNewMaterial({ ...newMaterial, unit_cost: e.target.value })}
                  />
                </div>
              </div>

              {createError && (
                <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isCreating}
                  className="px-4 py-2 border rounded text-sm hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating || sortedProveedores.length === 0}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-sm transition-colors disabled:opacity-55"
                >
                  {isCreating ? "Creando..." : "Crear Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isProveedorModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card text-card-foreground border rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Nuevo proveedor</h3>
              <button
                onClick={() => setIsProveedorModalOpen(false)}
                className="p-1 hover:bg-muted rounded-md transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProveedorSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  NOMBRE DEL PROVEEDOR *
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  placeholder="Ej. Textiles del Caribe"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={proveedorName}
                  onChange={(e) => setProveedorName(e.target.value)}
                />
              </div>

              {proveedorError && (
                <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded">
                  {proveedorError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProveedorModalOpen(false)}
                  disabled={isCreatingProveedor}
                  className="px-4 py-2 border rounded text-sm hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProveedor}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-sm transition-colors disabled:opacity-55"
                >
                  {isCreatingProveedor ? "Creando..." : "Crear proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ModalForm
        isOpen={isInsumoTipoModalOpen}
        onClose={() => setIsInsumoTipoModalOpen(false)}
        title="Nuevo tipo de insumo"
        fields={newInsumoTipoFields}
        onSubmit={handleCreateInsumoTipo}
        isLoading={isCreatingInsumoTipo}
      />

      {isStockModalOpen && selectedMaterial && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card text-card-foreground border rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Añadir Stock</h3>
              <button
                onClick={() => setIsStockModalOpen(false)}
                className="p-1 hover:bg-muted rounded-md transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Añadiendo stock para: <strong className="text-foreground">{selectedMaterial.name}</strong> ({selectedMaterial.unit})
            </p>

            <form onSubmit={handleAddStockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">CANTIDAD A INCLUIR *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">REFERENCIA DE COMPRA O PEDIDO *</label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  placeholder="Ej. Factura #1034 o Lote 23B"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>

              {errorMsg && (
                <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded">
                  {errorMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border rounded text-sm hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-sm transition-colors disabled:opacity-55"
                >
                  {isSubmitting ? "Actualizando..." : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
