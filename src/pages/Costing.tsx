import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertTriangle, Plus, Pencil, Trash2, Package, Users, Wrench, Boxes, Calculator } from "lucide-react";
import { orders } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============ Types ============
interface Material {
  id: string;
  name: string;
  unit: string; // metros, piezas, kg, etc.
  cost: number; // costo por unidad
  stock: number;
}
interface Labor {
  id: string;
  role: string;
  hourlyRate: number;
}
interface ProcessService {
  id: string;
  name: string;
  costPerUnit: number;
  estimatedMinutes: number; // tiempo estándar
}
interface ProductMaterial { materialId: string; quantity: number; }
interface ProductLabor { laborId: string; hours: number; }
interface ProductProcess { processId: string; }
interface Product {
  id: string;
  name: string;
  variant: string;
  materials: ProductMaterial[];
  labor: ProductLabor[];
  processes: ProductProcess[];
  overhead: number; // costos indirectos fijos
  suggestedPrice: number;
}

// ============ Seed data ============
const seedMaterials: Material[] = [
  { id: "M-001", name: "Tela Oxford Azul", unit: "metros", cost: 85, stock: 450 },
  { id: "M-002", name: "Tela Popelina Blanca", unit: "metros", cost: 72, stock: 120 },
  { id: "M-003", name: "Hilo Industrial Negro", unit: "conos", cost: 35, stock: 80 },
  { id: "M-004", name: "Botones 4 agujeros", unit: "gruesas", cost: 45, stock: 15 },
  { id: "M-005", name: "Cierre YKK 18cm", unit: "piezas", cost: 12, stock: 300 },
  { id: "M-006", name: "Entretela fusionable", unit: "metros", cost: 55, stock: 90 },
];
const seedLabor: Labor[] = [
  { id: "L-001", role: "Cortador", hourlyRate: 65 },
  { id: "L-002", role: "Costurero", hourlyRate: 70 },
  { id: "L-003", role: "Bordador", hourlyRate: 85 },
  { id: "L-004", role: "Control de calidad", hourlyRate: 60 },
];
const seedProcesses: ProcessService[] = [
  { id: "P-001", name: "Diseño", costPerUnit: 8, estimatedMinutes: 5 },
  { id: "P-002", name: "Corte", costPerUnit: 6, estimatedMinutes: 4 },
  { id: "P-003", name: "Confección", costPerUnit: 18, estimatedMinutes: 20 },
  { id: "P-004", name: "Bordado", costPerUnit: 14, estimatedMinutes: 10 },
  { id: "P-005", name: "Calidad", costPerUnit: 4, estimatedMinutes: 3 },
  { id: "P-006", name: "Empaque", costPerUnit: 3, estimatedMinutes: 2 },
];
const seedProducts: Product[] = [
  {
    id: "PRD-001", name: "Polo corporativo", variant: "Manga corta - Algodón",
    materials: [{ materialId: "M-001", quantity: 0.6 }, { materialId: "M-003", quantity: 0.05 }],
    labor: [{ laborId: "L-002", hours: 0.4 }],
    processes: [{ processId: "P-002" }, { processId: "P-003" }, { processId: "P-005" }],
    overhead: 8, suggestedPrice: 170,
  },
  {
    id: "PRD-002", name: "Bata médica", variant: "Antifluido",
    materials: [{ materialId: "M-002", quantity: 1.2 }, { materialId: "M-005", quantity: 1 }],
    labor: [{ laborId: "L-002", hours: 0.6 }, { laborId: "L-004", hours: 0.1 }],
    processes: [{ processId: "P-001" }, { processId: "P-003" }, { processId: "P-005" }, { processId: "P-006" }],
    overhead: 12, suggestedPrice: 225,
  },
];

