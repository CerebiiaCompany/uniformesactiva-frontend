import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, Settings, Loader2, ChevronLeft, ChevronRight, SlidersHorizontal, Eye } from "lucide-react";
import { useOrders, Order } from "@/hooks/useOrders";
import { NewOrderDialog } from "@/components/NewOrderDialog";
import { OrderStatusPanel } from "@/components/OrderStatusPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { EditableSalePriceCell, getOrderProfitPreview } from "@/components/EditableSalePriceCell";

import { formatCurrency } from "@/lib/format-number";

const formatMoney = (value: string | number) => formatCurrency(value);

export default function Orders() {
  const { toast } = useToast();
  const { orders, loading, error, fetchOrders, fetchOrderById, totalCount, updateOrderSalePrice, updatingSalePriceId } = useOrders();
  const [statusPanelOrder, setStatusPanelOrder] = useState<Order | null>(null);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [salePriceDrafts, setSalePriceDrafts] = useState<Record<string, string>>({});

  const [filters, setFilters] = useState({
    id: "",
    estado: "todos",
    cliente_id: "",
    producto_id: "",
    fecha_creacion: "",
    page: 1,
    page_size: 10,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / filters.page_size));

  useEffect(() => {
    if (error) {
      toast({
        title: "Error al cargar órdenes",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  useEffect(() => {
    fetchOrders(filters);
  }, [fetchOrders, filters]);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return orders.filter(
      (order) =>
        order.cliente_nombre?.toLowerCase().includes(term) ||
        order.producto_nombre?.toLowerCase().includes(term) ||
        order.id?.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  const openStatusPanel = (order: Order) => {
    setStatusPanelOrder(order);
    setStatusPanelOpen(true);
  };

  const closeStatusPanel = () => {
    setStatusPanelOpen(false);
    setTimeout(() => setStatusPanelOrder(null), 600);
  };

  const handleSalePriceDraftChange = (orderId: string, raw: string | null) => {
    setSalePriceDrafts((prev) => {
      const next = { ...prev };
      if (raw == null) {
        delete next[orderId];
      } else {
        next[orderId] = raw;
      }
      return next;
    });
  };

  const handleSaveSalePrice = async (orderId: string, value: number) => {
    const { order: updated, errorMessage } = await updateOrderSalePrice(orderId, value);
    if (updated) {
      toast({
        title: "Valor de venta actualizado",
        description: `Margen: ${(Number(updated.margen_ganancia) * 100).toFixed(1)}%`,
      });
      return true;
    }

    toast({
      title: "No se pudo actualizar el valor",
      description: errorMessage || "Verifica que el monto sea mayor a cero.",
      variant: "destructive",
    });
    return false;
  };

  const openDetailModal = async (order: Order) => {
    setDetailOpen(true);
    setLoadingDetail(true);
    setDetailOrder(order);

    const freshOrder = await fetchOrderById(order.id);
    if (freshOrder) {
      setDetailOrder(freshOrder);
    }
    setLoadingDetail(false);
  };

  return (
    <AppLayout title="Órdenes" subtitle="Gestión centralizada de órdenes">
      <Card>
        <CardHeader className="flex flex-col gap-4 pb-3">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Todas las órdenes</CardTitle>
            <Button size="sm" onClick={() => setIsNewOrderOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nueva orden
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar en esta página..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select
                value={filters.estado}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, estado: v, page: 1 }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_production">En producción</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                className="w-40"
                value={filters.fecha_creacion}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, fecha_creacion: e.target.value, page: 1 }))
                }
              />

              <Button variant="outline" onClick={() => setShowAdvanced(!showAdvanced)}>
                <SlidersHorizontal className="h-4 w-4 mr-2" /> Avanzado
              </Button>
            </div>

            {showAdvanced && (
              <div className="grid grid-cols-3 gap-2 p-3 bg-muted/20 rounded-md">
                <Input
                  placeholder="UUID de la orden"
                  value={filters.id}
                  onChange={(e) => setFilters((p) => ({ ...p, id: e.target.value, page: 1 }))}
                />
                <Input
                  placeholder="UUID del cliente"
                  value={filters.cliente_id}
                  onChange={(e) => setFilters((p) => ({ ...p, cliente_id: e.target.value, page: 1 }))}
                />
                <Input
                  placeholder="UUID del producto"
                  value={filters.producto_id}
                  onChange={(e) => setFilters((p) => ({ ...p, producto_id: e.target.value, page: 1 }))}
                />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-center">ID</TableHead>
                  <TableHead className="text-center">Fecha inicio</TableHead>
                  <TableHead className="text-center">Cliente</TableHead>
                  <TableHead className="text-center">Artículos</TableHead>
                  <TableHead className="text-center">Costo total</TableHead>
                  <TableHead className="text-center">Valor de venta</TableHead>
                  <TableHead className="text-center">Ganancia</TableHead>
                  <TableHead className="text-center">Margen</TableHead>
                  <TableHead className="text-center">Estado fábrica</TableHead>
                  <TableHead className="text-center">Estado pago</TableHead>
                  <TableHead className="text-center">Entrega estimada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                      No hay órdenes para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const draftRaw = salePriceDrafts[order.id];
                    const profitPreview = getOrderProfitPreview(order, draftRaw);
                    const ganancia = profitPreview.isPreview
                      ? profitPreview.ganancia
                      : Number(order.ganancia);
                    const margenPorcentaje = profitPreview.isPreview
                      ? profitPreview.margenPorcentaje
                      : Number(order.margen_ganancia) * 100;
                    const isPreview = profitPreview.isPreview;
                    const profitColorClass =
                      ganancia > 0
                        ? "text-green-600"
                        : ganancia < 0
                          ? "text-red-600"
                          : "text-slate-600";

                    return (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell className="text-center font-mono text-xs font-bold text-slate-700">
                          ORD-{order.id.slice(0, 3).toUpperCase()}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {new Date(order.fecha_creacion).toLocaleDateString("es-CO")}
                        </TableCell>
                        <TableCell className="text-center font-medium">{order.cliente_nombre}</TableCell>
                        <TableCell className="text-center">
                          <div className="text-sm font-semibold">{order.producto_nombre}</div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDetailModal(order)}
                            className="mt-2 flex items-center gap-1 text-[10px] h-6 px-2 mx-auto"
                          >
                            <Eye className="h-3 w-3" /> Detalles
                          </Button>
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-800">
                          ${formatMoney(order.costo_total)}
                        </TableCell>
                        <TableCell className="text-center">
                          <EditableSalePriceCell
                            orderId={order.id}
                            value={order.valor_venta_proyectado}
                            isSaving={updatingSalePriceId === order.id}
                            onSave={handleSaveSalePrice}
                            onDraftChange={handleSalePriceDraftChange}
                          />
                        </TableCell>
                        <TableCell className={`text-center font-bold ${profitColorClass}`}>
                          ${formatMoney(ganancia)}
                        </TableCell>
                        <TableCell className={`text-center font-bold ${profitColorClass}`}>
                          {margenPorcentaje.toFixed(1)}%
                          {isPreview && (
                            <span className="block text-[10px] font-normal text-muted-foreground">
                              vista previa
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <StatusBadge status={order.estado} />
                            <button
                              onClick={() => openStatusPanel(order)}
                              className="flex items-center text-[10px] text-muted-foreground hover:text-primary"
                            >
                              <Settings className="h-3 w-3 mr-1" /> Modificar
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-600">
                              NO
                            </span>
                            <FileText className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-primary" />
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm text-slate-600">
                          {order.fecha_estimada_entrega
                            ? new Date(order.fecha_estimada_entrega).toLocaleDateString("es-CO")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-xs text-muted-foreground">
              Total: {totalCount} registros · Página {filters.page} de {totalPages}
            </div>
            <div className="flex gap-2 items-center">
              <Select
                value={String(filters.page_size)}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, page_size: Number(v), page: 1 }))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue placeholder="10" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= totalPages}
                onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <NewOrderDialog
        open={isNewOrderOpen}
        onOpenChange={setIsNewOrderOpen}
        onSuccess={() => fetchOrders(filters)}
      />
      <OrderStatusPanel
        order={statusPanelOrder}
        open={statusPanelOpen}
        onOpenChange={(open) => !open && closeStatusPanel()}
        onStatusChange={() => fetchOrders(filters)}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de ítems</DialogTitle>
            <DialogDescription>
              Orden: {detailOrder?.id.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Variante</TableHead>
                  <TableHead className="text-center">Cant.</TableHead>
                  <TableHead className="text-center">Costo unit.</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailOrder?.items?.map((item) => (
                  <TableRow key={item.subproducto_id}>
                    <TableCell className="text-center">
                      {item.subproducto_nombre || item.subproducto_id}
                    </TableCell>
                    <TableCell className="text-center">{item.cantidad}</TableCell>
                    <TableCell className="text-center">${formatMoney(item.costo_unitario)}</TableCell>
                    <TableCell className="text-center">
                      ${formatMoney(Number(item.costo_unitario) * item.cantidad)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
