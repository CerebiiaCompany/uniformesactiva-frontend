import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const materials = [
  { id: "M-001", name: "Tela Oxford Azul", unit: "metros", stock: 450, minStock: 200, cost: 85 },
  { id: "M-002", name: "Tela Popelina Blanca", unit: "metros", stock: 120, minStock: 150, cost: 72 },
  { id: "M-003", name: "Hilo Industrial Negro", unit: "conos", stock: 80, minStock: 50, cost: 35 },
  { id: "M-004", name: "Botones 4 agujeros", unit: "gruesas", stock: 15, minStock: 20, cost: 45 },
  { id: "M-005", name: "Cierre YKK 18cm", unit: "piezas", stock: 300, minStock: 100, cost: 12 },
  { id: "M-006", name: "Entretela fusionable", unit: "metros", stock: 90, minStock: 80, cost: 55 },
  { id: "M-007", name: "Tela Gabardina Kaki", unit: "metros", stock: 60, minStock: 100, cost: 95 },
];

export default function Inventory() {
  return (
    <AppLayout title="Inventario" subtitle="Control de materias primas">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Materiales en stock</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Costo unit.</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((m) => {
                const isLow = m.stock < m.minStock;
                return (
                  <TableRow key={m.id} className={cn(isLow && "bg-destructive/5")}>
                    <TableCell className="font-semibold text-foreground">{m.id}</TableCell>
                    <TableCell className="text-foreground">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.unit}</TableCell>
                    <TableCell className={cn("text-right font-medium", isLow ? "text-destructive" : "text-foreground")}>{m.stock}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{m.minStock}</TableCell>
                    <TableCell className="text-right text-muted-foreground">${m.cost}</TableCell>
                    <TableCell>
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 rounded-full px-2 py-0.5">
                          <AlertTriangle className="h-3 w-3" /> Stock bajo
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-success bg-success/10 rounded-full px-2 py-0.5">Óptimo</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
