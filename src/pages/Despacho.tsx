import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrders, type Order } from "@/hooks/useOrders";
import { useGetSatellites } from "@/hooks/useSatellites";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import {
  collectShipmentsFromOrder,
  collectShipmentsFromSatellites,
  formatClientAddress,
  isOrderDelivered,
  isOrderReadyForDispatch,
  toDispatchDeliveredRow,
  toDispatchReadyRow,
  type DispatchDeliveredOrder,
  type DispatchShipmentRow,
} from "@/lib/dispatch-module";
import {
  appendClientDispatchShippingCost,
  normalizeRealCostBreakdown,
  notifyOrderRealCostUpdated,
  ORDER_REAL_COST_EVENT,
} from "@/lib/order-real-cost";
import { DispatchOrderPreviewDialog } from "@/components/DispatchOrderPreviewDialog";
import {
  DispatchDeliveryCostDialog,
  type DispatchDeliveryCostPayload,
} from "@/components/DispatchDeliveryCostDialog";
import type { Client } from "@/hooks/useGetClients";
import {
  ArrowLeftRight,
  CheckCircle2,
  Eye,
  Loader2,
  MapPin,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";

type TabId = "listos" | "domicilios" | "entregados";

async function fetchAllOrders(): Promise<Order[]> {
  const all: Order[] = [];
  let page = 1;
  let total = Infinity;
  while (all.length < total && page <= 40) {
    const params = new URLSearchParams({
      page: String(page),
      page_size: "25",
    });
    const data = await http<{ total_count: number; items: Order[] }>(
      `${endpoints.orders.list()}?${params.toString()}`
    );
    const items = data.items || [];
    total = data.total_count ?? items.length;
    all.push(...items);
    if (items.length === 0) break;
    page += 1;
  }
  return all;
}

async function fetchClientsAddressMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;
  let total = Infinity;
  while (map.size < total && page <= 40) {
    const params = new URLSearchParams({
      page: String(page),
      page_size: "100",
    });
    const data = await http<{
      results?: Client[];
      count?: number;
      items?: Client[];
      total_count?: number;
    }>(`${endpoints.clients.list()}?${params.toString()}`);
    const items = data.results || data.items || [];
    total = data.count ?? data.total_count ?? items.length;
    for (const c of items) {
      if (!c?.id) continue;
      map.set(String(c.id), formatClientAddress({ address: c.address, city: c.city }));
    }
    if (items.length === 0) break;
    page += 1;
  }
  return map;
}

