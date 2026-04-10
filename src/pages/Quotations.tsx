import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { quotations } from "@/data/mockData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Quotations() {
  return (
    <AppLayout title="Cotizaciones" subtitle="Gestión de cotizaciones y propuestas">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Cotizaciones</CardTitle>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1" /> Nueva cotización
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Artículos</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creación</TableHead>
                <TableHead>Validez</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((q) => (
                <TableRow key={q.id} className="hover:bg-muted/50 cursor-pointer">
                  <TableCell className="font-semibold text-foreground">{q.id}</TableCell>
                  <TableCell className="text-muted-foreground">{q.customerName}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{q.items}</TableCell>
                  <TableCell className="text-right font-medium text-foreground">${q.totalAmount.toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={q.status} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{q.createdAt}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{q.validUntil}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
