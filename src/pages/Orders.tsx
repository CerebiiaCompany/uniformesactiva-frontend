import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { orders } from "@/data/mockData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";

export default function Orders() {
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
                  <TableCell className="text-center text-muted-foreground">{order.customerName}</TableCell>
                  <TableCell className="text-center text-muted-foreground max-w-[200px] truncate">{order.items}</TableCell>
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
    </AppLayout>
  );
}
