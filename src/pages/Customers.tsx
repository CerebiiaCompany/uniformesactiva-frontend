import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, Building2, ShieldAlert, MapPin, Loader2, ChevronLeft, ChevronRight, Search, X, ClipboardList, Pencil, Trash2 } from "lucide-react";  // <-- NUEVOS ICONOS
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

import { Input } from "@/components/ui/input";

import { useCreateClient } from "@/hooks/useCreateClient";
import { useGetClients } from "@/hooks/useGetClients";
import { useGetClientDetail } from "@/hooks/useGetClientDetail";
import { useUpdateClient } from "@/hooks/useUpdateClient";
import { useDeleteClient } from "@/hooks/useDeleteClient";

export default function Customers() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    tipo_cliente: "Natural",
  });
  const [deletingClient, setDeletingClient] = useState<any | null>(null);

  const { clients, isLoading: isReading, refetch, pagination, filters } = useGetClients();
  const { createClient, isLoading: isCreating, error: apiError } = useCreateClient();
  const { client: clientDetail, isLoading: isReadingDetail, error: detailError } = useGetClientDetail(selectedClientId);

  const { updateClient, isLoading: isUpdating, error: updateError } = useUpdateClient();
  const { deleteClient, isLoading: isDeleting } = useDeleteClient();

  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    nit: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    tipo_cliente: "Natural",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    filters.update({ search: searchTerm.trim() });
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    filters.update({ search: "" });
  };

  const handleCardClick = (id: string) => {
    setSelectedClientId(id);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedClientId(null);
  };
  const openEditModal = (client: any) => {
    setEditingClient(client);
    setEditFormData({
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      tipo_cliente: client.tipo_cliente || "Natural",
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingClient(null);
    setEditFormData({ name: "", email: "", phone: "", address: "", city: "", tipo_cliente: "Natural" });
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    const result = await updateClient(editingClient.id, editFormData);

    if (result.success) {
      toast.success("¡Cliente actualizado exitosamente!", {
        description: `El cliente ${editFormData.name} ha sido modificado.`,
      });
      closeEditModal();
      refetch();
    } else {
      toast.error("Error al actualizar cliente", {
        description: result.error || "Revisa los campos del formulario.",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingClient) return;

    const result = await deleteClient(deletingClient.id);

    if (result.success) {
      toast.success("¡Cliente eliminado exitosamente!", {
        description: `El cliente ${deletingClient.name} ha sido desactivado del sistema.`,
      });
      setDeletingClient(null);
      refetch();
    } else {
      toast.error("Error al eliminar cliente", {
        description: result.error || "No se pudo completar la eliminación.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createClient(formData);

    if (result.success) {
      toast.success("¡Cliente registrado exitosamente!", {
        description: `El cliente ${formData.name} ha sido guardado en la base de datos.`,
      });
      setFormData({ nit: "", name: "", email: "", phone: "", address: "", city: "", tipo_cliente: "Natural" });
      setIsModalOpen(false);
      refetch();
    } else {
      toast.error("Error al registrar cliente", {
        description: "Revisa los campos de validación del formulario.",
      });
    }
  };

  const hasActiveFilters = Boolean((filters.current.search || "").trim());

  return (
    <AppLayout title="Clientes" subtitle="CRM y gestión de clientes" eyebrow="Comercial">
      <div className="space-y-4">
        {/* Barra superior de acciones */}
        <div className="flex justify-end">
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Nuevo cliente
          </Button>
        </div>

        {/* Filtro único: nombre, NIT, correo o teléfono */}
        <form
          onSubmit={handleApplyFilters}
          className="bg-card border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
        >
          <div className="flex-1 min-w-0">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Buscar cliente
            </label>
            <Input
              type="text"
              className="h-9 text-xs"
              placeholder="Nombre, NIT, correo o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button type="submit" size="sm" className="h-9 px-3" title="Buscar">
              <Search className="h-3.5 w-3.5" />
            </Button>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 border-dashed"
                onClick={handleClearFilters}
                title="Limpiar filtros"
              >
                <X className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        </form>

        {isReading ? (
          <div className="flex flex-col items-center justify-center pt-12 space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Sincronizando clientes con el servidor...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 border rounded-xl bg-card border-dashed">
            <p className="text-sm font-medium text-muted-foreground">
              {hasActiveFilters
                ? "No se encontraron clientes que coincidan con los criterios de búsqueda."
                : "No hay clientes registrados en la base de datos."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((customer) => (
                <Card
                  key={customer.id}
                  className="hover:shadow-md transition-shadow cursor-pointer animate-fade-in"
                  onClick={() => handleCardClick(customer.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {customer.name ? customer.name.split(" ").map((n) => n[0]).join("").toUpperCase() : "CL"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate" title={customer.name}>
                          {customer.name}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 flex-shrink-0" /> NIT: {customer.nit}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${customer.status === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                        }`}>
                        {customer.status === "active" ? "Activo" : "Inactivo"}
                      </span>
                    </div>

                    <div className="space-y-1.5 mb-4 border-b border-border/50 pb-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                        <Mail className="h-3 w-3 flex-shrink-0" /> {customer.email}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3 w-3 flex-shrink-0" /> {customer.phone}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                        <MapPin className="h-3 w-3 flex-shrink-0" /> {customer.address}, {customer.city}
                      </p>
                    </div>

                    {/* <-- SECCIÓN MODIFICADA: TIPO DE CLIENTE + BOTONES DE ACCIÓN */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
                      <div>
                        <span className="block text-[10px] text-muted-foreground/80">Tipo de Cliente</span>
                        <span className="font-semibold text-foreground text-[11px]">
                          {customer.tipo_cliente === "Juridico" ? "Persona Jurídica" : "Persona Natural"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Editar cliente"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(customer);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Eliminar cliente"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingClient(customer);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Control de Paginación */}
            <div className="flex items-center justify-between border-t border-border/60 pt-4 px-1 text-sm text-muted-foreground">
              <div>
                Total de clientes: <span className="font-medium text-foreground">{pagination.totalCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs mr-2">
                  Página <span className="font-medium text-foreground">{pagination.page}</span>
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={pagination.prevPage}
                  disabled={!pagination.hasPrevious}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={pagination.nextPage}
                  disabled={!pagination.hasNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL DETALLE DE CLIENTE (HISTORIAL DE ORDENES SIMULADO) ── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-lg bg-background p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" /> Detalle del Cliente comercial
            </DialogTitle>
            <DialogDescription>
              Consulta la información centralizada y el historial de pedidos de este cliente en FlowTextil.
            </DialogDescription>
          </DialogHeader>

          {isReadingDetail ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Consultando información del cliente...</p>
            </div>
          ) : detailError ? (
            <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md flex items-center gap-2 border border-destructive/20">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span>{detailError}</span>
            </div>
          ) : clientDetail ? (
            <div className="space-y-5 mt-2 animate-fade-in">
              {/* Bloque de Información Primaria */}
              <div className="bg-muted/40 rounded-xl p-4 border grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                <div className="col-span-2 border-b pb-1.5 mb-1 font-semibold text-foreground text-sm flex justify-between items-center">
                  <span>{clientDetail.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${clientDetail.status === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                    {clientDetail.status === "active" ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-medium">NIT</span>
                  <span className="text-foreground font-medium">{clientDetail.nit}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-medium">Teléfono</span>
                  <span className="text-foreground font-medium">{clientDetail.phone}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block font-medium">Correo Electrónico</span>
                  <span className="text-foreground font-medium truncate block">{clientDetail.email}</span>
                </div>
                {/* <-- NUEVO CAMPO TIPO DE CLIENTE EN EL DETALLE */}
                <div className="col-span-2">
                  <span className="text-muted-foreground block font-medium">Tipo de Cliente</span>
                  <span className="text-foreground font-medium">
                    {clientDetail.tipo_cliente === "Juridico" ? "Persona Jurídica" : "Persona Natural"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block font-medium">Ubicación</span>
                  <span className="text-foreground font-medium">{clientDetail.address}, {clientDetail.city}</span>
                </div>
              </div>

              {/* Bloque de Historial de Órdenes */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Historial de Órdenes / Pedidos</h4>

                {clientDetail.orders && clientDetail.orders.length === 0 ? (
                  <div className="text-center py-8 border rounded-xl bg-muted/20 border-dashed">
                    <p className="text-xs text-muted-foreground font-medium">
                      Este cliente no registra órdenes de compra creadas en el sistema actualmente.
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Órdenes detectadas.
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={handleCloseDetail}>
                  Cerrar Ventana
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── MODAL DE REGISTRO (CREACIÓN) ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md bg-background p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Registrar Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Introduce la información requerida. El backend aplicará las validaciones estrictas de negocio.
            </DialogDescription>
          </DialogHeader>

          {apiError && (
            <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md flex items-center gap-2 border border-destructive/20 animate-fade-in">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">NIT (Solo números)</label>
              <Input
                name="nit"
                type="text"
                pattern="[0-9]+"
                title="El NIT debe contener únicamente números"
                placeholder="Ej: 901234567"
                required
                disabled={isCreating}
                value={formData.nit}
                onChange={handleInputChange}
              />
            </div>

            {/* <-- NUEVO CAMPO TIPO DE CLIENTE EN REGISTRO */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Tipo de Cliente</label>
              <select
                name="tipo_cliente"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                required
                disabled={isCreating}
                value={formData.tipo_cliente}
                onChange={handleInputChange}
              >
                <option value="Natural">Persona Natural</option>
                <option value="Juridico">Persona Jurídica</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Nombre / Razón Social</label>
              <Input
                name="name"
                type="text"
                placeholder="Ej: Distribuidora Activa S.A.S."
                required
                disabled={isCreating}
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Correo Electrónico</label>
              <Input
                name="email"
                type="text"
                placeholder="Ej: contacto@empresa.com"
                required
                disabled={isCreating}
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Teléfono</label>
              <Input
                name="phone"
                type="text"
                placeholder="Ej: 3151234567"
                required
                disabled={isCreating}
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Dirección</label>
                <Input
                  name="address"
                  type="text"
                  placeholder="Ej: Calle 10 #4-20"
                  required
                  disabled={isCreating}
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Ciudad</label>
                <Input
                  name="city"
                  type="text"
                  placeholder="Ej: Cúcuta"
                  required
                  disabled={isCreating}
                  value={formData.city}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isCreating}
              >
                {isCreating ? "Guardando..." : "Guardar Cliente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── NUEVO MODAL DE EDICIÓN ── */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => !open && closeEditModal()}>
        <DialogContent className="sm:max-w-md bg-background p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Editar Cliente</DialogTitle>
            <DialogDescription>
              Modifica la información del cliente. Se aplicarán las validaciones de negocio correspondientes.
            </DialogDescription>
          </DialogHeader>

          {updateError && (
            <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md flex items-center gap-2 border border-destructive/20 animate-fade-in">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span>{updateError}</span>
            </div>
          )}

          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">NIT (No editable)</label>
              <Input
                name="nit"
                type="text"
                disabled
                value={editingClient?.nit || ""}
              />
            </div>

            {/* <-- NUEVO CAMPO TIPO DE CLIENTE EN EDICIÓN */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Tipo de Cliente</label>
              <select
                name="tipo_cliente"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                required
                disabled={isUpdating}
                value={editFormData.tipo_cliente}
                onChange={handleEditInputChange}
              >
                <option value="Natural">Persona Natural</option>
                <option value="Juridico">Persona Jurídica</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Nombre / Razón Social</label>
              <Input
                name="name"
                type="text"
                placeholder="Ej: Distribuidora Activa S.A.S."
                required
                disabled={isUpdating}
                value={editFormData.name}
                onChange={handleEditInputChange}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Correo Electrónico</label>
              <Input
                name="email"
                type="text"
                placeholder="Ej: contacto@empresa.com"
                required
                disabled={isUpdating}
                value={editFormData.email}
                onChange={handleEditInputChange}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Teléfono</label>
              <Input
                name="phone"
                type="text"
                placeholder="Ej: 3151234567"
                required
                disabled={isUpdating}
                value={editFormData.phone}
                onChange={handleEditInputChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Dirección</label>
                <Input
                  name="address"
                  type="text"
                  placeholder="Ej: Calle 10 #4-20"
                  required
                  disabled={isUpdating}
                  value={editFormData.address}
                  onChange={handleEditInputChange}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Ciudad</label>
                <Input
                  name="city"
                  type="text"
                  placeholder="Ej: Cúcuta"
                  required
                  disabled={isUpdating}
                  value={editFormData.city}
                  onChange={handleEditInputChange}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditModal}
                disabled={isUpdating}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isUpdating}
              >
                {isUpdating ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── NUEVO ALERT DIALOG PARA CONFIRMAR ELIMINACIÓN ── */}
      <AlertDialog open={!!deletingClient} onOpenChange={(open) => !open && setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingClient && (
                <>
                  Esta acción desactivará (eliminación lógica) al cliente{" "}
                  <strong>{deletingClient.name}</strong> (NIT {deletingClient.nit}) del sistema.
                  El cliente ya no aparecerá en el listado activo.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}