function money(value: number | string) {
  return `$${formatCurrency(value)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-CO");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function Despacho() {
  const { toast } = useToast();
  const { updateOrderStatus, updateKanbanTarjetas } = useOrders();
  const { satellites, isLoading: loadingSatellites } = useGetSatellites();
  const [orders, setOrders] = useState<Order[]>([]);
  const [clientAddresses, setClientAddresses] = useState<Map<string, string>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("listos");
  const [search, setSearch] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [deliverDialogOrder, setDeliverDialogOrder] = useState<Order | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [list, addresses] = await Promise.all([
        fetchAllOrders(),
        fetchClientsAddressMap().catch(() => new Map<string, string>()),
      ]);
      setOrders(list);
      setClientAddresses(addresses);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "No se pudieron cargar pedidos",
        description: err instanceof Error ? err.message : "Error de red",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Al registrar domicilio ida/vuelta (u otro costo) desde Producción, refrescar Domicilios
  useEffect(() => {
    const onCostUpdated = () => {
      void reload();
    };
    window.addEventListener(ORDER_REAL_COST_EVENT, onCostUpdated);
    window.addEventListener("focus", onCostUpdated);
    return () => {
      window.removeEventListener(ORDER_REAL_COST_EVENT, onCostUpdated);
      window.removeEventListener("focus", onCostUpdated);
    };
  }, [reload]);

  const readyRows = useMemo(() => {
    return orders
      .filter(isOrderReadyForDispatch)
      .map(toDispatchReadyRow)
      .sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      });
  }, [orders]);

  const deliveredRows = useMemo(() => {
    return orders
      .filter(isOrderDelivered)
      .map((order) =>
        toDispatchDeliveredRow(
          order,
          clientAddresses.get(String(order.cliente_id || "")) || ""
        )
      )
      .sort((a, b) => {
        const ta = a.deliveredAt
          ? new Date(a.deliveredAt).getTime()
          : a.order.fecha_creacion
            ? new Date(a.order.fecha_creacion).getTime()
            : 0;
        const tb = b.deliveredAt
          ? new Date(b.deliveredAt).getTime()
          : b.order.fecha_creacion
            ? new Date(b.order.fecha_creacion).getTime()
            : 0;
        return tb - ta;
      });
  }, [orders, clientAddresses]);

  const shipmentRows = useMemo(() => {
    const byId = new Map<string, Order>();
    for (const order of orders) {
      byId.set(order.id, order);
      byId.set(`PO-${order.id}`, order);
    }

    const fromOrders = orders.flatMap(collectShipmentsFromOrder);
    const fromSats = collectShipmentsFromSatellites(satellites || [], byId);
    const merged = [...fromOrders, ...fromSats];

    const seen = new Set<string>();
    return merged
      .filter((row) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      })
      .sort((a, b) => {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tb - ta;
      });
  }, [orders, satellites]);

  const filteredReady = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return readyRows;
    return readyRows.filter((row) => {
      const hay = `${row.shortId} ${row.order.cliente_nombre} ${row.order.producto_nombre}`.toLowerCase();
      return hay.includes(term);
    });
  }, [readyRows, search]);

  const filteredDelivered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return deliveredRows;
    return deliveredRows.filter((row) => {
      const hay =
        `${row.shortId} ${row.order.cliente_nombre} ${row.order.producto_nombre} ${row.address}`.toLowerCase();
      return hay.includes(term);
    });
  }, [deliveredRows, search]);

  const filteredShipments = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return shipmentRows;
    return shipmentRows.filter((row) => {
      const hay =
        `${row.shortId} ${row.customerName} ${row.counterpart} ${row.directionLabel} ${row.address}`.toLowerCase();
      return hay.includes(term);
    });
  }, [shipmentRows, search]);

  const openDeliverDialog = (order: Order) => {
    setDeliverDialogOrder(order);
  };

  const confirmDeliverWithCost = async (payload: DispatchDeliveryCostPayload) => {
    const order = deliverDialogOrder;
    if (!order) return;

    setMarkingId(order.id);
    try {
      if (payload.amount > 0) {
        const previous = normalizeRealCostBreakdown(order.id, order.costo_real_desglose);
        const breakdown = appendClientDispatchShippingCost(
          order.id,
          previous,
          payload.amount,
          payload.registeredAt
        );
        const cards = Array.isArray(order.kanban_tarjetas) ? order.kanban_tarjetas : [];
        const costResult = await updateKanbanTarjetas(order.id, cards, breakdown);
        if (costResult.errorMessage) {
          toast({
            variant: "destructive",
            title: "No se pudo guardar el costo de despacho",
            description: costResult.errorMessage,
          });
          return;
        }
        notifyOrderRealCostUpdated(order.id);
      }

      const ok = await updateOrderStatus(
        order.id,
        "delivered",
        payload.amount > 0
          ? `Despacho confirmado. Costo de despacho: $${formatCurrency(payload.amount)}`
          : "Despacho confirmado desde módulo Despacho"
      );
      if (!ok) {
        toast({
          variant: "destructive",
          title: "No se pudo marcar entregado",
          description: "Revisa el estado del pedido e inténtalo de nuevo.",
        });
        return;
      }

      const shortId = toDispatchReadyRow(order).shortId;
      toast({
        title: "Pedido despachado",
        description:
          payload.amount > 0
            ? `${shortId} quedó entregado. Costo de despacho ${formatCurrency(payload.amount)} sumado en Despacho y domicilios.`
            : `${shortId} quedó como entregado.`,
      });
      setDeliverDialogOrder(null);
      await reload();
    } finally {
      setMarkingId(null);
    }
  };

  const busy = loading || loadingSatellites;

  const subtitle =
    activeTab === "listos"
      ? "Pedidos que llegaron al tablero Para Despacho y están listos para entrega."
      : activeTab === "domicilios"
        ? "Domicilios y envíos hacia/desde satélites y entregas a cliente."
        : "Historial de pedidos ya entregados, con dirección de entrega.";

  return (
    <AppLayout title="Despacho" subtitle={subtitle} eyebrow="Operación">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
            <TabButton
              active={activeTab === "listos"}
              onClick={() => setActiveTab("listos")}
              icon={PackageCheck}
              label={`Pedidos listos (${readyRows.length})`}
            />
            <TabButton
              active={activeTab === "domicilios"}
              onClick={() => setActiveTab("domicilios")}
              icon={Truck}
              label={`Domicilios (${shipmentRows.length})`}
            />
            <TabButton
              active={activeTab === "entregados"}
              onClick={() => setActiveTab("entregados")}
              icon={CheckCircle2}
              label={`Entregados (${deliveredRows.length})`}
            />
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeTab === "listos"
                  ? "Buscar pedido, cliente…"
                  : activeTab === "domicilios"
                    ? "Buscar envío, satélite…"
                    : "Buscar pedido, cliente, dirección…"
              }
              className="pl-8 h-9"
            />
          </div>
        </div>

        {busy ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando despachos…
          </div>
        ) : activeTab === "listos" ? (
          <ReadyOrdersTable
            rows={filteredReady}
            markingId={markingId}
            onMarkDelivered={openDeliverDialog}
            onPreview={(order) => setPreviewOrder(order)}
          />
        ) : activeTab === "domicilios" ? (
          <ShipmentsTable rows={filteredShipments} />
        ) : (
          <DeliveredOrdersTable
            rows={filteredDelivered}
            onPreview={(order) => setPreviewOrder(order)}
          />
        )}

        <DispatchDeliveryCostDialog
          open={Boolean(deliverDialogOrder)}
          orderShortId={
            deliverDialogOrder
              ? toDispatchReadyRow(deliverDialogOrder).shortId
              : undefined
          }
          customerName={deliverDialogOrder?.cliente_nombre}
          productName={deliverDialogOrder?.producto_nombre || undefined}
          saving={Boolean(deliverDialogOrder && markingId === deliverDialogOrder.id)}
          onCancel={() => {
            if (!markingId) setDeliverDialogOrder(null);
          }}
          onConfirm={confirmDeliverWithCost}
        />

        <DispatchOrderPreviewDialog
          open={Boolean(previewOrder)}
          onOpenChange={(open) => {
            if (!open) setPreviewOrder(null);
          }}
          order={previewOrder}
        />
      </div>
    </AppLayout>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof PackageCheck;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all rounded-t-lg shrink-0",
        active
          ? "border-red-600 text-red-600 dark:text-red-500 bg-red-50/30 dark:bg-red-950/20"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function ReadyOrdersTable({
  rows,
  markingId,
  onMarkDelivered,
  onPreview,
}: {
  rows: ReturnType<typeof toDispatchReadyRow>[];
  markingId: string | null;
  onMarkDelivered: (order: Order) => void;
  onPreview: (order: Order) => void;
}) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={PackageCheck}
        title="Sin pedidos para despacho"
        description="Cuando un pedido termine en el tablero «Para Despacho», aparecerá aquí automáticamente."
      />
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Pedido</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead className="text-center">Uds</TableHead>
            <TableHead className="text-right">Venta</TableHead>
            <TableHead className="text-center">Pago</TableHead>
            <TableHead className="text-center">Entrega est.</TableHead>
            <TableHead className="text-center">Estado</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const saving = markingId === row.order.id;
            return (
              <TableRow key={row.order.id}>
                <TableCell>
                  <div className="inline-flex items-center gap-1.5">
                    <span className="font-semibold">{row.shortId}</span>
                    <button
                      type="button"
                      title="Ver detalle para despacho"
                      onClick={() => onPreview(row.order)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Ver detalle</span>
                    </button>
                  </div>
                </TableCell>
                <TableCell>{row.order.cliente_nombre}</TableCell>
                <TableCell className="max-w-[220px] truncate">
                  {row.order.producto_nombre || "—"}
                </TableCell>
                <TableCell className="text-center tabular-nums">{row.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(row.order.valor_venta_proyectado)}
                </TableCell>
                <TableCell className="text-center text-xs font-medium">
                  {row.paymentLabel}
                </TableCell>
                <TableCell className="text-center text-sm">
                  {formatDate(row.dueDate)}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={row.order.estado} compact />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    disabled={saving}
                    onClick={() => onMarkDelivered(row.order)}
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Marcar entregado
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function DeliveredOrdersTable({
  rows,
  onPreview,
}: {
  rows: DispatchDeliveredOrder[];
  onPreview: (order: Order) => void;
}) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Sin pedidos entregados"
        description="Cuando marques un pedido como entregado desde Pedidos listos, quedará registrado aquí con su dirección."
      />
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Pedido</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead className="text-center">Uds</TableHead>
            <TableHead className="text-right">Venta</TableHead>
            <TableHead className="text-center">Pago</TableHead>
            <TableHead>Dirección</TableHead>
            <TableHead className="text-center">Entrega</TableHead>
            <TableHead className="text-center">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.order.id}>
              <TableCell>
                <div className="inline-flex items-center gap-1.5">
                  <span className="font-semibold">{row.shortId}</span>
                  <button
                    type="button"
                    title="Ver detalle del pedido entregado"
                    onClick={() => onPreview(row.order)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">Ver detalle</span>
                  </button>
                </div>
              </TableCell>
              <TableCell>{row.order.cliente_nombre}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {row.order.producto_nombre || "—"}
              </TableCell>
              <TableCell className="text-center tabular-nums">{row.quantity}</TableCell>
              <TableCell className="text-right tabular-nums">
                {money(row.order.valor_venta_proyectado)}
              </TableCell>
              <TableCell className="text-center text-xs font-medium">
                {row.paymentLabel}
              </TableCell>
              <TableCell className="max-w-[260px]">
                <div className="inline-flex items-start gap-1.5 text-sm">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="line-clamp-2" title={row.address}>
                    {row.address || "—"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-center text-sm whitespace-nowrap">
                {formatDate(row.deliveredAt || row.dueDate)}
              </TableCell>
              <TableCell className="text-center">
                <StatusBadge status={row.order.estado} compact />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ShipmentsTable({ rows }: { rows: DispatchShipmentRow[] }) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={Truck}
        title="Sin domicilios registrados"
        description="Aquí verás el costo de domicilio ida/vuelta y los movimientos logísticos hacia/desde satélites."
      />
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Pedido</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Flujo</TableHead>
            <TableHead>Contraparte</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Detalle</TableHead>
            <TableHead className="text-right">Costo</TableHead>
            <TableHead className="text-center">Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-semibold">{row.shortId}</TableCell>
              <TableCell>{row.customerName}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                  <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                  {row.directionLabel}
                </span>
              </TableCell>
              <TableCell>
                <div className="leading-tight">
                  <p className="text-sm font-medium">{row.counterpart}</p>
                  {row.address ? (
                    <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                      {row.address}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground capitalize">
                {row.source === "settlement"
                  ? "Satélite"
                  : row.source === "kanban"
                    ? "Kanban"
                    : "Costo real"}
              </TableCell>
              <TableCell className="text-sm max-w-[180px] truncate">
                {row.stageLabel}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {/* Solo domicilio: settlements no aportan costo de domicilio */}
                {row.source !== "settlement" && row.amount > 0
                  ? money(row.amount)
                  : "—"}
              </TableCell>
              <TableCell className="text-center text-sm tabular-nums whitespace-nowrap">
                {formatDateTime(row.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof PackageCheck;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-md">{description}</p>
    </div>
  );
}
