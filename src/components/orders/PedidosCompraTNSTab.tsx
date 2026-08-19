import React, { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ShoppingBag,
  Package,
  Calendar,
  AlertCircle,
  FileText,
  SlidersHorizontal,
  X,
  CheckCircle2,
  Clock,
  Ban,
  Building2,
  DollarSign,
  Layers,
} from "lucide-react";
import { usePedidosCompraTNS } from "@/hooks/usePedidosCompraTNS";
import {
  getPedidoNumDoc,
  getPedidoProveedor,
  getPedidoNit,
  getPedidoFecha,
  getPedidoFechaEntrega,
  getPedidoEstado,
  getPedidoConcepto,
  getPedidoTotal,
  getPedidoSubtotal,
  getPedidoDetalles,
  getDetalleCodigo,
  getDetalleDescripcion,
  getDetalleUnidad,
  getDetalleCantidad,
  getDetalleRecibido,
  getDetallePendiente,
  getDetalleValorUnitario,
  getDetalleTotal,
} from "@/services/tnsService";
import { formatCurrency } from "@/lib/format-number";
import { cn } from "@/lib/utils";

const formatMoney = (value: number) => formatCurrency(value);

function EstadoBadge({ estado }: { estado: string }) {
  const norm = (estado || "").toUpperCase().trim();

  if (norm.includes("APROB") || norm.includes("AUTORIZ") || norm === "A") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        {estado || "Aprobado"}
      </span>
    );
  }

  if (norm.includes("PEND") || norm === "P") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
        <Clock className="h-3 w-3" />
        {estado || "Pendiente"}
      </span>
    );
  }

  if (norm.includes("ANUL") || norm === "X" || norm === "CANC") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/60 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:text-red-300">
        <Ban className="h-3 w-3" />
        {estado || "Anulado"}
      </span>
    );
  }

  if (norm.includes("CERR") || norm === "C" || norm.includes("FACT")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
        <Package className="h-3 w-3" />
        {estado || "Cerrado"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
      {estado || "Activo"}
    </span>
  );
}

