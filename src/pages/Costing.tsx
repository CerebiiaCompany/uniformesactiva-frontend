import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  Calculator,
  Boxes,
  Package,
  Users,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-number";
import { useOrders, type Order } from "@/hooks/useOrders";
import { useDashboard } from "@/hooks/useDashboard";
import { useGetCostCatalogs } from "@/hooks/useGetCostCatalogs";
import { useGetProductLines } from "@/hooks/useGetProductLines";
import { useGetMaterials } from "@/hooks/useGetMaterials";

const fmt = (n: number) => `$${formatCurrency(n)}`;

function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function marginPct(order: Order): number {
  // Backend stores margen_ganancia as fraction (0.25 = 25%)
  const raw = num(order.margen_ganancia);
  return raw <= 1 && raw >= -1 ? raw * 100 : raw;
}

function shortOrderId(id: string) {
  return `ORD-${id.slice(-3).toUpperCase()}`;
}

function orderQty(order: Order): number {
  return (order.items || []).reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
}

function unitCost(order: Order): number {
  const qty = orderQty(order);
  const total = num(order.costo_total);
  return qty > 0 ? total / qty : total;
}

export default function Costing() {
  const { stats, loading: dashLoading } = useDashboard();
  const { orders, loading: ordersLoading, fetchOrders, totalCount } = useOrders();
  const {
    supplyTypes,
    laborPhases,
    proveedores,
    isLoading: catalogsLoading,
  } = useGetCostCatalogs();
  const { lines, isLoading: linesLoading } = useGetProductLines();
  const { materials: inventory, isLoading: inventoryLoading } = useGetMaterials();

  useEffect(() => {
    fetchOrders({ page: 1, page_size: 100 });
  }, [fetchOrders]);

  const totals = useMemo(() => {
    const costo = orders.reduce((s, o) => s + num(o.costo_total), 0);
    const ingreso = orders.reduce((s, o) => s + num(o.valor_venta_proyectado), 0);
    const ganancia = orders.reduce((s, o) => s + num(o.ganancia), 0);
    const margins = orders.map(marginPct).filter((m) => Number.isFinite(m));
    const avgMargin =
      margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
    return { costo, ingreso, ganancia, avgMargin };
  }, [orders]);

  const monthlyCost =
    stats != null ? Math.max(0, num(stats.monthlyRevenue) - num(stats.monthlyProfit)) : totals.costo;

  const loading = dashLoading || ordersLoading;

  return (
    <AppLayout
      title="Costos"
      subtitle="Rentabilidad de órdenes y catálogos reales (tela/insumos/MO por variante en Productos)"
    >
      <div className="space-y-6">
        <div className="rounded-lg border border-sky-200/80 bg-sky-50/50 px-3 py-2.5 flex gap-2 text-xs text-sky-900 dark:bg-sky-950/20 dark:border-sky-900/40 dark:text-sky-200">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            El costeo unitario por variante (tela, insumos, mano de obra, consumo por talla y precio
            de venta) se configura en{" "}
            <Link to="/lines" className="font-semibold underline underline-offset-2">
              Productos → línea → producto → variante
            </Link>
            . Esta vista muestra datos operativos desde la base de datos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Costo mes (órdenes)"
            value={loading ? "…" : fmt(stats ? monthlyCost : totals.costo)}
            icon={DollarSign}
            variant="default"
          />
          <StatCard
            title="Ingresos mes"
            value={loading ? "…" : fmt(stats?.monthlyRevenue ?? totals.ingreso)}
            icon={TrendingUp}
            variant="accent"
          />
          <StatCard
            title="Ganancia mes"
            value={loading ? "…" : fmt(stats?.monthlyProfit ?? totals.ganancia)}
            icon={TrendingUp}
            variant="success"
          />
          <StatCard
            title="Margen promedio"
            value={
              loading
                ? "…"
                : `${(stats?.avgMargin ?? totals.avgMargin).toFixed(1)}%`
            }
            icon={Calculator}
            variant="warning"
          />
        </div>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto gap-1">
            <TabsTrigger value="orders" className="text-xs sm:text-sm">
              <Calculator className="h-4 w-4 mr-1" />
              Órdenes
            </TabsTrigger>
            <TabsTrigger value="products" className="text-xs sm:text-sm">
              <Boxes className="h-4 w-4 mr-1" />
              Productos
            </TabsTrigger>
            <TabsTrigger value="materials" className="text-xs sm:text-sm">
              <Package className="h-4 w-4 mr-1" />
              Insumos
            </TabsTrigger>
            <TabsTrigger value="labor" className="text-xs sm:text-sm">
              <Users className="h-4 w-4 mr-1" />
              Fases MO
            </TabsTrigger>
            <TabsTrigger value="profit" className="text-xs sm:text-sm">
              <TrendingUp className="h-4 w-4 mr-1" />
              Rentabilidad
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-4">
            <OrdersTab orders={orders} loading={ordersLoading} totalCount={totalCount} />
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <ProductsTab lines={lines} loading={linesLoading} />
          </TabsContent>

          <TabsContent value="materials" className="mt-4">
            <MaterialsTab
              supplyTypes={supplyTypes}
              inventory={inventory}
              loading={catalogsLoading || inventoryLoading}
            />
          </TabsContent>

          <TabsContent value="labor" className="mt-4">
            <LaborTab
              laborPhases={laborPhases}
              proveedoresCount={proveedores.length}
              loading={catalogsLoading}
            />
          </TabsContent>

          <TabsContent value="profit" className="mt-4">
            <ProfitTab orders={orders} loading={ordersLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function OrdersTab({
  orders,
  loading,
  totalCount,
}: {
  orders: Order[];
  loading: boolean;
  totalCount: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-sm font-semibold">Costo real por orden</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Valores calculados al crear/actualizar la orden (costo_total, ganancia, margen).
            {totalCount > orders.length
              ? ` Mostrando ${orders.length} de ${totalCount}.`
              : null}
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            No hay órdenes registradas.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Costo unit.</TableHead>
                <TableHead className="text-right">Costo total</TableHead>
                <TableHead className="text-right">Ingreso</TableHead>
                <TableHead className="text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const m = marginPct(o);
                const qty = orderQty(o);
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-semibold">{shortOrderId(o.id)}</TableCell>
                    <TableCell>{o.cliente_nombre}</TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {o.producto_nombre || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{qty || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {fmt(unitCost(o))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmt(num(o.costo_total))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmt(num(o.valor_venta_proyectado))}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-bold tabular-nums",
                        m >= 25
                          ? "text-emerald-700"
                          : m >= 15
                            ? "text-amber-700"
                            : "text-destructive"
                      )}
                    >
                      {m.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ProductsTab({
  lines,
  loading,
}: {
  lines: { id: string; code: string; name: string; products_count?: number }[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Líneas y costeo por variante</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          El costo unitario no se define aquí: se arma por variante (tela + insumos + MO + consumo
          por talla) en la ficha del producto.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : lines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            No hay líneas de producto.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Línea</TableHead>
                <TableHead className="text-right">Productos</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-semibold">{line.code}</TableCell>
                  <TableCell>{line.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.products_count ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline" className="h-8">
                      <Link to={`/products?lineCode=${encodeURIComponent(line.code)}`}>
                        Abrir
                        <ExternalLink className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function MaterialsTab({
  supplyTypes,
  inventory,
  loading,
}: {
  supplyTypes: {
    id: string;
    name: string;
    label?: string;
    categoria?: string;
    unidad_medida?: string;
    precio_unitario_default?: number | string | null;
    codigo_sku?: string;
    proveedor_marca?: string;
    stock_minimo?: number | string | null;
    stock_inicial?: number | string | null;
  }[];
  inventory: {
    id: string;
    name: string;
    stock: number;
    min_stock: number;
    is_low_stock: boolean;
  }[];
  loading: boolean;
}) {
  const stockByName = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const item of inventory) {
      map.set(item.name.trim().toLowerCase(), item);
    }
    return map;
  }, [inventory]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Tipos de insumo (catálogo)</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Catálogo maestro desde BD. El stock operativo vive en Inventario; el precio usado en
          costeo de una variante se define al asignar el insumo a esa variante.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : supplyTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            No hay tipos de insumo. Créalos desde el costeo de una variante o desde Inventario.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Precio ref.</TableHead>
                <TableHead className="text-right">Stock inv.</TableHead>
                <TableHead className="text-right">Mín.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplyTypes.map((s) => {
                const inv = stockByName.get((s.name || "").trim().toLowerCase());
                const low = Boolean(inv?.is_low_stock);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.label || s.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {s.codigo_sku || "—"}
                    </TableCell>
                    <TableCell>
                      {s.categoria ? (
                        <Badge variant="secondary">{s.categoria}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{s.unidad_medida || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.precio_unitario_default != null && s.precio_unitario_default !== ""
                        ? fmt(num(s.precio_unitario_default))
                        : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        low && "text-amber-700 font-semibold"
                      )}
                    >
                      {inv ? (
                        <span className="inline-flex items-center gap-1 justify-end">
                          {low && <AlertTriangle className="h-3.5 w-3.5" />}
                          {inv.stock}
                        </span>
                      ) : s.stock_inicial != null && s.stock_inicial !== "" ? (
                        num(s.stock_inicial)
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {inv
                        ? inv.min_stock
                        : s.stock_minimo != null && s.stock_minimo !== ""
                          ? num(s.stock_minimo)
                          : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LaborTab({
  laborPhases,
  proveedoresCount,
  loading,
}: {
  laborPhases: { id: string; name: string; label?: string }[];
  proveedoresCount: number;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Fases de mano de obra (catálogo)</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Catálogo desde BD. El costo por pieza (cantidad × precio unitario) se asigna por
            variante en Productos. No hay tarifas por hora almacenadas.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : laborPhases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No hay fases registradas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laborPhases.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.label || f.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          Proveedores de tela registrados:{" "}
          <span className="font-semibold text-foreground">{proveedoresCount}</span>
          . Se usan al cargar costos de tela por variante.
        </CardContent>
      </Card>
    </div>
  );
}

function ProfitTab({ orders, loading }: { orders: Order[]; loading: boolean }) {
  const ranked = useMemo(
    () =>
      [...orders].sort((a, b) => marginPct(b) - marginPct(a)),
    [orders]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Rentabilidad por orden</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Ordenado por margen real almacenado en cada orden.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin datos.</p>
        ) : (
          ranked.map((o) => {
            const m = marginPct(o);
            const width = Math.min(100, Math.max(0, (m / 40) * 100));
            return (
              <div key={o.id} className="space-y-1">
                <div className="flex justify-between text-sm gap-2">
                  <span className="truncate">
                    <span className="font-semibold">{shortOrderId(o.id)}</span>
                    {" · "}
                    {o.cliente_nombre}
                  </span>
                  <span
                    className={cn(
                      "font-bold shrink-0",
                      m >= 25
                        ? "text-emerald-700"
                        : m >= 20
                          ? "text-amber-700"
                          : "text-destructive"
                    )}
                  >
                    {m.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      m >= 25
                        ? "bg-emerald-600"
                        : m >= 20
                          ? "bg-amber-500"
                          : "bg-destructive"
                    )}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Costo {fmt(num(o.costo_total))}</span>
                  <span>Ingreso {fmt(num(o.valor_venta_proyectado))}</span>
                  <span>Ganancia {fmt(num(o.ganancia))}</span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
