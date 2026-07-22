import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetMaterials } from "@/hooks/useGetMaterials";
import { useAddMaterialStock } from "@/hooks/useAddMaterialStock";
import { useCreateMaterial } from "@/hooks/useCreateMaterial";

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

  // Estado para modal de crear material
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

  // Estado para modal de añadir stock
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [newQuantity, setNewQuantity] = useState("");
  const [reference, setReference] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Obtener TODOS los materiales (sin filtro) para las categorías
  const { materials: allMaterials, isLoading: isLoadingAll } = useGetMaterials({});

  // Obtener materiales filtrados por categoría
  const { materials: filteredMaterials, isLoading: isLoadingFiltered, refetch } = useGetMaterials({
    category: categoryFilter,
  });

  const { addStock, isPending: isSubmitting } = useAddMaterialStock();
  const { createMaterial, isPending: isCreating } = useCreateMaterial();

  // Calcular conteo por categoría usando TODOS los materiales
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allMaterials.forEach((m) => {
      counts[m.category] = (counts[m.category] || 0) + 1;
    });
    return counts;
  }, [allMaterials]);

  // Obtener categorías únicas de TODOS los materiales
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(allMaterials.map((m) => m.category)));
  }, [allMaterials]);

  // Manejadores para crear material
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

  const handleCreateMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

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

  // Manejadores para añadir stock
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

  // Formatear números de forma segura
  const formatStock = (value: any) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    return num.toFixed(2);
  };

  const formatCurrency = (value: any) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Usar filteredMaterials para la tabla, y allMaterials para los filtros
  const displayMaterials = filteredMaterials;
  const isLoading = isLoadingAll || isLoadingFiltered;

  return (
    <AppLayout title="Inventario" subtitle="Control de materias primas">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Materiales en stock</CardTitle>
          {/* Botón "Añadir material" en ROJO */}
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Añadir material
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {/* Filtros de categoría - Pills - SIEMPRE VISIBLES */}
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

          {/* Tabla de Materiales */}
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando materiales...</div>
          ) : displayMaterials.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No se encontraron materiales.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
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
                {displayMaterials.map((m, index) => {
                  const displayId = `M-${String(index + 1).padStart(3, '0')}`;

                  return (
                    <TableRow key={m.id} className={cn(m.is_low_stock && "bg-destructive/5")}>
                      <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                        {displayId}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">{m.name}</TableCell>
                      <TableCell className="text-muted-foreground">{m.category}</TableCell>
                      <TableCell className="text-muted-foreground">{m.supplier}</TableCell>
                      <TableCell className="text-muted-foreground">{m.unit}</TableCell>
                      <TableCell className="text-right font-medium text-foreground">
                        {formatStock(m.stock)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatStock(m.min_stock)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${formatCurrency(m.unit_cost)}
                      </TableCell>
                      <TableCell>
                        {m.is_low_stock ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 rounded-full px-2.5 py-0.5">
                            <AlertTriangle className="h-3 w-3" /> Stock bajo
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-green-700 bg-green-100 rounded-full px-2.5 py-0.5">
                            Óptimo
                          </span>
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

      {/* Modal para Crear Material */}
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
                <input
                  type="text"
                  required
                  maxLength={255}
                  placeholder="Ej. Textiles del Caribe"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={newMaterial.supplier}
                  onChange={(e) => setNewMaterial({ ...newMaterial, supplier: e.target.value })}
                />
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
                  disabled={isCreating}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-sm transition-colors disabled:opacity-55"
                >
                  {isCreating ? "Creando..." : "Crear Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Añadir Stock */}
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