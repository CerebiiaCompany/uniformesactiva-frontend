import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight,
  Factory,
  Filter,
  Plus,
  Satellite,
  X,
  ArrowLeft,
  Phone,
  MapPin,
  FileText,
  CheckSquare,
  DollarSign,
  Download,
  Trash2,
  Eye,
  EyeOff,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useCreateSatellite,
  useDeleteSatellite,
  useGetSatellites,
  useUpdateSatellite,
  type SatelliteFilters,
} from "@/hooks/useSatellites";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useKanbanEtapas } from "@/hooks/useKanbanEtapas";
import { http, HttpError } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { Order } from "@/hooks/useOrders";
import { joinStageKeys } from "@/lib/production-capa-permissions";
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
import { KanbanStageChip } from "@/components/KanbanStageChip";
import {
  getKanbanStageSoftPanelClass,
  getKanbanStageSoftTextClass,
} from "@/lib/kanban-stage-theme";

const EMPTY_FORM = {
  name: "",
  person_name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  cargo: "",
  password: "",
  status: "active" as "active" | "inactive",
  production_stage_keys: [] as string[],
};

function toggleStageKey(keys: string[], key: string): string[] {
  return keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingAll, setIsCreatingAll] = useState(false);

  const { satellites, isLoading, refetch } = useGetSatellites(appliedFilters);
  const { createSatellite, isPending } = useCreateSatellite();
  const { updateSatellite, isPending: updatingSatellite } = useUpdateSatellite();
  const { deleteSatellite, isPending: isDeletingSatellite } = useDeleteSatellite();
  const { etapas, fetchEtapas } = useKanbanEtapas();

  const [satelliteUsers, setSatelliteUsers] = useState<SatelliteUserRef[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingSatellite, setDeletingSatellite] = useState<SatelliteDashboardCard | null>(null);
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
    setForm({ ...EMPTY_FORM, production_stage_keys: [] });
    setFormError("");
    setShowPassword(false);
    setIsCreateOpen(true);
    void fetchEtapas();
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
    const personName = form.person_name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!name) {
      setFormError("El nombre del satélite es obligatorio.");
      return;
    }
    if (!personName) {
      setFormError("El nombre de la persona es obligatorio.");
      return;
    }
    if (!email) {
      setFormError("El correo es obligatorio.");
      return;
    }
    if (!phone) {
      setFormError("El teléfono es obligatorio.");
      return;
    }
    if (form.production_stage_keys.length === 0) {
      setFormError("Selecciona al menos una capa (permisos del satélite).");
      return;
    }

    setIsCreatingAll(true);
    setFormError("");

    try {
      // Especialidades = etiquetas de las capas seleccionadas
      const specialtiesFromCapas = etapas
        .filter((c) => form.production_stage_keys.includes(c.key))
        .map((c) => c.label);

      const created = await createSatellite({
        name,
        contact_name: personName,
        phone,
        address: form.address.trim(),
        specialties: specialtiesFromCapas,
        notes: form.notes.trim(),
        status: "active",
      });

      const nameParts = personName.split(/\s+/);
      const first_name = nameParts[0] || personName;
      const last_name = nameParts.slice(1).join(" ");

      const userPayload = {
        full_name: personName,
        first_name,
        last_name,
        email,
        phone,
        area: "Producción",
        cargo: form.cargo.trim(),
        roles: ["Satélite"],
        production_stage_keys: form.production_stage_keys,
        production_stage_key: joinStageKeys(form.production_stage_keys),
        satellite_id: created.id,
        password: form.password.trim() || undefined,
        status: form.status,
      };

      try {
        const userData = await http<{ username?: string }>(endpoints.users.list(), {
          method: "POST",
          body: JSON.stringify(userPayload),
        });
        const createdUsername = userData?.username || email;
        const usedTempPassword = !form.password.trim();
        toast.success(
          usedTempPassword
            ? `Satélite y usuario creados. Usuario: ${createdUsername}. Contraseña temporal: Temp.${createdUsername}123!`
            : `Satélite y usuario ${createdUsername} creados correctamente.`
        );
      } catch (userErr: unknown) {
        const msg =
          userErr instanceof HttpError
            ? userErr.message
            : userErr instanceof Error
              ? userErr.message
              : "No se pudo crear el usuario.";
        toast.error(
          `El taller «${name}» se creó, pero el usuario falló: ${msg}. Puedes vincularlo desde Usuarios.`
        );
      }

      setIsCreateOpen(false);
      setForm({ ...EMPTY_FORM, production_stage_keys: [] });
      await refetch();
      await loadMetrics();
    } catch (err: any) {
      setFormError(err?.message || "No se pudo crear el satélite.");
    } finally {
      setIsCreatingAll(false);
    }
  };

  const canDeleteSatellite = (card: SatelliteDashboardCard) =>
    Number(card.porPagar || 0) <= 0;

  const requestDeleteSatellite = (card: SatelliteDashboardCard) => {
    if (!canDeleteSatellite(card)) {
      toast.error(
        "No se puede eliminar: este satélite tiene deudas pendientes. Debe quedar en ceros."
      );
      return;
    }
    setDeletingSatellite(card);
  };

  const handleDeleteSatelliteConfirm = async () => {
    if (!deletingSatellite) return;
    try {
      await deleteSatellite(deletingSatellite.id);
      toast.success(`Satélite "${deletingSatellite.name}" eliminado`);
      if (selectedId === deletingSatellite.id) {
        setSelectedId(null);
      }
      setDeletingSatellite(null);
      await refetch();
      await loadMetrics();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo eliminar el satélite.");
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
      eyebrow="Operación"
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
                    <KanbanStageChip key={c.key} stageKey={c.key} label={c.label} />
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              disabled={!canDeleteSatellite(selectedCard) || isDeletingSatellite}
              title={
                canDeleteSatellite(selectedCard)
                  ? "Eliminar satélite"
                  : "No se puede eliminar: tiene deudas pendientes"
              }
              onClick={() => requestDeleteSatellite(selectedCard)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar
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
              <CardTitle className="text-lg font-semibold tracking-tight">Resumen de liquidación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Total facturado
                  </p>
                  <p className="text-xl tabular-nums">
                    {formatMoneyCop(detailSummary.totalFacturado)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Pagado
                  </p>
                  <p className="text-xl tabular-nums text-emerald-600">
                    {formatMoneyCop(detailSummary.pagado)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Por pagar
                  </p>
                  <p className="text-xl tabular-nums text-red-600">
                    {formatMoneyCop(detailSummary.porPagar)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Órdenes activas
                  </p>
                  <p className="text-xl tabular-nums">
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
          <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Satellite className="h-5 w-5 text-muted-foreground" />
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
                  canDelete={canDeleteSatellite(card)}
                  deleting={isDeletingSatellite && deletingSatellite?.id === card.id}
                  onDelete={() => requestDeleteSatellite(card)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <AlertDialog
        open={!!deletingSatellite}
        onOpenChange={(open) => !open && !isDeletingSatellite && setDeletingSatellite(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar satélite?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deletingSatellite?.name}</strong>. Solo se permite si no
              tiene nada por pagar. Los usuarios vinculados quedarán sin taller asignado. Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSatellite}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteSatelliteConfirm();
              }}
              disabled={isDeletingSatellite}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingSatellite ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground border rounded-xl shadow-lg w-full max-w-xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 sticky top-0 bg-card z-10 border-b">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-red-600" />
                <h3 className="text-lg font-semibold">Nuevo satélite</h3>
              </div>
              <button
                type="button"
                onClick={() => !isCreatingAll && setIsCreateOpen(false)}
                className="p-1 hover:bg-muted rounded-md transition-colors"
                aria-label="Cerrar"
                disabled={isCreatingAll}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 pb-6 pt-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Crea el taller y su usuario satélite en un solo paso. Área{" "}
                <strong className="text-foreground">Producción</strong> y rol{" "}
                <strong className="text-foreground">Satélite</strong> quedan asignados
                automáticamente. Las capas definen en qué etapas puede trabajar.
              </p>

              {formError ? (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                  {formError}
                </p>
              ) : null}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Nombre del satélite <span className="text-red-600">*</span>
                </Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, name: e.target.value }));
                    setFormError("");
                  }}
                  placeholder="Ej. Satélite Flor"
                  className="h-10 rounded-lg bg-muted/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Nombre de la persona <span className="text-red-600">*</span>
                </Label>
                <Input
                  required
                  value={form.person_name}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, person_name: e.target.value }));
                    setFormError("");
                  }}
                  placeholder="Ej. Flor Rodríguez"
                  className="h-10 rounded-lg bg-muted/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Correo <span className="text-red-600">*</span>
                </Label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, email: e.target.value }));
                    setFormError("");
                  }}
                  placeholder="flor@gmail.com"
                  className="h-10 rounded-lg bg-muted/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Teléfono <span className="text-red-600">*</span>
                </Label>
                <Input
                  required
                  value={form.phone}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, phone: e.target.value }));
                    setFormError("");
                  }}
                  placeholder="+57 300 000 0000"
                  className="h-10 rounded-lg bg-muted/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Dirección</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Opcional"
                  className="h-10 rounded-lg bg-muted/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Área <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    value="Producción"
                    readOnly
                    disabled
                    className="h-10 rounded-lg bg-muted/60 text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Rol <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    value="Satélite"
                    readOnly
                    disabled
                    className="h-10 rounded-lg bg-muted/60 text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Capas <span className="text-red-600">*</span>
                </Label>
                {etapas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay capas Kanban configuradas en Fábrica.
                  </p>
                ) : (
                  <div className="rounded-lg border px-3 py-2.5 space-y-2 max-h-40 overflow-y-auto bg-muted/20">
                    {etapas
                      .filter((c) => c.activo !== false)
                      .map((c) => {
                        const checked = form.production_stage_keys.includes(c.key);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2.5 cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => {
                                setForm((p) => ({
                                  ...p,
                                  production_stage_keys: toggleStageKey(
                                    p.production_stage_keys,
                                    c.key
                                  ),
                                }));
                                setFormError("");
                              }}
                            />
                            <KanbanStageChip stageKey={c.key} label={c.label} />
                          </label>
                        );
                      })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Define los permisos por capa. Puede encargarse de varias; en cada una solo
                  avanzará la tarjeta a la etapa siguiente.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Cargo</Label>
                <Input
                  value={form.cargo}
                  onChange={(e) => setForm((p) => ({ ...p, cargo: e.target.value }))}
                  placeholder="Ej. Satelite1"
                  className="h-10 rounded-lg bg-muted/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Contraseña inicial
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Opcional — se genera una temporal si la dejas vacía"
                    className="h-10 rounded-lg bg-muted/40 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Notas</Label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Tiempos de entrega, capacidad, condiciones..."
                  rows={2}
                  className="w-full rounded-lg border bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-600 resize-y min-h-[64px]"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
                <div>
                  <p className="text-sm font-medium">Usuario activo</p>
                  <p className="text-xs text-muted-foreground">
                    Puede iniciar sesión y operar sus módulos.
                  </p>
                </div>
                <Switch
                  checked={form.status === "active"}
                  onCheckedChange={(checked) =>
                    setForm((p) => ({
                      ...p,
                      status: checked ? "active" : "inactive",
                    }))
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isPending || isCreatingAll}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || isCreatingAll}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isPending || isCreatingAll ? "Creando..." : "Crear satélite y usuario"}
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
            <KanbanStageChip
              stageKey={detail.stageKey}
              label={detail.stageLabel}
              className="text-[10px] px-2 py-0.5"
            />
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
          <p className="text-lg tabular-nums">{formatMoneyCop(displayCost)}</p>
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
                <KanbanStageChip
                  key={stage.stageKey}
                  stageKey={stage.stageKey}
                  label={stage.stageLabel}
                  className="text-[10px] font-semibold"
                >
                  {stage.isCurrent ? (
                    <span className="text-[9px] font-medium opacity-80">· actual</span>
                  ) : null}
                </KanbanStageChip>
              ))}
            </div>

            {showStages ? (
              <div className="space-y-2 pt-1 border-t border-border/60">
                {stages.map((stage) => (
                  <div
                    key={`detail-${stage.stageKey}`}
                    className={cn(
                      "rounded-lg px-3 py-2.5 space-y-1.5 border",
                      getKanbanStageSoftPanelClass(
                        stage.stageKey,
                        stage.isCurrent || stage.laborAmount > 0 || stage.actions.length > 0
                      )
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            getKanbanStageSoftTextClass(stage.stageKey)
                          )}
                        >
                          {stage.stageLabel}
                        </span>
                        {stage.isCurrent ? (
                          <span className="inline-flex rounded-full bg-white/90 border border-current/20 px-2 py-0.5 text-[10px] font-medium">
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
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            getKanbanStageSoftTextClass(stage.stageKey)
                          )}
                        >
                          MO {formatMoneyCop(stage.laborAmount)}
                        </span>
                      ) : null}
                    </div>
                    {stage.actions.length > 0 ? (
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {stage.actions.map((action) => (
                          <li key={action} className="flex items-start gap-1.5">
                            <span
                              className={cn(
                                "mt-0.5",
                                getKanbanStageSoftTextClass(stage.stageKey)
                              )}
                            >
                              •
                            </span>
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
  canDelete,
  deleting,
  onDelete,
}: {
  card: SatelliteDashboardCard;
  selected: boolean;
  onSelect: () => void;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const hasUsers = card.userIds.length > 0;

  return (
    <div
      className={cn(
        "text-left rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md",
        selected ? "border-red-500 ring-1 ring-red-500/30" : "border-border"
      )}
    >
      <div className="flex items-start gap-2">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
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
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0",
            canDelete
              ? "text-red-600 hover:text-red-700 hover:bg-red-50"
              : "text-muted-foreground/40 cursor-not-allowed"
          )}
          disabled={!canDelete || deleting}
          title={
            canDelete
              ? "Eliminar satélite"
              : "No se puede eliminar: tiene deudas pendientes"
          }
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="mt-3 flex flex-wrap gap-1.5 min-h-[28px]">
          {card.capas.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">
              {hasUsers ? "Sin capas configuradas" : "Sin usuario satélite vinculado"}
            </span>
          ) : (
            card.capas.map((c) => (
              <KanbanStageChip key={c.key} stageKey={c.key} label={c.label} />
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
            <p className="text-xl tabular-nums text-foreground">{card.ordenes}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pendientes
            </p>
            <p className="text-xl tabular-nums text-foreground">{card.pendientes}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Por pagar
            </p>
            <p className="text-lg tabular-nums text-emerald-600 truncate">
              {formatMoneyCop(card.porPagar)}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}
