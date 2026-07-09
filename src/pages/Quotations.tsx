import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuotes, type Quote } from "@/hooks/useQuotes";
import QuoteForm, { type QuoteFormValues } from "@/components/quotes/QuoteForm";
import { useToast } from "@/hooks/use-toast";

export default function Quotations() {
  const { toast } = useToast();
  const {
    quotes,
    loading,
    error,
    fetchQuotes,
    createQuote,
    updateQuote,
    deleteQuote,
  } = useQuotes();

  // Estado del modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);

  // Verificar si el usuario es admin
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.roles?.some((r: string) =>
    r === "Administrador" || r === "admin"
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

  // Cargar datos al montar
  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // Handlers
  const handleCreate = async (data: QuoteFormValues) => {
    // Convertir datos del formulario al formato que espera createQuote
    const quoteData = {
      customerName: data.customerName,
      customerId: data.clientId,
      items: data.items,
      totalAmount: data.totalAmount,
      status: data.status,
      validUntil: data.validUntil,
      // Nuevos campos
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
    // Convertir datos del formulario al formato que espera updateQuote
    const quoteData = {
      customerName: data.customerName,
      customerId: data.clientId,
      items: data.items,
      totalAmount: data.totalAmount,
      status: data.status,
      validUntil: data.validUntil,
      // Nuevos campos
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
              <Button onClick={fetchQuotes}>Reintentar</Button>
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
          {isAdmin && (
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={openCreateModal}
            >
              <Plus className="h-4 w-4 mr-1" /> Nueva cotización
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">ID</TableHead>
                <TableHead className="min-w-[140px]">Cliente</TableHead>
                <TableHead className="min-w-[160px]">Artículos</TableHead>
                <TableHead className="w-[120px] text-right">Monto</TableHead>
                <TableHead className="w-[110px]">Estado</TableHead>
                <TableHead className="w-[120px]">Tomada por</TableHead>
                <TableHead className="w-[100px] text-center">Probabilidad</TableHead>
                <TableHead className="w-[100px] text-center">Envío</TableHead>
                <TableHead className="w-[100px]">Validez</TableHead>
                <TableHead className="w-[80px] text-center">Novedades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No hay cotizaciones disponibles
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((q) => (
                  <TableRow key={q.id} className="hover:bg-muted/50">
                    <TableCell className="font-semibold text-foreground">
                      {getFormattedId(q.id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {q.customerName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {q.items}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground whitespace-nowrap">
                      {formatAmount(q.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={q.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {q.takenBy || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${(q.probability || 0) >= 80 ? 'bg-green-100 text-green-800' :
                        (q.probability || 0) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                        {q.probability || 0}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {q.shippingDate ? new Date(q.shippingDate).toLocaleDateString('es-ES') : "–"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(q.validUntil).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600">
                        <Bell className="h-4 w-4" />
                      </span>
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
                  // Nuevos campos para edición
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
    </AppLayout>
  );
}