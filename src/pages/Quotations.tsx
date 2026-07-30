import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Bell, X, ShoppingCart } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuotes, type Quote } from "@/hooks/useQuotes";
import QuoteForm, { type QuoteFormValues } from "@/components/quotes/QuoteForm";
import { NewOrderDialog } from "@/components/NewOrderDialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetClients } from "@/hooks/useGetClients";

export default function Quotations() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    quotes,
    loading,
    error,
    fetchQuotes,
    createQuote,
    updateQuote,
    deleteQuote,
    updateQuoteStatus,
    markQuoteAsOrdered,
  } = useQuotes();

  // Estado del modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);

  // Orden desde cotización aprobada
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [quoteForOrder, setQuoteForOrder] = useState<Quote | null>(null);

  // Estado para el modal de cambio de estado (solo roles no-admin con permiso update)
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  // Estado para filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [backendFilters, setBackendFilters] = useState({
    client: "all",
    estado: "all",
    tomado_por: "",
    probabilidad: "" as string | number,
    fecha_envio_desde: "",
    fecha_envio_hasta: "",
  });

  // Estado para debounce de búsqueda
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [debouncedTomadoPor, setDebouncedTomadoPor] = useState("");
  const [debouncedProbabilidad, setDebouncedProbabilidad] = useState("" as string | number);

  // Refs para timeouts
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tomadoPorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const probabilidadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cargar clientes para el selector de filtro
  const { clients } = useGetClients(1, 100);

  // Verificar si el usuario es admin
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.roles?.some((r: string) =>
    r === "Administrador" || r === "admin"
  );

  // Obtener permisos del usuario desde localStorage
  const userPermissions = user?.permissions || [];

  // Permiso para crear cotizaciones
  const canCreateQuotes = isAdmin || userPermissions.some(
    (perm: any) => perm.module === "quotations" && perm.actions?.includes("create")
  );

  // Admin solo visualiza el avance; no cambia estado con el botón dedicado.
  // Otros roles con update sí pueden (sin auto-crear orden).
  const canChangeQuoteStatus =
    !isAdmin &&
    userPermissions.some(
      (perm: any) => perm.module === "quotations" && perm.actions?.includes("update")
    );

  const canCreateOrderFromQuote =
    isAdmin ||
    userPermissions.some(
      (perm: any) =>
        (perm.module === "orders" && perm.actions?.includes("create")) ||
        (perm.module === "quotations" && perm.actions?.includes("update"))
    );

  // Función para generar ID con formato Q-### (tres dígitos)
  const getFormattedId = (id: string) => {
    const shortId = id.slice(-3);
    return `Q-${shortId}`;
  };

  // Función para formatear monto con separador de miles
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('CLP', '').trim();
  };

  // Abrir modal de cambio de estado
  const openStatusModal = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setNewStatus("");
    setStatusModalOpen(true);
  };

  // Cerrar modal de cambio de estado
  const closeStatusModal = () => {
    setSelectedQuoteId(null);
    setNewStatus("");
    setStatusModalOpen(false);
  };

  // Debounce para searchTerm
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(value);
    }, 500);
  };

  // Debounce para tomado_por
  const handleTomadoPorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBackendFilters(prev => ({ ...prev, tomado_por: value }));

    if (tomadoPorTimeoutRef.current) {
      clearTimeout(tomadoPorTimeoutRef.current);
    }

    tomadoPorTimeoutRef.current = setTimeout(() => {
      setDebouncedTomadoPor(value);
    }, 500);
  };

  // Debounce para probabilidad
  const handleProbabilidadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBackendFilters(prev => ({ ...prev, probabilidad: value }));

    if (probabilidadTimeoutRef.current) {
      clearTimeout(probabilidadTimeoutRef.current);
    }

    probabilidadTimeoutRef.current = setTimeout(() => {
      setDebouncedProbabilidad(value);
    }, 500);
  };

  // Filtrar en frontend por búsqueda general (usando debouncedSearchTerm)
  const filteredQuotes = quotes.filter((q) => {
    if (!debouncedSearchTerm) return true;
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return (
      q.id.toLowerCase().includes(lowerSearch) ||
      q.customerName.toLowerCase().includes(lowerSearch) ||
      q.items.toLowerCase().includes(lowerSearch) ||
      (q.takenBy && q.takenBy.toLowerCase().includes(lowerSearch))
    );
  });

  // Función para limpiar todos los filtros
  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setDebouncedTomadoPor("");
    setDebouncedProbabilidad("");

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (tomadoPorTimeoutRef.current) clearTimeout(tomadoPorTimeoutRef.current);
    if (probabilidadTimeoutRef.current) clearTimeout(probabilidadTimeoutRef.current);

    setBackendFilters({
      client: "all",
      estado: "all",
      tomado_por: "",
      probabilidad: "",
      fecha_envio_desde: "",
      fecha_envio_hasta: "",
    });
  };

  // Cargar datos al montar y cuando cambien los filtros del backend
  useEffect(() => {
    const numericProb = debouncedProbabilidad !== "" ? Number(debouncedProbabilidad) : undefined;
    fetchQuotes({
      client: backendFilters.client !== "all" ? backendFilters.client : undefined,
      estado: backendFilters.estado !== "all" ? backendFilters.estado : undefined,
      tomado_por: debouncedTomadoPor || undefined,
      probabilidad: numericProb,
      fecha_envio_desde: backendFilters.fecha_envio_desde || undefined,
      fecha_envio_hasta: backendFilters.fecha_envio_hasta || undefined,
    });
  }, [backendFilters.client, backendFilters.estado, backendFilters.fecha_envio_desde, backendFilters.fecha_envio_hasta, debouncedTomadoPor, debouncedProbabilidad, fetchQuotes]);

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (tomadoPorTimeoutRef.current) clearTimeout(tomadoPorTimeoutRef.current);
      if (probabilidadTimeoutRef.current) clearTimeout(probabilidadTimeoutRef.current);
    };
  }, []);

  // Handlers
  const handleCreate = async (data: QuoteFormValues) => {
    const quoteData = {
      customerName: data.customerName,
      customerId: data.clientId,
      items: data.items,
      totalAmount: data.totalAmount,
      status: data.status,
      validUntil: data.validUntil,
      takenBy: data.takenBy,
      probability: data.probability,
      shippingDate: data.shippingDate,
    };
    const result = await createQuote(quoteData);
    if (result.success) {
      toast({
        title: "✅ Cotización creada",
        description: "La cotización se ha creado correctamente",
      });
      setIsFormOpen(false);
    } else {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: result.errorMessage || "No se pudo crear la cotización",
      });
    }
  };

  const handleUpdate = async (data: QuoteFormValues) => {
    if (!editingQuote) return;
    const quoteData = {
      customerName: data.customerName,
      customerId: data.clientId,
      items: data.items,
      totalAmount: data.totalAmount,
      status: data.status,
      validUntil: data.validUntil,
      takenBy: data.takenBy,
      probability: data.probability,
      shippingDate: data.shippingDate,
    };
    const result = await updateQuote(editingQuote.id, quoteData);
    if (result.success) {
      toast({
        title: "✅ Cotización actualizada",
        description: "Los cambios se han guardado correctamente",
      });
      setIsFormOpen(false);
      setEditingQuote(null);
    } else {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: result.errorMessage || "No se pudo actualizar la cotización",
      });
    }
  };

  const openCreateModal = () => {
    setEditingQuote(null);
    setIsFormOpen(true);
  };

  const closeModal = () => {
    setIsFormOpen(false);
    setEditingQuote(null);
  };

  // Estados de carga y error
  if (loading && quotes.length === 0) {
    return (
      <AppLayout title="Cotizaciones" subtitle="Gestión de cotizaciones y propuestas">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Cargando cotizaciones…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Cotizaciones" subtitle="Gestión de cotizaciones y propuestas">
        <Card>
          <CardContent className="py-8">
            <p className="text-destructive text-center">{error}</p>
            <div className="text-center mt-4">
              <Button onClick={() => fetchQuotes()}>Reintentar</Button>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Cotizaciones" subtitle="Gestión de cotizaciones y propuestas">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Cotizaciones</CardTitle>
          {canCreateQuotes && (
            <Button
              size="sm"
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={openCreateModal}
            >
              <Plus className="h-4 w-4 mr-1" /> Nueva cotización
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {/* Panel de Filtros - Una sola fila */}
          <div className="flex flex-nowrap items-end gap-2 p-3 border-b border-border bg-muted/5 overflow-x-auto">
            {/* Buscador General - Frontend */}
            <div className="flex-1 min-w-[120px] max-w-[180px] space-y-0.5">
              <Label htmlFor="search" className="text-[10px] font-medium text-muted-foreground">Buscar</Label>
              <Input
                id="search"
                placeholder="ID, Cliente..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="h-7 text-xs px-2"
              />
            </div>

            {/* Cliente - Backend */}
            <div className="flex-1 min-w-[100px] max-w-[160px] space-y-0.5">
              <Label className="text-[10px] font-medium text-muted-foreground">Cliente</Label>
              <Select
                value={backendFilters.client}
                onValueChange={(val) => setBackendFilters(prev => ({ ...prev, client: val }))}
              >
                <SelectTrigger className="h-7 text-xs px-2">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado - Backend */}
            <div className="flex-1 min-w-[90px] max-w-[140px] space-y-0.5">
              <Label className="text-[10px] font-medium text-muted-foreground">Estado</Label>
              <Select
                value={backendFilters.estado}
                onValueChange={(val) => setBackendFilters(prev => ({ ...prev, estado: val }))}
              >
                <SelectTrigger className="h-7 text-xs px-2">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="approved">Aprobada</SelectItem>
                  <SelectItem value="rejected">Rechazada</SelectItem>
                  <SelectItem value="in_review">En Revisión</SelectItem>
                  <SelectItem value="ordered">Ordenado</SelectItem>
                  <SelectItem value="inactive">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tomado por - Backend con debounce */}
            <div className="flex-1 min-w-[90px] max-w-[140px] space-y-0.5">
              <Label htmlFor="tomado_por" className="text-[10px] font-medium text-muted-foreground">Tomada por</Label>
              <Input
                id="tomado_por"
                placeholder="Nombre"
                value={backendFilters.tomado_por}
                onChange={handleTomadoPorChange}
                className="h-7 text-xs px-2"
              />
            </div>

            {/* Probabilidad - Backend con debounce */}
            <div className="flex-1 min-w-[80px] max-w-[110px] space-y-0.5">
              <Label htmlFor="probabilidad" className="text-[10px] font-medium text-muted-foreground">Prob. %</Label>
              <Input
                id="probabilidad"
                type="number"
                min="0"
                max="100"
                placeholder="Ej. 80"
                value={backendFilters.probabilidad}
                onChange={handleProbabilidadChange}
                className="h-7 text-xs px-2"
              />
            </div>

            {/* Fecha Envío Desde - Backend */}
            <div className="flex-1 min-w-[90px] max-w-[130px] space-y-0.5">
              <Label htmlFor="desde" className="text-[10px] font-medium text-muted-foreground">Envío desde</Label>
              <Input
                id="desde"
                type="date"
                value={backendFilters.fecha_envio_desde}
                onChange={(e) => setBackendFilters(prev => ({ ...prev, fecha_envio_desde: e.target.value }))}
                className="h-7 text-xs px-2"
              />
            </div>

            {/* Fecha Envío Hasta - Backend */}
            <div className="flex-1 min-w-[90px] max-w-[130px] space-y-0.5">
              <Label htmlFor="hasta" className="text-[10px] font-medium text-muted-foreground">Envío hasta</Label>
              <Input
                id="hasta"
                type="date"
                value={backendFilters.fecha_envio_hasta}
                onChange={(e) => setBackendFilters(prev => ({ ...prev, fecha_envio_hasta: e.target.value }))}
                className="h-7 text-xs px-2"
              />
            </div>

            {/* Botón Limpiar - más pequeño */}
            <div className="flex items-end pb-0.5">
              <Button
                variant="destructive"
                className="h-7 px-2.5 text-xs bg-red-500 hover:bg-red-600 text-white whitespace-nowrap"
                onClick={handleClearFilters}
              >
                <X className="h-3 w-3 mr-0.5" /> Limpiar
              </Button>
            </div>
          </div>

          {/* Tabla */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px] text-[10px]">ID</TableHead>
                <TableHead className="min-w-[120px] text-[10px]">Cliente</TableHead>
                <TableHead className="min-w-[140px] text-[10px]">Artículos</TableHead>
                <TableHead className="w-[90px] text-right text-[10px]">Monto</TableHead>
                <TableHead className="w-[110px] text-[10px]">Estado</TableHead>
                <TableHead className="w-[100px] text-[10px]">Tomada por</TableHead>
                <TableHead className="w-[80px] text-center text-[10px]">Prob.</TableHead>
                <TableHead className="w-[85px] text-center text-[10px]">Envío</TableHead>
                <TableHead className="w-[85px] text-[10px]">Validez</TableHead>
                <TableHead className="w-[60px] text-center text-[10px]">Novedades</TableHead>
                <TableHead className="w-[110px] text-center text-[10px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground text-sm">
                    {quotes.length === 0 ? "No hay cotizaciones disponibles" : "No hay resultados para los filtros aplicados"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuotes.map((q) => (
                  <TableRow key={q.id} className="hover:bg-muted/50">
                    <TableCell className="font-semibold text-foreground text-xs">
                      {getFormattedId(q.id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate max-w-[120px]">
                      {q.customerName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate max-w-[140px]">
                      {q.items}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground whitespace-nowrap text-xs">
                      {formatAmount(q.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={q.status} />
                        {canChangeQuoteStatus &&
                          q.status !== "inactive" &&
                          q.status !== "ordered" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-5 px-1.5 text-[9px] font-normal"
                            onClick={() => openStatusModal(q.id)}
                          >
                            Cambiar estado
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate max-w-[100px]">
                      {q.takenBy || "-"}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${(q.probability || 0) >= 80 ? 'bg-green-100 text-green-800' :
                        (q.probability || 0) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                        {q.probability || 0}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs">
                      {q.shippingDate ? new Date(q.shippingDate).toLocaleDateString('es-ES') : "–"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(q.validUntil).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600">
                        <Bell className="h-3 w-3" />
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {canCreateOrderFromQuote && q.status === "approved" && (
                        <div className="flex flex-col items-center gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-2 text-[10px] gap-1"
                            onClick={() => {
                              setQuoteForOrder(q);
                              setOrderDialogOpen(true);
                            }}
                          >
                            <ShoppingCart className="h-3 w-3" />
                            Crear orden
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 px-1.5 text-[9px] text-muted-foreground"
                            onClick={async () => {
                              const result = await markQuoteAsOrdered(q.id);
                              if (result.success) {
                                toast({
                                  title: "Cotización actualizada",
                                  description: "Estado cambiado a Ordenado.",
                                });
                              } else {
                                toast({
                                  variant: "destructive",
                                  title: "No se pudo marcar como Ordenado",
                                  description: result.errorMessage || "Intenta de nuevo.",
                                });
                              }
                            }}
                          >
                            Ya creé la orden → Ordenado
                          </Button>
                        </div>
                      )}
                      {q.status === "ordered" && (
                        <span className="text-[10px] text-muted-foreground">Ya ordenada</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de creación/edición */}
      <Dialog open={isFormOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingQuote ? "Editar Cotización" : "Nueva Cotización"}
            </DialogTitle>
          </DialogHeader>

          <QuoteForm
            initialData={
              editingQuote
                ? {
                  clientId: editingQuote.customerId,
                  customerName: editingQuote.customerName,
                  items: editingQuote.items,
                  totalAmount: editingQuote.totalAmount,
                  status: editingQuote.status as QuoteFormValues["status"],
                  validUntil: editingQuote.validUntil,
                  takenBy: editingQuote.takenBy,
                  probability: editingQuote.probability,
                  shippingDate: editingQuote.shippingDate,
                }
                : undefined
            }
            onSubmit={editingQuote ? handleUpdate : handleCreate}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de cambio de estado */}
      <Dialog open={statusModalOpen} onOpenChange={closeStatusModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar estado de cotización</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecciona el nuevo estado para esta cotización.
            </p>

            <Select
              value={newStatus}
              onValueChange={setNewStatus}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rejected">DESCARTADO</SelectItem>
                <SelectItem value="in_review">EN REVISIÓN</SelectItem>
                <SelectItem value="approved">APROBADO</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={closeStatusModal}
                disabled={isStatusUpdating}
              >
                Cancelar
              </Button>
              <Button
                disabled={!newStatus || isStatusUpdating}
                onClick={async () => {
                  if (!selectedQuoteId) return;
                  setIsStatusUpdating(true);

                  try {
                    const statusResult = await updateQuoteStatus(selectedQuoteId, newStatus);

                    if (!statusResult.success) {
                      throw new Error(statusResult.errorMessage || "Error al actualizar el estado");
                    }

                    const statusLabels: Record<string, string> = {
                      rejected: "Descartado",
                      in_review: "En Revisión",
                      approved: "Aprobado",
                    };
                    toast({
                      title: "Estado actualizado",
                      description: `Nuevo estado: ${statusLabels[newStatus] || newStatus}`,
                    });
                    await fetchQuotes();
                    closeStatusModal();
                  } catch (err: any) {
                    const errorMessage = err?.message || "Error al actualizar el estado";
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: errorMessage,
                    });
                  } finally {
                    setIsStatusUpdating(false);
                  }
                }}
              >
                {isStatusUpdating ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <NewOrderDialog
        open={orderDialogOpen}
        onOpenChange={(open) => {
          setOrderDialogOpen(open);
          if (!open) setQuoteForOrder(null);
        }}
        initialClientId={quoteForOrder?.customerId}
        initialIncome={quoteForOrder?.totalAmount}
        initialDeliveryDate={quoteForOrder?.shippingDate}
        quoteId={quoteForOrder?.id}
        onOrderCreatedFromQuote={async (quoteId) => {
          const result = await markQuoteAsOrdered(quoteId);
          if (!result.success) {
            throw new Error(result.errorMessage || "No se pudo marcar la cotización como Ordenado");
          }
        }}
        onSuccess={(opts) => {
          fetchQuotes();
          // Solo ir a Órdenes si la cotización quedó marcada
          if (!opts || opts.quoteMarked !== false) {
            navigate("/orders");
          }
        }}
      />
    </AppLayout>
  );
}