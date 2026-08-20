import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, Settings, Loader2, ChevronLeft, ChevronRight, SlidersHorizontal, Eye, Check, X, Pencil, Printer, Package, Calculator } from "lucide-react";
import { useOrders, Order, OrderListFilters } from "@/hooks/useOrders";
import { NewOrderDialog } from "@/components/NewOrderDialog";
import { OrderDetailDialog } from "@/components/OrderDetailDialog";
import { OrderStatusPanel } from "@/components/OrderStatusPanel";
import { OrderPaymentDetailDialog, PaymentDetailSubject } from "@/components/OrderPaymentDetailDialog";
import { ArticlesDetailDialog } from "@/components/ArticlesDetailDialog";
import { OrderRealCostDialog } from "@/components/OrderRealCostDialog";
import { useToast } from "@/components/ui/use-toast";
import { EditableSalePriceCell, getOrderProfitPreview } from "@/components/EditableSalePriceCell";

import { formatCurrency } from "@/lib/format-number";
import {
  resolveFactoryCardInfo,
  summarizeOrderArticles,
  itemsToArticleDetailLines,
} from "@/lib/order-fields";
import { printOrderProductionGuide } from "@/lib/order-production-guide";
import {
  getOrderRealCostFromOrder,
  ORDER_REAL_COST_EVENT,
  type OrderRealCostBreakdown,
} from "@/lib/order-real-cost";

const formatMoney = (value: string | number) => formatCurrency(value);

function orderToPaymentSubject(order: Order): PaymentDetailSubject {
  const estado =
    order.estado_pago === "parcial" ||
    order.estado_pago === "pagado" ||
    order.estado_pago === "no_pagado"
      ? order.estado_pago
      : order.pagado
        ? "pagado"
        : "no_pagado";

  return {
    id: order.id,
    cliente_nombre: order.cliente_nombre,
    estado_pago: estado,
    pagado: estado === "pagado" || order.pagado,
    detalle_abono: order.detalle_abono ?? null,
    valor_venta_proyectado: order.valor_venta_proyectado,
  };
}