export function PedidosCompraTNSTab() {
  const {
    pedidos,
    loading,
    error,
    totalCount,
    filters,
    updateFilters,
    clearFilters,
    refresh,
    expandedRows,
    toggleRow,
    expandAll,
    collapseAll,
  } = usePedidosCompraTNS(true);

  // Estadísticas calculadas sobre los pedidos cargados
  const stats = useMemo(() => {
    let totalMonto = 0;
    const proveedoresSet = new Set<string>();
    let totalItems = 0;

    pedidos.forEach((p) => {
      totalMonto += getPedidoTotal(p);
      const prov = getPedidoProveedor(p);
      if (prov && prov !== "—") proveedoresSet.add(prov);
      const detalles = getPedidoDetalles(p);
      detalles.forEach((d) => {
        totalItems += getDetalleCantidad(d);
      });
    });

    return {
      totalMonto,
      totalProveedores: proveedoresSet.size,
      totalItems,
      count: pedidos.length,
    };
  }, [pedidos]);

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.fecha_inicio ||
      filters.fecha_fin ||
      (filters.estado && filters.estado !== "todos")
  );

  return (
    <div className="space-y-4">
      {/* Tarjetas de Resumen Superior */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card shadow-sm border-border">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Pedidos</p>
              <p className="text-xl font-bold text-foreground mt-0.5">
                {loading ? "..." : totalCount || pedidos.length}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Valor Total Pedidos</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {loading ? "..." : formatMoney(stats.totalMonto)}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Proveedores Únicos</p>
              <p className="text-xl font-bold text-foreground mt-0.5">
                {loading ? "..." : stats.totalProveedores}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-600">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Unidades en Pedidos</p>
              <p className="text-xl font-bold text-foreground mt-0.5">
                {loading ? "..." : Math.round(stats.totalItems)}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenedor Principal de la Tabla con Filtros */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Pedidos de Compra (TNS)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Consulta en tiempo real de órdenes y pedidos de compra registrados en el ERP TNS.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={expandAll}
              disabled={loading || pedidos.length === 0}
              className="text-xs h-8"
              title="Desplegar el detalle de todos los pedidos"
            >
              <ChevronDown className="h-3.5 w-3.5 mr-1" /> Expandir Todo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAll}
              disabled={loading || pedidos.length === 0}
              className="text-xs h-8"
              title="Ocultar todos los detalles"
            >
              <ChevronRight className="h-3.5 w-3.5 mr-1" /> Colapsar
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="text-xs h-8 gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Barra de Filtros */}
          <div className="flex flex-wrap items-end gap-2.5 p-3 border-b border-border bg-muted/10">
            {/* Buscar */}
            <div className="flex-1 min-w-[200px] max-w-sm space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Proveedor, N° documento, concepto..."
                  className="h-9 text-sm pl-8 pr-2"
                  value={filters.search || ""}
                  onChange={(e) => updateFilters({ search: e.target.value })}
                />
              </div>
            </div>

            {/* Estado */}
            <div className="w-[140px] space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Estado</Label>
              <Select
                value={filters.estado || "todos"}
                onValueChange={(v) => updateFilters({ estado: v })}
              >
                <SelectTrigger className="h-9 text-sm px-2.5">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="APROBADO">Aprobado</SelectItem>
                  <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  <SelectItem value="CERRADO">Cerrado</SelectItem>
                  <SelectItem value="ANULADO">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha Inicio */}
            <div className="w-[150px] space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Fecha desde</Label>
              <Input
                type="date"
                className="h-9 text-sm px-2.5 py-1"
                value={filters.fecha_inicio || ""}
                onChange={(e) => updateFilters({ fecha_inicio: e.target.value })}
              />
            </div>

            {/* Fecha Fin */}
            <div className="w-[150px] space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Fecha hasta</Label>
              <Input
                type="date"
                className="h-9 text-sm px-2.5 py-1"
                value={filters.fecha_fin || ""}
                onChange={(e) => updateFilters({ fecha_fin: e.target.value })}
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Limpiar
              </Button>
            )}
          </div>

          {/* Mensaje de Error si aplica */}
          {error && (
            <div className="m-4 p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 flex items-start gap-2.5 text-xs text-red-800 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Error al consultar TNS</p>
                <p className="mt-0.5">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                className="h-7 text-xs border-red-300 dark:border-red-800 hover:bg-red-100"
              >
                Reintentar
              </Button>
            </div>
          )}

          {/* Tabla de Pedidos */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10 text-center px-2 py-3" />
                  <TableHead className="font-semibold text-xs py-3">N° Pedido</TableHead>
                  <TableHead className="font-semibold text-xs py-3">Fecha</TableHead>
                  <TableHead className="font-semibold text-xs py-3">Entrega</TableHead>
                  <TableHead className="font-semibold text-xs py-3">Proveedor / Tercero</TableHead>
                  <TableHead className="font-semibold text-xs py-3">Concepto / Detalle</TableHead>
                  <TableHead className="font-semibold text-xs text-center py-3">Estado</TableHead>
                  <TableHead className="font-semibold text-xs text-right py-3 pr-4">Total</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-xs">Consultando pedidos de compra en TNS...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : pedidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-foreground">
                          No se encontraron pedidos de compra
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          {hasActiveFilters
                            ? "Prueba cambiando o limpiando los filtros de búsqueda y fechas."
                            : "No hay registros de pedidos de compra disponibles en TNS para el periodo actual."}
                        </p>
                        {hasActiveFilters && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                            className="mt-2 text-xs h-8"
                          >
                            Limpiar filtros
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pedidos.map((pedido, idx) => {
                    const numDoc = getPedidoNumDoc(pedido);
                    const rowKey = numDoc || String(idx);
                    const isExpanded = Boolean(expandedRows[rowKey]);
                    const detalles = getPedidoDetalles(pedido);
                    const proveedor = getPedidoProveedor(pedido);
                    const nit = getPedidoNit(pedido);
                    const fecha = getPedidoFecha(pedido);
                    const fechaEntrega = getPedidoFechaEntrega(pedido);
                    const estado = getPedidoEstado(pedido);
                    const concepto = getPedidoConcepto(pedido);
                    const total = getPedidoTotal(pedido);

                    return (
                      <React.Fragment key={rowKey}>
                        <TableRow
                          onClick={() => toggleRow(rowKey)}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-muted/50 border-b border-border/60",
                            isExpanded && "bg-muted/30 font-medium"
                          )}
                        >
                          <TableCell className="text-center px-2 py-3">
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={isExpanded ? "Colapsar detalles" : "Expandir detalles"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-primary" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </TableCell>

                          <TableCell className="font-semibold text-xs py-3 text-primary">
                            <span className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded text-primary">
                              {numDoc}
                            </span>
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground py-3 whitespace-nowrap">
                            {fecha}
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground py-3 whitespace-nowrap">
                            {fechaEntrega}
                          </TableCell>

                          <TableCell className="text-xs py-3 max-w-[220px]">
                            <div className="font-medium text-foreground truncate" title={proveedor}>
                              {proveedor}
                            </div>
                            {nit ? (
                              <div className="text-[11px] text-muted-foreground font-mono">
                                NIT: {nit}
                              </div>
                            ) : null}
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground py-3 max-w-[240px] truncate" title={concepto}>
                            {concepto}
                          </TableCell>

                          <TableCell className="text-center py-3">
                            <EstadoBadge estado={estado} />
                          </TableCell>

                          <TableCell className="text-right text-xs font-bold text-foreground py-3 pr-4 tabular-nums">
                            {formatMoney(total)}
                          </TableCell>
                        </TableRow>

                        {/* Fila desplegable con el detalle del pedido */}
                        {isExpanded && (
                          <TableRow className="bg-muted/15 hover:bg-muted/15 border-b border-border">
                            <TableCell colSpan={8} className="p-0">
                              <div className="p-3.5 pl-10 pr-6 space-y-3 bg-muted/20 border-t border-dashed border-border/70">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                                      Detalle de Ítems del Pedido {numDoc}
                                    </span>
                                    <span className="text-[11px] bg-background border px-2 py-0.5 rounded-full text-muted-foreground">
                                      {detalles.length} {detalles.length === 1 ? "artículo" : "artículos"}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                    {nit && (
                                      <span>
                                        Proveedor: <strong className="text-foreground">{proveedor}</strong> ({nit})
                                      </span>
                                    )}
                                    {pedido.telefono && (
                                      <span>Tel: <strong className="text-foreground">{pedido.telefono}</strong></span>
                                    )}
                                    {pedido.dirTercero && (
                                      <span>Dir: <strong className="text-foreground">{pedido.dirTercero}</strong></span>
                                    )}
                                  </div>
                                </div>

                                {detalles.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic py-2">
                                    No se encontraron líneas de detalle para este pedido de compra.
                                  </p>
                                ) : (
                                  <div className="rounded-lg border border-border overflow-hidden bg-card shadow-xs">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-muted/40 text-[11px]">
                                          <TableHead className="py-2 font-semibold">Código</TableHead>
                                          <TableHead className="py-2 font-semibold">Descripción del Artículo</TableHead>
                                          <TableHead className="py-2 font-semibold text-center">Unidad</TableHead>
                                          <TableHead className="py-2 font-semibold text-right">Cant. Pedida</TableHead>
                                          <TableHead className="py-2 font-semibold text-right">Cant. Recibida</TableHead>
                                          <TableHead className="py-2 font-semibold text-right">Cant. Pendiente</TableHead>
                                          <TableHead className="py-2 font-semibold text-right">Valor Unitario</TableHead>
                                          <TableHead className="py-2 font-semibold text-right pr-3">Total Ítem</TableHead>
                                        </TableRow>
                                      </TableHeader>

                                      <TableBody>
                                        {detalles.map((item, itemIdx) => {
                                          const codigo = getDetalleCodigo(item);
                                          const descrip = getDetalleDescripcion(item);
                                          const unidad = getDetalleUnidad(item);
                                          const cant = getDetalleCantidad(item);
                                          const cantRec = getDetalleRecibido(item);
                                          const cantPen = getDetallePendiente(item);
                                          const valUnit = getDetalleValorUnitario(item);
                                          const itemTotal = getDetalleTotal(item);

                                          return (
                                            <TableRow
                                              key={`${rowKey}-item-${itemIdx}`}
                                              className="text-xs hover:bg-muted/30"
                                            >
                                              <TableCell className="font-mono text-[11px] text-muted-foreground py-2">
                                                {codigo}
                                              </TableCell>

                                              <TableCell className="py-2 font-medium text-foreground">
                                                <div>{descrip}</div>
                                                {item.observacionDetalle ? (
                                                  <div className="text-[11px] text-muted-foreground font-normal italic">
                                                    Obs: {item.observacionDetalle}
                                                  </div>
                                                ) : null}
                                              </TableCell>

                                              <TableCell className="text-center text-muted-foreground py-2">
                                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-mono">
                                                  {unidad}
                                                </span>
                                              </TableCell>

                                              <TableCell className="text-right font-semibold tabular-nums py-2">
                                                {cant}
                                              </TableCell>

                                              <TableCell className="text-right tabular-nums text-muted-foreground py-2">
                                                {cantRec > 0 ? (
                                                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                                    {cantRec}
                                                  </span>
                                                ) : (
                                                  "0"
                                                )}
                                              </TableCell>

                                              <TableCell className="text-right tabular-nums py-2">
                                                {cantPen > 0 ? (
                                                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                                                    {cantPen}
                                                  </span>
                                                ) : (
                                                  "0"
                                                )}
                                              </TableCell>

                                              <TableCell className="text-right text-muted-foreground tabular-nums py-2">
                                                {formatMoney(valUnit)}
                                              </TableCell>

                                              <TableCell className="text-right font-bold text-foreground tabular-nums py-2 pr-3">
                                                {formatMoney(itemTotal)}
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
