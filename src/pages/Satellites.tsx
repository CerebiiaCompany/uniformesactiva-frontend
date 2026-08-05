import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ChevronRight, Factory, Filter, Plus, Satellite, X, ArrowLeft, Phone, MapPin, FileText, CheckSquare, DollarSign, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useCreateSatellite,
  useGetSatellites,
  useUpdateSatellite,
  type SatelliteFilters,
} from "@/hooks/useSatellites";
import { useKanbanEtapas } from "@/hooks/useKanbanEtapas";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { Order } from "@/hooks/useOrders";
import {
  buildSatelliteDashboard,
  buildSatelliteOrderDetails,
  exportSettlementCsv,
  formatMoneyCop,
  mapApiUserToSatelliteRef,
  summarizeSatelliteOrders,
  SATELLITE_WORK_STATUS_OPTIONS,
  workStatusLabel,
  type SatelliteDashboardCard,
  type SatelliteOrderDetail,
  type SatelliteUserRef,
} from "@/lib/satellite-dashboard";
import type { SatelliteWorkStatus } from "@/hooks/useSatellites";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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

export default function Satellites() {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SatelliteFilters>({ ...EMPTY_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState<SatelliteFilters>({ ...EMPTY_FILTERS });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const { satellites, isLoading, refetch } = useGetSatellites(appliedFilters);
  const { createSatellite, isPending } = useCreateSatellite();
  const { updateSatellite, isPending: updatingSatellite } = useUpdateSatellite();
  const { etapas, fetchEtapas } = useKanbanEtapas();

  const [satelliteUsers, setSatelliteUsers] = useState<SatelliteUserRef[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailPagoFilter, setDetailPagoFilter] = useState<"todos" | "pending" | "paid">("todos");
  const [showDetailFilters, setShowDetailFilters] = useState(false);
  const [confirmDetail, setConfirmDetail] = useState<SatelliteOrderDetail | null>(null);
  const [confirmWorkStatus, setConfirmWorkStatus] = useState<SatelliteWorkStatus>("enviado");
  const [confirmObservations, setConfirmObservations] = useState("");
  const [confirmAgreedCost, setConfirmAgreedCost] = useState("");
  const [savingConfirm, setSavingConfirm] = useState(false);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const [usersRaw, ordersRaw] = await Promise.all([
        http<Record<string, unknown>[]>(endpoints.users.list()),
        fetchAllOrders(),
        fetchEtapas(),
      ]);
      const users = (Array.isArray(usersRaw) ? usersRaw : [])
        .map(mapApiUserToSatelliteRef)
        .filter((u): u is SatelliteUserRef => Boolean(u));
      setSatelliteUsers(users);
      setOrders(ordersRaw);
    } catch {
      toast.error("No se pudieron cargar métricas de satélites");
    } finally {
      setMetricsLoading(false);
    }
  }, [fetchEtapas]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const stageLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of etapas) map[e.key] = e.label;
    return map;
  }, [etapas]);

  const dashboardCards = useMemo(
    () =>
      buildSatelliteDashboard({
        workshops: satellites,
        satelliteUsers,
        orders,
        stageLabels,
      }),
    [satellites, satelliteUsers, orders, stageLabels]
  );

  const selectedCard = useMemo(
    () => dashboardCards.find((c) => c.id === selectedId) || null,
    [dashboardCards, selectedId]
  );

  const selectedOrderDetails = useMemo(() => {
    if (!selectedCard) return [] as SatelliteOrderDetail[];
    return buildSatelliteOrderDetails({
      userIds: selectedCard.userIds,
      orders,
      stageLabels,
      settlements: selectedCard.settlements,
      workshopId: selectedCard.id,
      userNamesById: Object.fromEntries(
        selectedCard.userIds.map((id, i) => [id, selectedCard.userNames[i] || ""])
      ),
    });
  }, [selectedCard, orders, stageLabels]);

  const filteredOrderDetails = useMemo(() => {
    if (detailPagoFilter === "todos") return selectedOrderDetails;
    return selectedOrderDetails.filter((d) => d.paymentStatus === detailPagoFilter);
  }, [selectedOrderDetails, detailPagoFilter]);

  const detailSummary = useMemo(
    () => summarizeSatelliteOrders(selectedOrderDetails),
    [selectedOrderDetails]
  );

  const openConfirmDialog = (detail: SatelliteOrderDetail) => {
    setConfirmDetail(detail);
    setConfirmWorkStatus(detail.workStatus || "enviado");
    setConfirmObservations(detail.observations || "");
    setConfirmAgreedCost(
      detail.agreedCost != null && Number.isFinite(detail.agreedCost)
        ? String(detail.agreedCost)
        : detail.cost > 0
          ? String(detail.cost)
          : ""
    );
  };

  const saveConfirmWork = async () => {
    if (!selectedCard || !confirmDetail) return;
    const agreedRaw = confirmAgreedCost.trim();
    const agreedCost =
      agreedRaw !== "" && Number.isFinite(Number(agreedRaw)) ? Number(agreedRaw) : null;

    setSavingConfirm(true);
    try {
      const prev = selectedCard.settlements?.[confirmDetail.orderId] || {
        status: confirmDetail.paymentStatus,
      };
      const nextSettlements = {
        ...(selectedCard.settlements || {}),
        [confirmDetail.orderId]: {
          ...prev,
          status: prev.status || confirmDetail.paymentStatus,
          amount: agreedCost ?? confirmDetail.cost,
          work_status: confirmWorkStatus,
          observations: confirmObservations.trim(),
          agreed_cost: agreedCost,
          confirmed_at: new Date().toISOString(),
        },
      };
      await updateSatellite({
        id: selectedCard.id,
        payload: { settlements: nextSettlements },
      });
      toast.success("Confirmación de trabajo guardada");
      setConfirmDetail(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo guardar la confirmación");
    } finally {
      setSavingConfirm(false);
    }
  };

  const markOrderPaid = async (orderId: string, amount: number) => {
    if (!selectedCard) return;
    try {
      const prev = selectedCard.settlements?.[orderId] || {};
      const nextSettlements = {
        ...(selectedCard.settlements || {}),
        [orderId]: {
          ...prev,
          status: "paid" as const,
          amount,
          paid_at: new Date().toISOString(),
        },
      };
      await updateSatellite({
        id: selectedCard.id,
        payload: {
          settlements: nextSettlements,
          payment_status:
            Object.values(nextSettlements).every((s) => s.status === "paid") &&
            selectedOrderDetails.length > 0
              ? "al_dia"
              : "pendiente",
        },
      });
      toast.success("Pedido marcado como pagado");
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo marcar el pago");
    }
  };

  const markOrderPending = async (orderId: string, amount: number) => {
    if (!selectedCard) return;
    try {
      const prev = selectedCard.settlements?.[orderId] || {};
      const nextSettlements = {
        ...(selectedCard.settlements || {}),
        [orderId]: {
          ...prev,
          status: "pending" as const,
          amount,
          paid_at: null,
        },
      };
      await updateSatellite({
        id: selectedCard.id,
        payload: {
          settlements: nextSettlements,
          payment_status: "pendiente",
        },
      });
      toast.success("Pedido marcado como por pagar");
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo actualizar el pago");
    }
  };

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
      loadMetrics();
    } catch (err: any) {
      setFormError(err?.message || "No se pudo crear el satélite.");
    }
  };

  return (
    <AppLayout
      title={selectedCard ? selectedCard.name : "Satélites"}
      subtitle={
        selectedCard
          ? `${selectedCard.contactName} · liquidación de mano de obra por pedido`
          : "Talleres externos y usuarios satélite: capas, órdenes y mano de obra por pagar."
      }
    >
      {selectedCard ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setDetailPagoFilter("todos");
              setShowDetailFilters(false);
            }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a satélites
          </button>

          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 text-red-600" />
                  {selectedCard.phone || "Sin teléfono"}
                </span>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 text-red-600" />
                  {selectedCard.address || "Sin dirección"}
                </span>
              </div>
              {selectedCard.notes ? (
                <p className="text-sm text-muted-foreground">{selectedCard.notes}</p>
              ) : null}
              {selectedCard.capas.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCard.capas.map((c) => (
                    <span
                      key={c.key}
                      className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDetailFilters((v) => !v)}
              className={cn(showDetailFilters && "bg-muted")}
            >
              <Filter className="h-4 w-4 mr-1" />
              Filtros
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                const pending = selectedOrderDetails.filter((d) => d.paymentStatus === "pending");
                exportSettlementCsv(
                  selectedCard.name,
                  pending.length ? pending : selectedOrderDetails
                );
              }}
              disabled={selectedOrderDetails.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar liquidación (
              {selectedOrderDetails.filter((d) => d.paymentStatus === "pending").length ||
                selectedOrderDetails.length}
              )
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              Mostrando {filteredOrderDetails.length} de {selectedOrderDetails.length}
            </span>
          </div>

          {showDetailFilters ? (
            <div className="rounded-xl border bg-muted/20 px-4 py-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1 min-w-[160px]">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Estado de pago
                </Label>
                <Select
                  value={detailPagoFilter}
                  onValueChange={(v) =>
                    setDetailPagoFilter(v as "todos" | "pending" | "paid")
                  }
                >
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pending">Por pagar</SelectItem>
                    <SelectItem value="paid">Pagados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {filteredOrderDetails.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {selectedCard.userIds.length === 0
                  ? "Este taller no tiene usuario Satélite vinculado. Asígnalo en Administración."
                  : "No hay pedidos asignados a este satélite todavía."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredOrderDetails.map((detail) => (
                <SatelliteOrderCard
                  key={detail.orderId}
                  detail={detail}
                  busy={updatingSatellite || savingConfirm}
                  onMarkPaid={() => markOrderPaid(detail.orderId, detail.cost)}
                  onMarkPending={() => markOrderPending(detail.orderId, detail.cost)}
                  onConfirmEdit={() => openConfirmDialog(detail)}
                />
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Resumen de liquidación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Total facturado
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatMoneyCop(detailSummary.totalFacturado)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Pagado
                  </p>
                  <p className="text-xl font-semibold tabular-nums text-emerald-600">
                    {formatMoneyCop(detailSummary.pagado)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Por pagar
                  </p>
                  <p className="text-xl font-semibold tabular-nums text-red-600">
                    {formatMoneyCop(detailSummary.porPagar)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Órdenes activas
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {detailSummary.ordenesActivas}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Dialog
            open={Boolean(confirmDetail)}
            onOpenChange={(open) => {
              if (!open) setConfirmDetail(null);
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  Confirmar trabajo — {confirmDetail?.orderCode || ""}
                </DialogTitle>
                {confirmDetail ? (
                  <p className="text-sm text-muted-foreground">
                    {confirmDetail.customerName}
                    {confirmDetail.description ? ` · ${confirmDetail.description}` : ""}
                    {confirmDetail.quantity ? ` · ${confirmDetail.quantity} uds` : ""}
                  </p>
                ) : null}
              </DialogHeader>

              <div className="space-y-4 py-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Estado del trabajo</Label>
                  <Select
                    value={confirmWorkStatus}
                    onValueChange={(v) => setConfirmWorkStatus(v as SatelliteWorkStatus)}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-red-500 focus:ring-red-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SATELLITE_WORK_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Confirma al satélite si el trabajo llegó completo o con faltantes.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Observaciones</Label>
                  <Textarea
                    value={confirmObservations}
                    onChange={(e) => setConfirmObservations(e.target.value)}
                    placeholder="Notas de verificación, calidad, tiempos..."
                    className="min-h-[88px] text-sm resize-none rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Costo acordado</Label>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={confirmAgreedCost}
                    onChange={(e) => setConfirmAgreedCost(e.target.value)}
                    className="h-10 rounded-lg"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmDetail(null)}
                  disabled={savingConfirm}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={saveConfirmWork}
                  disabled={savingConfirm}
                >
                  {savingConfirm ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Satellite className="h-4 w-4 text-muted-foreground" />
            Talleres satélite
            {metricsLoading ? (
              <span className="text-xs font-normal text-muted-foreground">Actualizando…</span>
            ) : null}
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

        <CardContent>
          {showFilters && (
            <div className="mb-4 rounded-xl border bg-muted/20 px-4 py-3">
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
          ) : dashboardCards.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm text-muted-foreground">No hay satélites registrados.</p>
              <p className="text-xs text-muted-foreground">
                Créalos aquí o al crear un usuario con rol Satélite en Administración.
              </p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {dashboardCards.map((card) => (
                <SatelliteMetricCard
                  key={card.id}
                  card={card}
                  selected={selectedId === card.id}
                  onSelect={() => setSelectedId(card.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

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

function SatelliteOrderCard({
  detail,
  busy,
  onMarkPaid,
  onMarkPending,
  onConfirmEdit,
}: {
  detail: SatelliteOrderDetail;
  busy: boolean;
  onMarkPaid: () => void;
  onMarkPending: () => void;
  onConfirmEdit: () => void;
}) {
  const [showStages, setShowStages] = useState(false);
  const workBadge =
    detail.workStatus === "recibido_completo"
      ? {
          label: "Recibido completo",
          className: "bg-emerald-100 text-emerald-800",
        }
      : detail.workStatus === "recibido_faltantes"
        ? {
            label: "Recibido con faltantes",
            className: "bg-amber-100 text-amber-900",
          }
        : {
            label: "Enviado",
            className: "bg-sky-100 text-sky-800",
          };

  const displayCost =
    detail.agreedCost != null && Number.isFinite(detail.agreedCost)
      ? detail.agreedCost
      : detail.cost;

  const stages = detail.stagesWorked || [];

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold">{detail.orderCode}</span>
            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {detail.stageLabel}
            </span>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                workBadge.className
              )}
              title={workStatusLabel(detail.workStatus)}
            >
              {workBadge.label}
            </span>
            {detail.paymentStatus === "paid" ? (
              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                Pagado
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                Por pagar
              </span>
            )}
          </div>
          <div>
            <p className="font-semibold text-sm">{detail.customerName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {detail.description}
              {detail.quantity ? ` · ${detail.quantity} uds` : ""}
              {detail.dueDate ? ` · entrega ${detail.dueDate}` : ""}
            </p>
            {detail.observations ? (
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                Obs.: {detail.observations}
              </p>
            ) : null}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Costo
          </p>
          <p className="text-lg font-semibold tabular-nums">{formatMoneyCop(displayCost)}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Capas realizadas por este satélite
          </p>
          {stages.length > 0 ? (
            <button
              type="button"
              className="text-[11px] font-medium text-red-700 hover:underline"
              onClick={() => setShowStages((v) => !v)}
            >
              {showStages ? "Ocultar detalle" : "Ver detalle"}
            </button>
          ) : null}
        </div>

        {stages.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aún no hay capas registradas para este taller en el pedido.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {stages.map((stage) => (
                <span
                  key={stage.stageKey}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border",
                    stage.isCurrent
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-red-50 text-red-700 border-red-200"
                  )}
                >
                  {stage.stageLabel}
                  {stage.isCurrent ? (
                    <span className="text-[9px] font-medium opacity-90">· actual</span>
                  ) : null}
                </span>
              ))}
            </div>

            {showStages ? (
              <div className="space-y-2 pt-1 border-t border-border/60">
                {stages.map((stage) => (
                  <div
                    key={`detail-${stage.stageKey}`}
                    className={cn(
                      "rounded-lg px-3 py-2.5 space-y-1.5 border",
                      stage.isCurrent || stage.laborAmount > 0 || stage.actions.length > 0
                        ? "bg-red-50/80 border-red-200"
                        : "bg-background border-border"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-sm font-semibold text-red-800">
                          {stage.stageLabel}
                        </span>
                        {stage.isCurrent ? (
                          <span className="inline-flex rounded-full bg-white border border-red-300 px-2 py-0.5 text-[10px] font-medium text-red-700">
                            Actual
                          </span>
                        ) : null}
                        {stage.userName ? (
                          <span className="text-[11px] text-muted-foreground">
                            {stage.userName}
                          </span>
                        ) : null}
                      </div>
                      {stage.laborAmount > 0 ? (
                        <span className="text-xs font-semibold tabular-nums text-red-800">
                          MO {formatMoneyCop(stage.laborAmount)}
                        </span>
                      ) : null}
                    </div>
                    {stage.actions.length > 0 ? (
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {stage.actions.map((action) => (
                          <li key={action} className="flex items-start gap-1.5">
                            <span className="text-red-600 mt-0.5">•</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {stage.materials.length > 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Materiales:{" "}
                        {stage.materials
                          .map((m) => `${m.name} × ${m.quantity}`)
                          .join(", ")}
                        {stage.materialsAmount > 0
                          ? ` · ${formatMoneyCop(stage.materialsAmount)}`
                          : ""}
                      </p>
                    ) : null}
                    {stage.novedadesCount > 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        {stage.novedadesCount} novedad
                        {stage.novedadesCount === 1 ? "" : "es"} registrada
                        {stage.novedadesCount === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" disabled>
          <FileText className="h-3.5 w-3.5" />
          Guía PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={onConfirmEdit}
          disabled={busy}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          Confirmar / Editar
        </Button>
        {detail.paymentStatus === "paid" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            disabled={busy}
            onClick={onMarkPending}
          >
            Marcar por pagar
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs gap-1 bg-red-600 hover:bg-red-700 text-white"
            disabled={busy || displayCost <= 0}
            onClick={onMarkPaid}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Marcar pagado
          </Button>
        )}
      </div>
    </div>
  );
}

function SatelliteMetricCard({
  card,
  selected,
  onSelect,
}: {
  card: SatelliteDashboardCard;
  selected: boolean;
  onSelect: () => void;
}) {
  const hasUsers = card.userIds.length > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md",
        selected ? "border-red-500 ring-1 ring-red-500/30" : "border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
          <Factory className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{card.name}</p>
              <p className="text-xs text-muted-foreground truncate">{card.contactName}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 min-h-[28px]">
        {card.capas.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">
            {hasUsers ? "Sin capas configuradas" : "Sin usuario satélite vinculado"}
          </span>
        ) : (
          card.capas.map((c) => (
            <span
              key={c.key}
              className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {c.label}
            </span>
          ))
        )}
      </div>

      {!hasUsers ? (
        <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-md px-2 py-1">
          Vincula un usuario con rol Satélite en Administración para ver métricas.
        </p>
      ) : null}

      <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Órdenes
          </p>
          <p className="text-xl font-semibold tabular-nums text-foreground">{card.ordenes}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pendientes
          </p>
          <p className="text-xl font-semibold tabular-nums text-foreground">{card.pendientes}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Por pagar
          </p>
          <p className="text-lg font-semibold tabular-nums text-emerald-600 truncate">
            {formatMoneyCop(card.porPagar)}
          </p>
        </div>
      </div>
    </button>
  );
}