export default function Orders() {
  const { toast } = useToast();
  const {
    orders,
    loading,
    error,
    fetchOrders,
    fetchOrderById,
    totalCount,
    updateOrderSalePrice,
    updateOrderComments,
    updateOrderPayment,
    updatingSalePriceId,
    updatingCommentsId,
  } = useOrders();
  const [statusPanelOrder, setStatusPanelOrder] = useState<Order | null>(null);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [paymentDetailOrder, setPaymentDetailOrder] = useState<Order | null>(null);
  const [paymentDetailOpen, setPaymentDetailOpen] = useState(false);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [articlesOrder, setArticlesOrder] = useState<Order | null>(null);
  const [articlesOpen, setArticlesOpen] = useState(false);
  const [realCostOrder, setRealCostOrder] = useState<Order | null>(null);
  const [realCostOpen, setRealCostOpen] = useState(false);
  const [realCostTick, setRealCostTick] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [salePriceDrafts, setSalePriceDrafts] = useState<Record<string, string>>({});
  const [commentsDraft, setCommentsDraft] = useState("");

  const [filters, setFilters] = useState<OrderListFilters>({
    id: "",
    estado: "todos",
    payment_status: "todos",
    cliente_id: "",
    producto_id: "",
    fecha_creacion: "",
    page: 1,
    page_size: 10,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / (filters.page_size || 10)));

  useEffect(() => {
    const refreshFromDb = () => {
      setRealCostTick((n) => n + 1);
      void fetchOrders(filters);
    };
    window.addEventListener(ORDER_REAL_COST_EVENT, refreshFromDb);
    window.addEventListener("focus", refreshFromDb);
    return () => {
      window.removeEventListener(ORDER_REAL_COST_EVENT, refreshFromDb);
      window.removeEventListener("focus", refreshFromDb);
    };
  }, [fetchOrders, filters]);

  const realCostByOrder = useMemo(() => {
    void realCostTick;
    const map: Record<string, OrderRealCostBreakdown | null> = {};
    for (const order of orders) {
      map[order.id] = getOrderRealCostFromOrder(order);
    }
    return map;
  }, [orders, realCostTick]);

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
    const term = searchTerm.toLowerCase().trim();
    if (!term) return orders;
    return orders.filter((order) => {
      const articles = summarizeOrderArticles(order.items || [], {
        fallbackColor: order.color,
        fallbackProduct: order.producto_nombre,
      }).plainText.toLowerCase();
      return (
        order.cliente_nombre?.toLowerCase().includes(term) ||
        order.producto_nombre?.toLowerCase().includes(term) ||
        order.id?.toLowerCase().includes(term) ||
        articles.includes(term) ||
        (order.items || []).some(
          (item) =>
            item.subproducto_nombre?.toLowerCase().includes(term) ||
            item.talla_nombre?.toLowerCase().includes(term) ||
            item.color?.toLowerCase().includes(term)
        )
      );
    });
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
    setCommentsDraft(order.comentarios ?? "");

    const freshOrder = await fetchOrderById(order.id);
    if (freshOrder) {
      setDetailOrder(freshOrder);
      setCommentsDraft(freshOrder.comentarios ?? "");
    }
    setLoadingDetail(false);
  };

  const handlePrintGuide = async (order: Order) => {
    setPrintingOrderId(order.id);
    try {
      // Abrir la ventana dentro de printOrderProductionGuide de forma síncrona
      // (sin await previo) para no perder el gesto del click.
      await printOrderProductionGuide(order, {
        refreshOrder: () => fetchOrderById(order.id),
      });
    } catch (err) {
      toast({
        title: "No se pudo generar la guía",
        description:
          err instanceof Error
            ? err.message
            : "Intenta de nuevo o permite ventanas emergentes.",
        variant: "destructive",
      });
    } finally {
      setPrintingOrderId(null);
    }
  };

  const handleSaveComments = async () => {
    if (!detailOrder) return;

    const { order: updated, errorMessage } = await updateOrderComments(detailOrder.id, commentsDraft);
    if (updated) {
      setDetailOrder(updated);
      toast({
        title: "Comentarios actualizados",
        description: "Los comentarios se guardaron sin afectar costos ni estado.",
      });
      return;
    }

    toast({
      title: "No se pudieron guardar los comentarios",
      description: errorMessage || "Intenta de nuevo.",
      variant: "destructive",
    });
  };

  return (
    <AppLayout title="Órdenes" subtitle="Gestión centralizada de órdenes" eyebrow="Comercial">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">Todas las órdenes</CardTitle>
          <Button size="sm" onClick={() => { setEditOrder(null); setIsNewOrderOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nueva orden
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {/* Filtros compactos — mismo patrón que Cotizaciones */}
          <div className="flex flex-nowrap items-end gap-2 p-3 border-b border-border bg-muted/5 overflow-x-auto">
            <div className="flex-1 min-w-[140px] max-w-[200px] space-y-0.5">
              <Label className="text-xs font-medium text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cliente, producto, ID..."
                  className="h-9 text-sm pl-8 pr-2"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="shrink-0 w-[130px] space-y-0.5">
              <Label className="text-xs font-medium text-muted-foreground">Estado</Label>
              <Select
                value={filters.estado}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, estado: v, page: 1 }))}
              >
                <SelectTrigger className="h-9 text-sm px-2.5">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_production">En producción</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="shrink-0 w-[120px] space-y-0.5">
              <Label className="text-xs font-medium text-muted-foreground">Pago</Label>
              <Select
                value={filters.payment_status}
                onValueChange={(v) => setFilters((prev) => ({
                  ...prev,
                  payment_status: v as "paid" | "unpaid" | "todos",
                  page: 1
                }))}
              >
                <SelectTrigger className="h-9 text-sm px-2.5">
                  <SelectValue placeholder="Pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                  <SelectItem value="unpaid">No pagado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="shrink-0 w-[148px] space-y-0.5">
              <Label className="text-xs font-medium text-muted-foreground">Fecha inicio</Label>
              <Input
                type="date"
                className="h-9 w-full box-border text-sm leading-none px-2.5 py-0 overflow-hidden [&::-webkit-datetime-edit]:min-w-0"
                value={filters.fecha_creacion}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, fecha_creacion: e.target.value, page: 1 }))
                }
              />
            </div>

            <div className="flex items-end pb-0.5 gap-1.5">
              <Button
                variant="outline"
                className="h-9 px-3 text-sm whitespace-nowrap"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1" /> Avanzado
              </Button>
            </div>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-3 py-2 border-b bg-muted/10">
              <Input
                placeholder="UUID de la orden"
                className="h-9 text-sm"
                value={filters.id}
                onChange={(e) => setFilters((p) => ({ ...p, id: e.target.value, page: 1 }))}
              />
              <Input
                placeholder="UUID del cliente"
                className="h-9 text-sm"
                value={filters.cliente_id}
                onChange={(e) => setFilters((p) => ({ ...p, cliente_id: e.target.value, page: 1 }))}
              />
              <Input
                placeholder="UUID del producto"
                className="h-9 text-sm"
                value={filters.producto_id}
                onChange={(e) => setFilters((p) => ({ ...p, producto_id: e.target.value, page: 1 }))}
              />
            </div>
          )}

          {loading ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[64px] text-xs text-center">ID</TableHead>
                    <TableHead className="w-[78px] text-xs text-center">Inicio</TableHead>
                    <TableHead className="min-w-[100px] text-xs">Cliente</TableHead>
                    <TableHead className="w-[88px] text-xs text-center">Artículos</TableHead>
                    <TableHead className="w-[88px] text-xs text-right">Costo</TableHead>
                    <TableHead className="w-[96px] text-xs text-right">Costo real</TableHead>
                    <TableHead className="w-[96px] text-xs text-right">Venta</TableHead>
                    <TableHead className="w-[80px] text-xs text-right">Ganancia</TableHead>
                    <TableHead className="w-[56px] text-xs text-center">Margen</TableHead>
                    <TableHead className="w-[92px] text-xs text-center">Estado</TableHead>
                    <TableHead className="w-[52px] text-xs text-center">Bordado</TableHead>
                    <TableHead className="w-[84px] text-xs text-center">Pago</TableHead>
                    <TableHead className="w-[78px] text-xs text-center">Entrega</TableHead>
                    <TableHead className="w-[96px] text-xs text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8 text-muted-foreground text-sm">
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
                      const factory = resolveFactoryCardInfo(order);
                      const articleCount = (order.items || []).length;

                      return (
                        <TableRow key={order.id} className="hover:bg-muted/50">
                          <TableCell className="text-center text-foreground text-sm tabular-nums py-2.5">
                            ORD-{order.id.slice(0, 3).toUpperCase()}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground text-sm py-2.5 whitespace-nowrap">
                            {new Date(order.fecha_creacion).toLocaleDateString("es-CO")}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm truncate max-w-[140px] py-2.5">
                            {order.cliente_nombre}
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Ver artículos de la orden"
                              aria-label="Ver artículos de la orden"
                              disabled={articleCount === 0 && !order.producto_nombre}
                              onClick={() => {
                                setArticlesOrder(order);
                                setArticlesOpen(true);
                              }}
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Package className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-right text-foreground whitespace-nowrap text-sm py-2.5 tabular-nums">
                            ${formatMoney(order.costo_total)}
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <button
                              type="button"
                              title="Ver desglose de costo real"
                              onClick={() => {
                                setRealCostOrder(order);
                                setRealCostOpen(true);
                              }}
                              className="inline-flex items-center justify-end gap-1 w-full text-sm tabular-nums text-red-600 hover:text-red-700 hover:underline"
                            >
                              <Calculator className="h-3.5 w-3.5 shrink-0 opacity-80" />
                              $
                              {formatMoney(realCostByOrder[order.id]?.total ?? 0)}
                            </button>
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <EditableSalePriceCell
                              orderId={order.id}
                              value={order.valor_venta_proyectado}
                              isSaving={updatingSalePriceId === order.id}
                              onSave={handleSaveSalePrice}
                              onDraftChange={handleSalePriceDraftChange}
                            />
                          </TableCell>
                          <TableCell className={`text-right whitespace-nowrap text-sm py-2.5 tabular-nums ${profitColorClass}`}>
                            ${formatMoney(ganancia)}
                          </TableCell>
                          <TableCell className={`text-center text-sm py-2.5 tabular-nums ${profitColorClass}`}>
                            {margenPorcentaje.toFixed(1)}%
                            {isPreview && (
                              <span className="block text-[11px] font-normal text-muted-foreground leading-tight">
                                prev.
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            <div className="flex flex-col items-center gap-0.5">
                              <StatusBadge status={order.estado} compact />
                              <button
                                type="button"
                                onClick={() => openStatusPanel(order)}
                                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Settings className="h-3.5 w-3.5" /> Modificar
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            {factory.hasBordado ? (
                              <Check
                                className="h-4 w-4 text-green-600 mx-auto"
                                strokeWidth={3}
                                aria-label="Con bordado"
                              />
                            ) : (
                              <X
                                className="h-4 w-4 text-red-600 mx-auto"
                                strokeWidth={3}
                                aria-label="Sin bordado"
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <div className="flex items-center justify-center gap-1">
                                {order.pagado || order.estado_pago === "pagado" ? (
                                  <span
                                    title="Pago cerrado — no se puede modificar"
                                    className="inline-flex items-center gap-0.5 bg-emerald-100/50 border border-emerald-200/40 px-1.5 py-0.5 rounded text-xs font-medium text-emerald-800/55 cursor-default select-none"
                                  >
                                    SI
                                  </span>
                                ) : (
                                  <span
                                    className={
                                      order.estado_pago === "parcial"
                                        ? "bg-blue-100 px-1.5 py-0.5 rounded text-xs font-bold text-blue-800"
                                        : "bg-red-100 px-1.5 py-0.5 rounded text-xs font-bold text-red-800"
                                    }
                                  >
                                    {order.estado_pago === "parcial" ? "PARCIAL" : "NO"}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  title="Ver detalle de pago"
                                  onClick={() => {
                                    setPaymentDetailOrder(order);
                                    setPaymentDetailOpen(true);
                                  }}
                                  className="inline-flex p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                                >
                                  <FileText className="h-4 w-4" />
                                </button>
                              </div>
                              {order.estado_pago === "parcial" && order.detalle_abono?.fecha_registro && (
                                <div
                                  className="text-[10px] text-muted-foreground leading-tight text-center max-w-[130px]"
                                  title={`Fecha y hora de abono: ${new Date(order.detalle_abono.fecha_registro).toLocaleString("es-CO")}`}
                                >
                                  <span className="block text-primary/80 font-mono text-[9px]">
                                    {new Date(order.detalle_abono.fecha_registro).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) + " · " + new Date(order.detalle_abono.fecha_registro).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                  </span>
                                </div>
                              )}
                              {order.estado_pago === "pagado" && order.detalle_abono?.fecha_registro && (
                                <div
                                  className="text-[10px] text-muted-foreground leading-tight text-center max-w-[130px]"
                                  title={`Fecha y hora de pago: ${new Date(order.detalle_abono.fecha_registro).toLocaleString("es-CO")}`}
                                >
                                  <span className="block text-emerald-800/80 font-mono text-[9px]">
                                    {new Date(order.detalle_abono.fecha_registro).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) + " · " + new Date(order.detalle_abono.fecha_registro).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                  </span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground text-sm py-2.5 whitespace-nowrap">
                            {order.fecha_estimada_entrega
                              ? new Date(order.fecha_estimada_entrega).toLocaleDateString("es-CO")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            <div className="inline-flex items-center justify-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Ver detalles"
                                aria-label="Ver detalles"
                                onClick={() => openDetailModal(order)}
                                className="h-8 w-8 text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Imprimir guía de producción (PDF)"
                                aria-label="Imprimir guía de producción"
                                disabled={printingOrderId === order.id}
                                onClick={() => handlePrintGuide(order)}
                                className="h-8 w-8 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                              >
                                {printingOrderId === order.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Printer className="h-4 w-4" />
                                )}
                              </Button>
                              {order.estado === "pending" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title="Editar orden"
                                  aria-label="Editar orden"
                                  onClick={() => {
                                    setEditOrder(order);
                                    setIsNewOrderOpen(true);
                                  }}
                                  className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between px-3 py-2.5 border-t">
            <div className="text-xs text-muted-foreground">
              Total: {totalCount} · Pág. {filters.page} / {totalPages}
            </div>
            <div className="flex gap-1.5 items-center">
              <Select
                value={String(filters.page_size)}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, page_size: Number(v), page: 1 }))}
              >
                <SelectTrigger className="h-8 w-[4.5rem] text-sm">
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
                className="h-8 w-8 p-0"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, (p.page ?? 1) - 1) }))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={(filters.page ?? 1) >= totalPages}
                onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <NewOrderDialog
        open={isNewOrderOpen}
        onOpenChange={(open) => {
          setIsNewOrderOpen(open);
          if (!open) setEditOrder(null);
        }}
        editOrder={editOrder}
        onSuccess={() => fetchOrders(filters)}
      />
      <OrderStatusPanel
        order={statusPanelOrder}
        open={statusPanelOpen}
        onOpenChange={(open) => !open && closeStatusPanel()}
        onStatusChange={() => fetchOrders(filters)}
      />

      <OrderDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        order={detailOrder}
        loading={loadingDetail}
        commentsDraft={commentsDraft}
        onCommentsChange={setCommentsDraft}
        onSaveComments={handleSaveComments}
        savingComments={updatingCommentsId === detailOrder?.id}
      />

      <ArticlesDetailDialog
        open={articlesOpen}
        onOpenChange={(open) => {
          setArticlesOpen(open);
          if (!open) setArticlesOrder(null);
        }}
        documentLabel={
          articlesOrder
            ? `ORD-${articlesOrder.id.slice(0, 3).toUpperCase()}`
            : ""
        }
        customerName={articlesOrder?.cliente_nombre}
        lines={
          articlesOrder
            ? itemsToArticleDetailLines(articlesOrder.items || [], {
                fallbackColor: articlesOrder.color,
                fallbackProduct: articlesOrder.producto_nombre,
                estampado: articlesOrder.estampado,
              })
            : []
        }
        fallbackLines={
          articlesOrder?.producto_nombre ? [articlesOrder.producto_nombre] : []
        }
      />

      <OrderRealCostDialog
        open={realCostOpen}
        onClose={() => {
          setRealCostOpen(false);
          setRealCostOrder(null);
        }}
        orderId={realCostOrder?.id || ""}
        orderLabel={
          realCostOrder ? `ORD-${realCostOrder.id.slice(0, 3).toUpperCase()}` : undefined
        }
        estimatedCost={Number(realCostOrder?.costo_total) || 0}
        breakdown={realCostOrder ? realCostByOrder[realCostOrder.id] : null}
      />

      <OrderPaymentDetailDialog
        open={paymentDetailOpen}
        onOpenChange={(open) => {
          setPaymentDetailOpen(open);
          if (!open) setPaymentDetailOrder(null);
        }}
        subject={paymentDetailOrder ? orderToPaymentSubject(paymentDetailOrder) : null}
        entityNoun="orden"
        idPrefix="ORD"
        onUpdatePayment={async (id, payload) => {
          const result = await updateOrderPayment(id, payload);
          return {
            subject: result.order ? orderToPaymentSubject(result.order) : null,
            errorMessage: result.errorMessage,
          };
        }}
        onUpdated={(updated) => {
          setPaymentDetailOrder((prev) =>
            prev && prev.id === updated.id
              ? {
                  ...prev,
                  estado_pago: updated.estado_pago,
                  pagado: updated.pagado ?? updated.estado_pago === "pagado",
                  detalle_abono: updated.detalle_abono ?? null,
                  valor_venta_proyectado:
                    updated.valor_venta_proyectado != null
                      ? String(updated.valor_venta_proyectado)
                      : prev.valor_venta_proyectado,
                }
              : prev
          );
          toast({
            title: "Pago actualizado",
            description: "El estado de pago se sincronizó en órdenes y cotizaciones.",
          });
        }}
      />
    </AppLayout>
  );
}