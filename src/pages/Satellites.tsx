import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Filter, Plus, Satellite, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useCreateSatellite,
  useGetSatellites,
  type SatelliteFilters,
} from "@/hooks/useSatellites";

const SPECIALTIES = ["Corte", "Bordado", "Estampado", "Confección", "Calidad", "Otro"] as const;

const EMPTY_FORM = {
  name: "",
  contact_name: "",
  phone: "",
  address: "",
  specialties: [] as string[],
  notes: "",
};

const EMPTY_FILTERS: SatelliteFilters = {
  desde: "",
  hasta: "",
  estado: "todos",
  pago: "todos",
};

export default function Satellites() {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SatelliteFilters>({ ...EMPTY_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState<SatelliteFilters>({ ...EMPTY_FILTERS });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const { satellites, isLoading, refetch } = useGetSatellites(appliedFilters);
  const { createSatellite, isPending } = useCreateSatellite();

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      appliedFilters.desde ||
        appliedFilters.hasta ||
        (appliedFilters.estado && appliedFilters.estado !== "todos") ||
        (appliedFilters.pago && appliedFilters.pago !== "todos")
    );
  }, [appliedFilters]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, specialties: [] });
    setFormError("");
    setIsCreateOpen(true);
  };

  const toggleSpecialty = (value: string) => {
    setForm((prev) => {
      const exists = prev.specialties.includes(value);
      return {
        ...prev,
        specialties: exists
          ? prev.specialties.filter((s) => s !== value)
          : [...prev.specialties, value],
      };
    });
  };

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
  };

  const clearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
    setAppliedFilters({ ...EMPTY_FILTERS });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFormError("El nombre del taller es obligatorio.");
      return;
    }

    try {
      await createSatellite({
        name,
        contact_name: form.contact_name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        specialties: form.specialties,
        notes: form.notes.trim(),
      });
      toast.success("Satélite creado");
      setIsCreateOpen(false);
      setForm({ ...EMPTY_FORM, specialties: [] });
      refetch();
    } catch (err: any) {
      setFormError(err?.message || "No se pudo crear el satélite.");
    }
  };

  const statusLabel = (status: string) =>
    status === "active" ? "Activo" : status === "inactive" ? "Inactivo" : status;

  const paymentLabel = (pago: string) => {
    if (pago === "al_dia") return "Al día";
    if (pago === "pendiente") return "Pendiente";
    if (pago === "no_aplica") return "No aplica";
    return pago || "—";
  };

  return (
    <AppLayout
      title="Satélites"
      subtitle="Talleres externos: corte, bordado, estampado, confección y más."
    >
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Satellite className="h-4 w-4 text-muted-foreground" />
            Talleres satélite
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(showFilters && "bg-muted")}
            >
              <Filter className="h-4 w-4 mr-1" />
              Filtros
              {hasActiveFilters ? (
                <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-red-600" />
              ) : null}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={openCreate}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nuevo satélite
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {showFilters && (
            <div className="mx-4 mb-3 mt-1 rounded-xl border bg-muted/20 px-4 py-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1 min-w-[140px]">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Desde
                  </Label>
                  <Input
                    type="date"
                    className="h-9 bg-background"
                    value={filters.desde || ""}
                    onChange={(e) => setFilters((p) => ({ ...p, desde: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 min-w-[140px]">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Hasta
                  </Label>
                  <Input
                    type="date"
                    className="h-9 bg-background"
                    value={filters.hasta || ""}
                    onChange={(e) => setFilters((p) => ({ ...p, hasta: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 min-w-[140px]">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Estado
                  </Label>
                  <Select
                    value={filters.estado || "todos"}
                    onValueChange={(v) => setFilters((p) => ({ ...p, estado: v }))}
                  >
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[140px]">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Pago
                  </Label>
                  <Select
                    value={filters.pago || "todos"}
                    onValueChange={(v) => setFilters((p) => ({ ...p, pago: v }))}
                  >
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="al_dia">Al día</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="no_aplica">No aplica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pb-0.5 ml-auto">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm text-muted-foreground hover:text-foreground px-2 py-1.5"
                  >
                    Limpiar
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 bg-red-600 hover:bg-red-700 text-white"
                    onClick={applyFilters}
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando satélites...</div>
          ) : satellites.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm text-muted-foreground">No hay satélites registrados.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openCreate}
                className="mt-1"
              >
                <Plus className="h-4 w-4 mr-1" /> Crear el primero
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Taller</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Especialidades</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {satellites.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      {s.address ? (
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {s.address}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{s.contact_name || "—"}</TableCell>
                    <TableCell>{s.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(s.specialties || []).length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          s.specialties.map((sp) => (
                            <span
                              key={sp}
                              className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                            >
                              {sp}
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          s.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                        )}
                      >
                        {statusLabel(s.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          s.payment_status === "pendiente"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {paymentLabel(s.payment_status)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground border rounded-xl shadow-lg w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h3 className="text-lg font-semibold">Nuevo satélite</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 hover:bg-muted rounded-md transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 pb-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Nombre del taller *
                </Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, name: e.target.value }));
                    setFormError("");
                  }}
                  placeholder="Ej. Bordados Luna"
                  className={cn(
                    "h-10 rounded-lg bg-muted/40",
                    formError && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {formError ? <p className="text-xs text-red-600">{formError}</p> : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Contacto</Label>
                  <Input
                    value={form.contact_name}
                    onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))}
                    placeholder="Nombre"
                    className="h-10 rounded-lg bg-muted/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Teléfono</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+57 ..."
                    className="h-10 rounded-lg bg-muted/40"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Dirección</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  className="h-10 rounded-lg bg-muted/40"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Especialidades</Label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map((sp) => {
                    const selected = form.specialties.includes(sp);
                    return (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => toggleSpecialty(sp)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
                          selected
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                        )}
                      >
                        {sp}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Notas</Label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Tiempos de entrega, capacidad, condiciones..."
                  rows={3}
                  className="w-full rounded-lg border bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 resize-y min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isPending ? "Creando..." : "Crear satélite"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
