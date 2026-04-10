import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { orders, Order } from "@/data/mockData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, FileText, Package, Ruler, Palette, Shirt, Layers, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Orders() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  return (
    <AppLayout title="Órdenes" subtitle="Gestión centralizada de órdenes">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Todas las órdenes</CardTitle>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1" /> Nueva orden
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">ID</TableHead>
                <TableHead className="text-center">Fecha de inicio</TableHead>
                <TableHead className="text-center">Cliente</TableHead>
                <TableHead className="text-center">Artículos</TableHead>
                <TableHead className="text-center">Costo</TableHead>
                <TableHead className="text-center">Ingreso</TableHead>
                <TableHead className="text-center">Margen</TableHead>
                <TableHead className="text-center">Estado de fábrica</TableHead>
                <TableHead className="text-center">Estado de pago</TableHead>
                <TableHead className="text-center">Entrega</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/50 cursor-pointer">
                  <TableCell className="text-center font-semibold text-foreground">{order.id}</TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">{order.createdAt}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{order.customerName}</TableCell>
                  <TableCell className="text-center max-w-[200px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-medium text-foreground text-sm">
                        {order.items.replace(/^\d+\s*/, '')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-primary hover:text-primary/80"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                      >
                        Más detalles
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">${order.totalCost.toLocaleString()}</TableCell>
                  <TableCell className="text-center font-medium text-foreground">${order.revenue.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <span className={order.margin >= 25 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                      {order.margin}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center"><StatusBadge status={order.status} /></TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {order.paymentStatus === "si" ? (
                        <>
                          <span className="inline-flex items-center rounded-full bg-success/15 text-success px-2.5 py-0.5 text-[11px] font-semibold">
                            SÍ
                          </span>
                          {order.paymentReceipt && (
                            <button
                              title="Ver comprobante"
                              className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-destructive/15 text-destructive px-2.5 py-0.5 text-[11px] font-semibold">
                          NO
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">{order.dueDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de detalles de artículos */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Artículos — {selectedOrder?.id}
            </DialogTitle>
            <DialogDescription>
              {selectedOrder?.customerName} · {selectedOrder?.quantity} unidades totales
            </DialogDescription>
          </DialogHeader>

          {selectedOrder?.productVariations.map((variation, idx) => (
            <div key={variation.id}>
              {idx > 0 && <Separator className="my-3" />}
              <div className="space-y-3">
                {/* Tipo de producto destacado */}
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/15 text-primary border-primary/30 text-sm font-bold px-3 py-1">
                    {variation.productType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">#{variation.id}</span>
                </div>

                {/* Variación del producto */}
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Variación</p>
                  <p className="font-semibold text-foreground">{variation.variation}</p>
                </div>

                {/* Grid de detalles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="flex items-start gap-2 rounded-md border border-border p-2.5">
                    <Layers className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Material</p>
                      <p className="text-sm font-medium text-foreground">{variation.material}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-border p-2.5">
                    <Ruler className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Talla</p>
                      <p className="text-sm font-medium text-foreground">{variation.size}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-border p-2.5">
                    <Palette className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Color</p>
                      <p className="text-sm font-medium text-foreground">{variation.color}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-border p-2.5">
                    <Shirt className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Estampado</p>
                      <p className="text-sm font-medium text-foreground">{variation.print}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-border p-2.5">
                    <Hash className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Cantidad</p>
                      <p className="text-sm font-medium text-foreground">{variation.quantity} uds</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-border p-2.5">
                    <span className="text-muted-foreground mt-0.5 shrink-0 text-xs font-bold">$</span>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Costo unitario</p>
                      <p className="text-sm font-medium text-foreground">${variation.unitCost.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
