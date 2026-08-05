import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { AlertTriangle, History, PackageX, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetMaterials } from "@/hooks/useGetMaterials";
import { useCreateMaterial } from "@/hooks/useCreateMaterial";
import { useUpdateMaterial } from "@/hooks/useUpdateMaterial";
import { useGetCostCatalogs } from "@/hooks/useGetCostCatalogs";
import { useCreateProveedor } from "@/hooks/useCreateProveedor";
import { useDeleteProveedor } from "@/hooks/useDeleteProveedor";
import { useCreateInsumoTipo } from "@/hooks/useCreateInsumoTipo";
import { ProveedorCombobox } from "@/components/ProveedorCombobox";
import { MaterialSuppliersDialog } from "@/components/MaterialSuppliersDialog";
import { AddMaterialStockDialog } from "@/components/AddMaterialStockDialog";
import { MaterialMovementsDialog } from "@/components/MaterialMovementsDialog";
import { ModalForm } from "@/components/ui/ModalForm";
import { InventoryOverview, classifyMaterialStock } from "@/components/inventory/InventoryOverview";
import { getNewInsumoTipoFields, UNIDAD_MEDIDA_OPTIONS } from "@/lib/insumo-tipo-form";
import { formatUnitCost } from "@/lib/format-number";
import { toast } from "sonner";

interface Material {
  id: string;
  name: string;
  category: string;
  color?: string;
  supplier: string;
  unit: string;
  stock: number;
  min_stock: number;
  unit_cost: number;
  status: string;
  is_low_stock: boolean;
  suppliers_count?: number;
}

const EMPTY_MATERIAL_FORM = {
  name: "",
  category: "",
  color: "",
  supplier: "",
  unit: "",
  stock: "",
  min_stock: "",
  unit_cost: "",
};

