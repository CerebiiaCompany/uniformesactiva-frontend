import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { orders } from "@/data/mockData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

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
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Artículos</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Ingreso</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead>Estado de fábrica</TableHead>
                <TableHead>Entrega</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/50 cursor-pointer">
                  <TableCell className="font-semibold text-foreground">{order.id}</TableCell>
                  <TableCell className="text-muted-foreground">{order.customerName}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{order.items}</TableCell>
                  <TableCell className="text-right text-muted-foreground">${order.totalCost.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium text-foreground">${order.revenue.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <span className={order.margin >= 25 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                      {order.margin}%
                    </span>
                  </TableCell>
                  <TableCell><StatusBadge status={order.status} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{order.dueDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