// ============ Helpers ============
const fmt = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`;

export default function Costing() {
  const [materials, setMaterials] = useState<Material[]>(seedMaterials);
  const [labor, setLabor] = useState<Labor[]>(seedLabor);
  const [processes, setProcesses] = useState<ProcessService[]>(seedProcesses);
  const [products, setProducts] = useState<Product[]>(seedProducts);

  // ===== Real cost calculator =====
  const computeUnitCost = (p: Product) => {
    const mat = p.materials.reduce((s, pm) => {
      const m = materials.find((x) => x.id === pm.materialId);
      return s + (m ? m.cost * pm.quantity : 0);
    }, 0);
    const lab = p.labor.reduce((s, pl) => {
      const l = labor.find((x) => x.id === pl.laborId);
      return s + (l ? l.hourlyRate * pl.hours : 0);
    }, 0);
    const proc = p.processes.reduce((s, pp) => {
      const pr = processes.find((x) => x.id === pp.processId);
      return s + (pr ? pr.costPerUnit : 0);
    }, 0);
    return { mat, lab, proc, overhead: p.overhead, total: mat + lab + proc + p.overhead };
  };

  // ===== Rentabilidad mensual =====
  const totalRevenue = orders.reduce((s, o) => s + o.revenue, 0);
  const totalCost = orders.reduce((s, o) => s + o.totalCost, 0);
  const totalProfit = totalRevenue - totalCost;
  const avgMargin = orders.reduce((s, o) => s + o.margin, 0) / orders.length;

  return (
    <AppLayout title="Costos" subtitle="Carga de costos, cálculo unitario real y rentabilidad">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Costo total mes" value={fmt(totalCost)} icon={DollarSign} variant="default" />
          <StatCard title="Ingresos mes" value={fmt(totalRevenue)} icon={TrendingUp} variant="accent" />
          <StatCard title="Ganancia mes" value={fmt(totalProfit)} icon={TrendingUp} variant="success" />
          <StatCard title="Margen promedio" value={`${avgMargin.toFixed(1)}%`} icon={Calculator} variant="warning" />
        </div>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="orders"><Calculator className="h-4 w-4 mr-1" />Pedidos</TabsTrigger>
            <TabsTrigger value="products"><Boxes className="h-4 w-4 mr-1" />Productos</TabsTrigger>
            <TabsTrigger value="materials"><Package className="h-4 w-4 mr-1" />Materiales</TabsTrigger>
            <TabsTrigger value="labor"><Users className="h-4 w-4 mr-1" />Mano de obra</TabsTrigger>
            <TabsTrigger value="processes"><Wrench className="h-4 w-4 mr-1" />Procesos</TabsTrigger>
            <TabsTrigger value="profit"><TrendingUp className="h-4 w-4 mr-1" />Rentabilidad</TabsTrigger>
          </TabsList>

          {/* ===== Pedidos: costo unitario real ===== */}
          <TabsContent value="orders" className="mt-4">
            <OrdersCostingTab products={products} computeUnitCost={computeUnitCost} />
          </TabsContent>

          {/* ===== Productos ===== */}
          <TabsContent value="products" className="mt-4">
            <ProductsTab
              products={products} setProducts={setProducts}
              materials={materials} labor={labor} processes={processes}
              computeUnitCost={computeUnitCost}
            />
          </TabsContent>

          {/* ===== Materiales ===== */}
          <TabsContent value="materials" className="mt-4">
            <MaterialsTab materials={materials} setMaterials={setMaterials} />
          </TabsContent>

          {/* ===== Mano de obra ===== */}
          <TabsContent value="labor" className="mt-4">
            <LaborTab labor={labor} setLabor={setLabor} />
          </TabsContent>

          {/* ===== Procesos / servicios ===== */}
          <TabsContent value="processes" className="mt-4">
            <ProcessesTab processes={processes} setProcesses={setProcesses} />
          </TabsContent>

          {/* ===== Rentabilidad mes ===== */}
          <TabsContent value="profit" className="mt-4">
            <ProfitTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ============================================================
// Pedidos: cálculo automático de costo unitario real por pedido
// ============================================================
function OrdersCostingTab({ products, computeUnitCost }: { products: Product[]; computeUnitCost: (p: Product) => { mat: number; lab: number; proc: number; overhead: number; total: number } }) {
  const [selectedProduct, setSelectedProduct] = useState<Record<string, string>>({});

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Costo unitario real por pedido</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Producto base</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="text-right">Costo unit. real</TableHead>
              <TableHead className="text-right">Costo total</TableHead>
              <TableHead className="text-right">Ingreso</TableHead>
              <TableHead className="text-right">Margen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const prodId = selectedProduct[o.id] ?? products[0]?.id;
              const product = products.find((p) => p.id === prodId);
              const unit = product ? computeUnitCost(product) : null;
              const realCost = unit ? unit.total * o.quantity : o.totalCost;
              const margin = ((o.revenue - realCost) / o.revenue) * 100;
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-semibold">{o.id}</TableCell>
                  <TableCell>{o.customerName}</TableCell>
                  <TableCell>
                    <Select value={prodId} onValueChange={(v) => setSelectedProduct((s) => ({ ...s, [o.id]: v }))}>
                      <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">{o.quantity}</TableCell>
                  <TableCell className="text-right font-medium">{unit ? fmt(unit.total) : "—"}</TableCell>
                  <TableCell className="text-right">{fmt(realCost)}</TableCell>
                  <TableCell className="text-right">{fmt(o.revenue)}</TableCell>
                  <TableCell className={cn("text-right font-bold", margin >= 25 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive")}>
                    {margin.toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Materiales (CRUD)
// ============================================================
function MaterialsTab({ materials, setMaterials }: { materials: Material[]; setMaterials: React.Dispatch<React.SetStateAction<Material[]>> }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [form, setForm] = useState<Material>({ id: "", name: "", unit: "metros", cost: 0, stock: 0 });

  const startNew = () => { setEditing(null); setForm({ id: `M-${String(materials.length + 1).padStart(3, "0")}`, name: "", unit: "metros", cost: 0, stock: 0 }); setOpen(true); };
  const startEdit = (m: Material) => { setEditing(m); setForm(m); setOpen(true); };
  const save = () => {
    if (!form.name) { toast.error("Nombre requerido"); return; }
    if (editing) setMaterials((arr) => arr.map((x) => x.id === editing.id ? form : x));
    else setMaterials((arr) => [...arr, form]);
    setOpen(false); toast.success("Material guardado");
  };
  const remove = (id: string) => { setMaterials((arr) => arr.filter((x) => x.id !== id)); toast.success("Eliminado"); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">Materiales (enlazado con Inventario)</CardTitle>
        <Button size="sm" onClick={startNew}><Plus className="h-4 w-4 mr-1" />Agregar material</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>ID</TableHead><TableHead>Nombre</TableHead><TableHead>Unidad de medida</TableHead>
            <TableHead className="text-right">Costo / unidad</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="w-24" />
          </TableRow></TableHeader>
          <TableBody>
            {materials.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-semibold">{m.id}</TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell><Badge variant="secondary">{m.unit}</Badge></TableCell>
                <TableCell className="text-right">{fmt(m.cost)}</TableCell>
                <TableCell className="text-right">{m.stock}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(m)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar material" : "Nuevo material"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>ID</Label><Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></div>
            <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Unidad</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["metros", "centímetros", "piezas", "kg", "gramos", "litros", "conos", "gruesas", "rollos"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Costo unitario</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: +e.target.value })} /></div>
            <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// Mano de obra (CRUD)
// ============================================================
function LaborTab({ labor, setLabor }: { labor: Labor[]; setLabor: React.Dispatch<React.SetStateAction<Labor[]>> }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Labor | null>(null);
  const [form, setForm] = useState<Labor>({ id: "", role: "", hourlyRate: 0 });

  const startNew = () => { setEditing(null); setForm({ id: `L-${String(labor.length + 1).padStart(3, "0")}`, role: "", hourlyRate: 0 }); setOpen(true); };
  const startEdit = (l: Labor) => { setEditing(l); setForm(l); setOpen(true); };
  const save = () => {
    if (!form.role) { toast.error("Rol requerido"); return; }
    if (editing) setLabor((arr) => arr.map((x) => x.id === editing.id ? form : x));
    else setLabor((arr) => [...arr, form]);
    setOpen(false); toast.success("Guardado");
  };
  const remove = (id: string) => setLabor((arr) => arr.filter((x) => x.id !== id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">Mano de obra</CardTitle>
        <Button size="sm" onClick={startNew}><Plus className="h-4 w-4 mr-1" />Agregar rol</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>ID</TableHead><TableHead>Rol</TableHead><TableHead className="text-right">Tarifa / hora</TableHead><TableHead className="w-24" />
          </TableRow></TableHeader>
          <TableBody>
            {labor.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-semibold">{l.id}</TableCell>
                <TableCell>{l.role}</TableCell>
                <TableCell className="text-right">{fmt(l.hourlyRate)}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(l)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar rol" : "Nuevo rol"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>ID</Label><Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></div>
            <div><Label>Rol</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
            <div className="col-span-2"><Label>Tarifa por hora</Label><Input type="number" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: +e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// Procesos / servicios
// ============================================================
function ProcessesTab({ processes, setProcesses }: { processes: ProcessService[]; setProcesses: React.Dispatch<React.SetStateAction<ProcessService[]>> }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessService | null>(null);
  const [form, setForm] = useState<ProcessService>({ id: "", name: "", costPerUnit: 0, estimatedMinutes: 0 });

  const startNew = () => { setEditing(null); setForm({ id: `P-${String(processes.length + 1).padStart(3, "0")}`, name: "", costPerUnit: 0, estimatedMinutes: 0 }); setOpen(true); };
  const startEdit = (p: ProcessService) => { setEditing(p); setForm(p); setOpen(true); };
  const save = () => {
    if (!form.name) { toast.error("Nombre requerido"); return; }
    if (editing) setProcesses((arr) => arr.map((x) => x.id === editing.id ? form : x));
    else setProcesses((arr) => [...arr, form]);
    setOpen(false); toast.success("Guardado");
  };
  const remove = (id: string) => setProcesses((arr) => arr.filter((x) => x.id !== id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">Etapas del proceso (servicios)</CardTitle>
        <Button size="sm" onClick={startNew}><Plus className="h-4 w-4 mr-1" />Agregar etapa</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>ID</TableHead><TableHead>Etapa</TableHead>
            <TableHead className="text-right">Costo / unidad</TableHead>
            <TableHead className="text-right">Tiempo estim. (min)</TableHead>
            <TableHead className="w-24" />
          </TableRow></TableHeader>
          <TableBody>
            {processes.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold">{p.id}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell className="text-right">{fmt(p.costPerUnit)}</TableCell>
                <TableCell className="text-right">{p.estimatedMinutes} min</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar etapa" : "Nueva etapa"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>ID</Label><Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></div>
            <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Costo / unidad</Label><Input type="number" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: +e.target.value })} /></div>
            <div><Label>Tiempo (min)</Label><Input type="number" value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: +e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// Productos (con variables) — lista por defecto con costos
// ============================================================
function ProductsTab({
  products, setProducts, materials, labor, processes, computeUnitCost,
}: {
  products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  materials: Material[]; labor: Labor[]; processes: ProcessService[];
  computeUnitCost: (p: Product) => { mat: number; lab: number; proc: number; overhead: number; total: number };
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const blank: Product = { id: "", name: "", variant: "", materials: [], labor: [], processes: [], overhead: 0, suggestedPrice: 0 };
  const [form, setForm] = useState<Product>(blank);

  const startNew = () => { setEditing(null); setForm({ ...blank, id: `PRD-${String(products.length + 1).padStart(3, "0")}` }); setOpen(true); };
  const startEdit = (p: Product) => { setEditing(p); setForm(p); setOpen(true); };
  const save = () => {
    if (!form.name) { toast.error("Nombre requerido"); return; }
    if (editing) setProducts((arr) => arr.map((x) => x.id === editing.id ? form : x));
    else setProducts((arr) => [...arr, form]);
    setOpen(false); toast.success("Producto guardado");
  };
  const remove = (id: string) => setProducts((arr) => arr.filter((x) => x.id !== id));

  const formCost = useMemo(() => computeUnitCost(form), [form, materials, labor, processes]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">Catálogo de productos (con costos por defecto)</CardTitle>
        <Button size="sm" onClick={startNew}><Plus className="h-4 w-4 mr-1" />Crear producto</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>ID</TableHead><TableHead>Producto</TableHead><TableHead>Variante</TableHead>
            <TableHead className="text-right">Materiales</TableHead>
            <TableHead className="text-right">M. obra</TableHead>
            <TableHead className="text-right">Procesos</TableHead>
            <TableHead className="text-right">Indirectos</TableHead>
            <TableHead className="text-right">Costo total</TableHead>
            <TableHead className="text-right">Precio sug.</TableHead>
            <TableHead className="text-right">Margen</TableHead>
            <TableHead className="w-24" />
          </TableRow></TableHeader>
          <TableBody>
            {products.map((p) => {
              const c = computeUnitCost(p);
              const margin = p.suggestedPrice > 0 ? ((p.suggestedPrice - c.total) / p.suggestedPrice) * 100 : 0;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.id}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{p.variant}</TableCell>
                  <TableCell className="text-right">{fmt(c.mat)}</TableCell>
                  <TableCell className="text-right">{fmt(c.lab)}</TableCell>
                  <TableCell className="text-right">{fmt(c.proc)}</TableCell>
                  <TableCell className="text-right">{fmt(c.overhead)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(c.total)}</TableCell>
                  <TableCell className="text-right">{fmt(p.suggestedPrice)}</TableCell>
                  <TableCell className={cn("text-right font-bold", margin >= 25 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive")}>
                    {margin.toFixed(1)}%
                    {margin < 15 && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>ID</Label><Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></div>
            <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="col-span-2"><Label>Variante</Label><Input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} placeholder="ej: Manga larga - Algodón M" /></div>
          </div>

          {/* Materiales */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Materiales (enlazado a inventario)</Label>
              <Button size="sm" variant="outline" onClick={() => setForm({ ...form, materials: [...form.materials, { materialId: materials[0]?.id ?? "", quantity: 0 }] })}>
                <Plus className="h-3 w-3 mr-1" />Añadir
              </Button>
            </div>
            {form.materials.map((pm, i) => {
              const mat = materials.find((m) => m.id === pm.materialId);
              return (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select value={pm.materialId} onValueChange={(v) => setForm({ ...form, materials: form.materials.map((x, idx) => idx === i ? { ...x, materialId: v } : x) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Input type="number" step="0.01" className="w-28" value={pm.quantity} onChange={(e) => setForm({ ...form, materials: form.materials.map((x, idx) => idx === i ? { ...x, quantity: +e.target.value } : x) })} />
                  <span className="text-xs text-muted-foreground w-20">{mat ? fmt(mat.cost * pm.quantity) : ""}</span>
                  <Button size="icon" variant="ghost" onClick={() => setForm({ ...form, materials: form.materials.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              );
            })}
          </div>

          {/* Mano de obra */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Mano de obra</Label>
              <Button size="sm" variant="outline" onClick={() => setForm({ ...form, labor: [...form.labor, { laborId: labor[0]?.id ?? "", hours: 0 }] })}>
                <Plus className="h-3 w-3 mr-1" />Añadir
              </Button>
            </div>
            {form.labor.map((pl, i) => {
              const l = labor.find((x) => x.id === pl.laborId);
              return (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select value={pl.laborId} onValueChange={(v) => setForm({ ...form, labor: form.labor.map((x, idx) => idx === i ? { ...x, laborId: v } : x) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{labor.map((x) => <SelectItem key={x.id} value={x.id}>{x.role}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Input type="number" step="0.01" className="w-28" placeholder="horas" value={pl.hours} onChange={(e) => setForm({ ...form, labor: form.labor.map((x, idx) => idx === i ? { ...x, hours: +e.target.value } : x) })} />
                  <span className="text-xs text-muted-foreground w-20">{l ? fmt(l.hourlyRate * pl.hours) : ""}</span>
                  <Button size="icon" variant="ghost" onClick={() => setForm({ ...form, labor: form.labor.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              );
            })}
          </div>

          {/* Procesos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Procesos / etapas</Label>
              <Button size="sm" variant="outline" onClick={() => setForm({ ...form, processes: [...form.processes, { processId: processes[0]?.id ?? "" }] })}>
                <Plus className="h-3 w-3 mr-1" />Añadir
              </Button>
            </div>
            {form.processes.map((pp, i) => {
              const pr = processes.find((x) => x.id === pp.processId);
              return (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select value={pp.processId} onValueChange={(v) => setForm({ ...form, processes: form.processes.map((x, idx) => idx === i ? { processId: v } : x) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{processes.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <span className="text-xs text-muted-foreground w-24">{pr ? `${fmt(pr.costPerUnit)} · ${pr.estimatedMinutes}m` : ""}</span>
                  <Button size="icon" variant="ghost" onClick={() => setForm({ ...form, processes: form.processes.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Costos indirectos</Label><Input type="number" value={form.overhead} onChange={(e) => setForm({ ...form, overhead: +e.target.value })} /></div>
            <div><Label>Precio sugerido de venta</Label><Input type="number" value={form.suggestedPrice} onChange={(e) => setForm({ ...form, suggestedPrice: +e.target.value })} /></div>
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Materiales</span><span>{fmt(formCost.mat)}</span></div>
            <div className="flex justify-between"><span>Mano de obra</span><span>{fmt(formCost.lab)}</span></div>
            <div className="flex justify-between"><span>Procesos</span><span>{fmt(formCost.proc)}</span></div>
            <div className="flex justify-between"><span>Indirectos</span><span>{fmt(formCost.overhead)}</span></div>
            <div className="flex justify-between font-bold border-t pt-1"><span>Costo unitario</span><span>{fmt(formCost.total)}</span></div>
          </div>

          <DialogFooter><Button onClick={save}>Guardar producto</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// Rentabilidad mensual
// ============================================================
function ProfitTab() {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Rentabilidad por orden (mes)</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {orders.map((order) => {
            const profit = order.revenue - order.totalCost;
            const barWidth = (order.margin / 40) * 100;
            return (
              <div key={order.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">{order.id}</span>
                    <span className="text-xs text-muted-foreground ml-2">{order.customerName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {order.margin < 20 && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    <span className={cn("text-sm font-bold", order.margin >= 25 ? "text-success" : order.margin >= 20 ? "text-warning" : "text-destructive")}>
                      {order.margin}%
                    </span>
                    <span className="text-xs text-muted-foreground w-24 text-right">{fmt(profit)}</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", order.margin >= 25 ? "bg-success" : order.margin >= 20 ? "bg-warning" : "bg-destructive")} style={{ width: `${Math.min(barWidth, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