export default function Inventory() {
  const [categoryFilter, setCategoryFilter] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState(EMPTY_MATERIAL_FORM);
  const [createError, setCreateError] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editMaterial, setEditMaterial] = useState({
    name: "",
    category: "",
    color: "",
    supplier: "",
    unit: "",
    min_stock: "",
    unit_cost: "",
  });
  const [editError, setEditError] = useState("");

  const [isProveedorModalOpen, setIsProveedorModalOpen] = useState(false);
  const [proveedorName, setProveedorName] = useState("");
  const [proveedorError, setProveedorError] = useState("");
  const [deletingProveedor, setDeletingProveedor] = useState<{ id: string; name: string } | null>(
    null
  );
  const [isInsumoTipoModalOpen, setIsInsumoTipoModalOpen] = useState(false);

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [suppliersMaterial, setSuppliersMaterial] = useState<Material | null>(null);
  const [historyMaterial, setHistoryMaterial] = useState<Material | null>(null);

  const { materials: allMaterials, isLoading: isLoadingAll } = useGetMaterials({});
  const { materials: filteredMaterials, isLoading: isLoadingFiltered, refetch } = useGetMaterials({
    category: categoryFilter,
  });
  const { proveedores, refetchProveedores } = useGetCostCatalogs();
  const { createProveedor, isLoading: isCreatingProveedor } = useCreateProveedor();
  const { deleteProveedor, isLoading: isDeletingProveedor } = useDeleteProveedor();
  const { createInsumoTipo, isLoading: isCreatingInsumoTipo } = useCreateInsumoTipo();

  const { createMaterial, isPending: isCreating } = useCreateMaterial();
  const { updateMaterial, isPending: isUpdating } = useUpdateMaterial();
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
    setNewMaterial({ ...EMPTY_MATERIAL_FORM });
    setCreateError("");
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (material: Material) => {
    setEditingMaterial(material);
    setEditMaterial({
      name: material.name,
      category: material.category,
      color: material.color || "",
      supplier: material.supplier,
      unit: material.unit,
      min_stock: String(material.min_stock ?? ""),
      unit_cost: String(material.unit_cost ?? ""),
    });
    setEditError("");
    setIsEditModalOpen(true);
  };

  const ensureProveedorInCatalog = async (name: string): Promise<string> => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Ingresa el nombre del proveedor.");

    const exists = sortedProveedores.some(
      (p) => p.name.toLocaleLowerCase("es") === trimmed.toLocaleLowerCase("es")
    );
    if (exists) {
      return (
        sortedProveedores.find(
          (p) => p.name.toLocaleLowerCase("es") === trimmed.toLocaleLowerCase("es")
        )?.name ?? trimmed
      );
    }

    const result = await createProveedor(trimmed);
    if (!result.success) {
      throw new Error(result.error || "No se pudo crear el proveedor.");
    }
    await refetchProveedores();
    toast.success(`Proveedor «${result.data?.name || trimmed}» creado`);
    return result.data?.name?.trim() || trimmed;
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
      if (isEditModalOpen) {
        setEditMaterial((prev) => ({ ...prev, supplier: result.data!.name }));
      } else {
        setNewMaterial((prev) => ({ ...prev, supplier: result.data!.name }));
      }
    }
  };

  const handleDeleteProveedorConfirm = async () => {
    if (!deletingProveedor) return;
    const result = await deleteProveedor(deletingProveedor.id);
    if (!result.success) {
      toast.error(result.error || "No se pudo eliminar el proveedor");
      return;
    }
    toast.success(`Proveedor «${deletingProveedor.name}» eliminado`);
    setDeletingProveedor(null);
    await refetchProveedores();
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
        color: newMaterial.color.trim(),
        supplier: newMaterial.supplier,
        unit: newMaterial.unit,
        stock: parseFloat(newMaterial.stock) || 0,
        min_stock: parseFloat(newMaterial.min_stock) || 0,
        unit_cost: parseFloat(newMaterial.unit_cost) || 0,
      });
      setIsCreateModalOpen(false);
      toast.success("Material creado");
      refetch();
    } catch (err: any) {
      setCreateError(err.message || "Error al crear el material");
    }
  };

  const handleEditMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;
    setEditError("");

    if (!editMaterial.supplier.trim()) {
      setEditError("Selecciona un proveedor.");
      return;
    }

    try {
      await updateMaterial({
        materialId: editingMaterial.id,
        payload: {
          name: editMaterial.name.trim(),
          category: editMaterial.category,
          color: editMaterial.color.trim(),
          supplier: editMaterial.supplier.trim(),
          unit: editMaterial.unit.trim(),
          min_stock: parseFloat(editMaterial.min_stock) || 0,
          unit_cost: parseFloat(editMaterial.unit_cost) || 0,
        },
      });
      setIsEditModalOpen(false);
      toast.success("Material actualizado");
      refetch();
    } catch (err: any) {
      setEditError(err.message || "Error al actualizar el material");
    }
  };

  const handleOpenAddStock = (material: Material) => {
    setSelectedMaterial(material);
    setIsStockModalOpen(true);
  };

  const formatStock = (value: any) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "0.00";
    return num.toFixed(2);
  };

  const displayMaterials = filteredMaterials;
  const isLoading = isLoadingAll || isLoadingFiltered;

  return (
    <AppLayout
      title="Inventario"
      subtitle="Insumos y telas (por referencia). El stock se descuenta al pasar una orden a producción."
      eyebrow="Operación"
    >
      <div className="space-y-6">
        <InventoryOverview materials={allMaterials} isLoading={isLoadingAll} />

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold tracking-tight">Materiales en stock</CardTitle>
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
                  <TableHead>Color</TableHead>
                  <TableHead>Proveedores</TableHead>
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
                  const stockState = classifyMaterialStock(m);
                  const isLow = stockState === "low";
                  const isOut = stockState === "out";
                  const isAlert = isLow || isOut;

                  return (
                    <TableRow
                      key={m.id}
                      className={cn(
                        isLow && "bg-red-50/90 hover:bg-red-50",
                        isOut && "bg-zinc-50 hover:bg-zinc-100/80"
                      )}
                    >
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {m.category}
                        </span>
                      </TableCell>
                      <TableCell>{m.color?.trim() ? m.color : "—"}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSuppliersMaterial(m)}
                          className="text-left text-red-700 hover:text-red-800 hover:underline font-medium"
                          title="Ver y comparar proveedores"
                        >
                          {(() => {
                            const count =
                              typeof m.suppliers_count === "number"
                                ? m.suppliers_count
                                : m.supplier
                                  ? 1
                                  : 0;
                            return count === 1
                              ? "1 proveedor"
                              : `${count} proveedores`;
                          })()}
                        </button>
                      </TableCell>
                      <TableCell>{m.unit}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          isLow && "text-red-600",
                          isOut && "text-zinc-500",
                          !isAlert && "text-foreground"
                        )}
                      >
                        {formatStock(m.stock)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatStock(m.min_stock)}</TableCell>
                      <TableCell className="text-right tabular-nums">${formatUnitCost(m.unit_cost)}</TableCell>
                      <TableCell>
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                            <PackageX className="h-3.5 w-3.5" />
                            Agotado
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Stock bajo
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Óptimo
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(m)}
                            className="inline-flex items-center gap-1 px-3 py-1 border border-border bg-background hover:bg-muted text-foreground text-xs font-medium rounded transition-colors"
                          >
                            <Pencil className="h-3 w-3" /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAddStock(m)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
                          >
                            ↑ Añadir
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoryMaterial(m)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-border bg-background hover:bg-muted text-foreground text-xs font-medium rounded transition-colors"
                            title="Historial de movimientos"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight">Proveedores</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Catálogo de proveedores disponibles al registrar materiales y costos.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenProveedorModal}
            className="inline-flex items-center gap-1 px-4 py-1.5 border border-border bg-background hover:bg-muted text-foreground text-sm font-medium rounded-md transition-colors shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" /> Proveedor
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {sortedProveedores.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No hay proveedores registrados. Usa <strong>+ Proveedor</strong> para crear uno.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right w-[120px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProveedores.map((prov) => (
                  <TableRow key={prov.id}>
                    <TableCell className="font-medium">{prov.name}</TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => setDeletingProveedor({ id: prov.id, name: prov.name })}
                        disabled={isDeletingProveedor}
                        className="inline-flex items-center gap-1 px-3 py-1 border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-medium rounded transition-colors disabled:opacity-50"
                        title="Eliminar proveedor"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>

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
                  <option value="Accesorios">Accesorios</option>
                  <option value="Empaque">Empaque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  COLOR
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="Ej. Azul navy"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={newMaterial.color}
                  onChange={(e) => setNewMaterial({ ...newMaterial, color: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  PROVEEDOR *
                </label>
                <ProveedorCombobox
                  value={newMaterial.supplier}
                  proveedores={sortedProveedores}
                  onChange={(name) => setNewMaterial({ ...newMaterial, supplier: name })}
                  placeholder="Buscar o crear proveedor..."
                  allowCreate
                  onCreateNew={ensureProveedorInCatalog}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Busca un proveedor existente o escribe uno nuevo y elige{" "}
                  <strong>Crear «…»</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  UNIDAD *
                </label>
                <select
                  required
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={newMaterial.unit}
                  onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                >
                  <option value="">Seleccionar unidad</option>
                  {UNIDAD_MEDIDA_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
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
                  disabled={isCreating || isCreatingProveedor}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-sm transition-colors disabled:opacity-55"
                >
                  {isCreating ? "Creando..." : "Crear Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && editingMaterial && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card text-card-foreground border rounded-lg shadow-lg w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Editar material</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 hover:bg-muted rounded-md transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Stock actual: <strong className="text-foreground">{formatStock(editingMaterial.stock)}</strong>{" "}
              {editingMaterial.unit}. Usa <strong>Añadir</strong> para ingresar stock.
            </p>

            <form onSubmit={handleEditMaterialSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  NOMBRE DEL MATERIAL *
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={editMaterial.name}
                  onChange={(e) => setEditMaterial({ ...editMaterial, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  CATEGORÍA *
                </label>
                <select
                  required
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={editMaterial.category}
                  onChange={(e) => setEditMaterial({ ...editMaterial, category: e.target.value })}
                >
                  <option value="">Seleccionar categoría</option>
                  {Array.from(
                    new Set([
                      "Telas",
                      "Accesorios",
                      "Empaque",
                      ...uniqueCategories.filter((cat) => cat !== "Insumos"),
                      // Conservar categoría actual si el material ya era "Insumos"
                      editMaterial.category,
                    ].filter(Boolean))
                  ).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  COLOR
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="Ej. Azul navy"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={editMaterial.color}
                  onChange={(e) => setEditMaterial({ ...editMaterial, color: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  PROVEEDOR *
                </label>
                <ProveedorCombobox
                  value={editMaterial.supplier}
                  proveedores={sortedProveedores}
                  onChange={(name) => setEditMaterial({ ...editMaterial, supplier: name })}
                  placeholder="Buscar o crear proveedor..."
                  allowCreate
                  onCreateNew={ensureProveedorInCatalog}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Busca un proveedor existente o escribe uno nuevo y elige{" "}
                  <strong>Crear «…»</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  UNIDAD *
                </label>
                <select
                  required
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 bg-background text-foreground"
                  value={editMaterial.unit}
                  onChange={(e) => setEditMaterial({ ...editMaterial, unit: e.target.value })}
                >
                  <option value="">Seleccionar unidad</option>
                  {UNIDAD_MEDIDA_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  {editMaterial.unit &&
                    !UNIDAD_MEDIDA_OPTIONS.some((opt) => opt.value === editMaterial.unit) && (
                      <option value={editMaterial.unit}>{editMaterial.unit}</option>
                    )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    value={editMaterial.min_stock}
                    onChange={(e) => setEditMaterial({ ...editMaterial, min_stock: e.target.value })}
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
                    value={editMaterial.unit_cost}
                    onChange={(e) => setEditMaterial({ ...editMaterial, unit_cost: e.target.value })}
                  />
                </div>
              </div>

              {editError && (
                <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded">
                  {editError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isUpdating}
                  className="px-4 py-2 border rounded text-sm hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-sm transition-colors disabled:opacity-55"
                >
                  {isUpdating ? "Guardando..." : "Guardar cambios"}
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

      <MaterialSuppliersDialog
        open={!!suppliersMaterial}
        materialId={suppliersMaterial?.id ?? null}
        materialName={suppliersMaterial?.name}
        onClose={() => {
          setSuppliersMaterial(null);
          refetch();
        }}
        proveedores={sortedProveedores}
        onProveedoresChange={refetchProveedores}
      />

      <AddMaterialStockDialog
        open={isStockModalOpen}
        material={selectedMaterial}
        onClose={() => {
          setIsStockModalOpen(false);
          setSelectedMaterial(null);
        }}
        onSuccess={() => refetch()}
      />

      <MaterialMovementsDialog
        open={!!historyMaterial}
        material={historyMaterial}
        onClose={() => setHistoryMaterial(null)}
      />

      <AlertDialog
        open={!!deletingProveedor}
        onOpenChange={(open) => !open && !isDeletingProveedor && setDeletingProveedor(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deletingProveedor?.name}</strong> del catálogo. Los
              materiales que ya lo tengan como texto conservarán el nombre; en costos de tela
              el vínculo quedará vacío. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingProveedor}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteProveedorConfirm();
              }}
              disabled={isDeletingProveedor}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingProveedor ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
