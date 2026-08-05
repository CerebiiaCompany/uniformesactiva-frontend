import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  DollarSign,
  Factory,
  History,
  Loader2,
  PackageCheck,
  PackageX,
  Satellite,
  User,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import type { Order } from "@/hooks/useOrders";
import type { Satellite as SatelliteWorkshop } from "@/hooks/useSatellites";
import { useKanbanEtapas } from "@/hooks/useKanbanEtapas";
import {
  buildSatelliteUserPanel,
  formatMoneyCop,
  readStoredSatelliteUser,
  workStatusLabel,
  type SatelliteUserPanelData,
} from "@/lib/satellite-user-dashboard";

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

export function SatelliteUserDashboard() {
  const storedUser = useMemo(() => readStoredSatelliteUser(), []);
  const { etapas, fetchEtapas } = useKanbanEtapas();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<SatelliteUserPanelData | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const load = useCallback(async () => {
    let user = readStoredSatelliteUser();

    try {
      const me = await http<Record<string, unknown>>(endpoints.users.me());
      if (me && typeof me === "object") {
        const raw = localStorage.getItem("user");
        const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        const next = {
          ...prev,
          id: me.id || prev.id,
          username: me.username || prev.username,
          email: me.email || prev.email,
          first_name: me.first_name || prev.first_name,
          last_name: me.last_name || prev.last_name,
          phone: me.phone || prev.phone || "",
          area: me.area || prev.area || "",
          cargo: me.cargo || prev.cargo || "",
          roles: me.roles || prev.roles,
          production_stage_key: me.production_stage_key || prev.production_stage_key || "",
          production_stage_keys:
            me.production_stage_keys || prev.production_stage_keys || [],
          satellite_id: me.satellite_id ? String(me.satellite_id) : prev.satellite_id || "",
        };
        localStorage.setItem("user", JSON.stringify(next));
        user = readStoredSatelliteUser();
      }
    } catch {
      /* keep local session */
    }

    if (!user?.id) {
      setError("No se encontró la sesión del usuario satélite. Vuelve a iniciar sesión.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [orders, etapasList, workshop] = await Promise.all([
        fetchAllOrders(),
        fetchEtapas(),
        user.satelliteId
          ? http<SatelliteWorkshop>(endpoints.satellites.detail(user.satelliteId)).catch(
              () => null
            )
          : Promise.resolve(null),
      ]);

      const stageLabels: Record<string, string> = {};
      for (const e of etapasList || []) stageLabels[e.key] = e.label;

      setPanel(
        buildSatelliteUserPanel({
          user,
          orders,
          stageLabels,
          workshop,
        })
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cargar el panel del satélite."
      );
    } finally {
      setLoading(false);
    }
  }, [fetchEtapas]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !panel) {
    return (
      <AppLayout title="Mi panel satélite" subtitle="Resumen de tus pedidos asignados">
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando tu información...</p>
        </div>
      </AppLayout>
    );
  }

  if (error && !panel) {
    return (
      <AppLayout title="Mi panel satélite" subtitle="Resumen de tus pedidos asignados">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={load}>
            Reintentar
          </Button>
        </div>
      </AppLayout>
    );
  }

  const data = panel!;
  const user = data.user || storedUser!;

  return (
    <AppLayout
      title="Mi panel satélite"
      subtitle={
        data.workshopName
          ? `${data.workshopName} · pedidos asignados a ti`
          : "Pedidos asignados a ti en Fábrica"
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <User className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-foreground">{user.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {user.email || user.username}
                  {user.phone ? ` · ${user.phone}` : ""}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Rol: Satélite
                  </span>
                  {data.workshopName ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-700">
                      <Satellite className="h-3 w-3" />
                      {data.workshopName}
                    </span>
                  ) : null}
                  {user.stageKeys.map((key) => (
                    <span
                      key={key}
                      className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {etapas.find((e) => e.key === key)?.label || key}
                    </span>
                  ))}
                </div>
              </div>
              <Button asChild size="sm" className="bg-red-600 hover:bg-red-700 text-white shrink-0">
                <Link to="/production">
                  <Factory className="h-4 w-4 mr-1" />
                  Ir a Fábrica
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Órdenes asignadas"
            value={data.assignedOrders}
            subtitle="Tarjetas a tu cargo"
            icon={ClipboardList}
          />
          <StatCard
            title="Órdenes pendientes"
            value={data.pendingOrders}
            subtitle="Sin entregar"
            icon={Factory}
            variant="warning"
          />
          <StatCard
            title="Deuda pendiente"
            value={data.debtPending}
            formatValue={(n) => formatMoneyCop(n)}
            subtitle="Por pagar"
            icon={Wallet}
            variant="destructive"
          />
          <StatCard
            title="Pago realizado"
            value={data.paidTotal}
            formatValue={(n) => formatMoneyCop(n)}
            subtitle="Liquidado"
            icon={DollarSign}
            variant="success"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Confirmados completos"
            value={data.confirmComplete}
            icon={PackageCheck}
            variant="success"
          />
          <StatCard
            title="Con faltantes"
            value={data.confirmMissing}
            subtitle="Prendas incompletas"
            icon={PackageX}
            variant="warning"
          />
          <StatCard
            title="En trabajo"
            value={data.confirmInProgress}
            subtitle="Sin confirmar recepción"
            icon={CheckCircle2}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold tracking-tight">
                Estado de pagos por pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.orders.length === 0 ? (
                <p className="px-6 py-8 text-sm text-muted-foreground">
                  Aún no tienes pedidos asignados.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {data.orders.map((order) => {
                    const amount =
                      order.agreedCost != null && Number.isFinite(order.agreedCost)
                        ? order.agreedCost
                        : order.cost;
                    return (
                      <div
                        key={order.orderId}
                        className="flex items-start justify-between px-6 py-3 gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {order.orderCode} · {order.customerName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {order.description || order.stageLabel}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                order.workStatus === "recibido_completo"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : order.workStatus === "recibido_faltantes"
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-sky-100 text-sky-800"
                              )}
                            >
                              {workStatusLabel(order.workStatus)}
                            </span>
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                order.paymentStatus === "paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-700"
                              )}
                            >
                              {order.paymentStatus === "paid" ? "Pagado" : "Por pagar"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatMoneyCop(amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{order.stageLabel}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertas de producción
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay alertas en tus pedidos asignados.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10"
                    >
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {alert.shortId} — {alert.customerName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.description || alert.stageLabel}
                        </p>
                        <p className="text-xs text-destructive mt-1">
                          {alert.daysLate} día{alert.daysLate === 1 ? "" : "s"} de atraso
                          {alert.dueDate ? ` · Vence: ${alert.dueDate}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <History className="h-4 w-4 text-red-600" />
              Historial por pedido
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Resumen de tus pedidos. Expande cada uno para ver las capas trabajadas.
            </p>
          </CardHeader>
          <CardContent>
            {(data.orderHistory || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aún no hay historial de trabajo en pedidos asignados.
              </p>
            ) : (
              <div className="space-y-3">
                {data.orderHistory.map((item) => {
                  const expanded = Boolean(expandedOrders[item.orderId]);
                  const workedStages = item.stages.filter(
                    (s) =>
                      s.actions.length > 0 ||
                      s.laborAmount > 0 ||
                      s.materials.length > 0 ||
                      s.novedadesCount > 0 ||
                      s.isCurrent
                  );
                  const capasPreview =
                    workedStages.length > 0 ? workedStages : item.stages;

                  return (
                    <div
                      key={item.orderId}
                      className="rounded-xl border bg-card p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {item.orderCode} · {item.customerName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.description}
                            {item.quantity ? ` · ${item.quantity} uds` : ""}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                item.workStatus === "recibido_completo"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : item.workStatus === "recibido_faltantes"
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-sky-100 text-sky-800"
                              )}
                            >
                              {workStatusLabel(item.workStatus)}
                            </span>
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                item.paymentStatus === "paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-700"
                              )}
                            >
                              {item.paymentStatus === "paid" ? "Pagado" : "Por pagar"}
                            </span>
                          </div>
                          {capasPreview.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {capasPreview.map((stage) => (
                                <span
                                  key={`${item.orderId}-chip-${stage.stageKey}`}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border",
                                    "bg-red-50 text-red-700 border-red-200"
                                  )}
                                  title="Capa en la que trabajaste"
                                >
                                  {stage.stageLabel}
                                  {stage.isCurrent ? (
                                    <span className="text-[9px] font-medium text-red-500">
                                      · actual
                                    </span>
                                  ) : null}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            MO total
                          </p>
                          <p className="text-base font-semibold tabular-nums">
                            {formatMoneyCop(item.totalLabor)}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => toggleOrderDetails(item.orderId)}
                        >
                          {expanded ? (
                            <>
                              <ChevronUp className="h-3.5 w-3.5" />
                              Ocultar detalles
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" />
                              Ver más detalles
                            </>
                          )}
                        </Button>
                      </div>

                      {expanded ? (
                        item.stages.length === 0 ? (
                          <p className="text-xs text-muted-foreground border-t pt-3">
                            Sin detalle de capas registrado todavía.
                          </p>
                        ) : (
                          <div className="space-y-2 border-t pt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Capas realizadas
                            </p>
                            <div className="space-y-2">
                              {item.stages.map((stage) => {
                                const worked =
                                  stage.actions.length > 0 ||
                                  stage.laborAmount > 0 ||
                                  stage.materials.length > 0 ||
                                  stage.novedadesCount > 0 ||
                                  stage.isCurrent;
                                return (
                                  <div
                                    key={`${item.orderId}-${stage.stageKey}`}
                                    className={cn(
                                      "rounded-lg px-3 py-2.5 space-y-1.5 border",
                                      worked
                                        ? "bg-red-50/80 border-red-300 ring-1 ring-red-200/70"
                                        : "bg-muted/20 border-border"
                                    )}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className={cn(
                                            "text-sm font-semibold truncate",
                                            worked ? "text-red-800" : "text-foreground"
                                          )}
                                        >
                                          {stage.stageLabel}
                                        </span>
                                        {worked ? (
                                          <span className="inline-flex rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white">
                                            Trabajada
                                          </span>
                                        ) : null}
                                        {stage.isCurrent ? (
                                          <span className="inline-flex rounded-full bg-white border border-red-300 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                            Actual
                                          </span>
                                        ) : null}
                                      </div>
                                      {stage.laborAmount > 0 ? (
                                        <span className="text-xs font-semibold tabular-nums text-red-800">
                                          {formatMoneyCop(stage.laborAmount)}
                                        </span>
                                      ) : null}
                                    </div>
                                    {stage.actions.length > 0 ? (
                                      <ul className="text-xs text-muted-foreground space-y-0.5">
                                        {stage.actions.map((action) => (
                                          <li
                                            key={action}
                                            className="flex items-start gap-1.5"
                                          >
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
                                      </p>
                                    ) : null}
                                    {stage.novedadesCount > 0 ? (
                                      <p className="text-[11px] text-muted-foreground">
                                        {stage.novedadesCount} novedad
                                        {stage.novedadesCount === 1 ? "" : "es"} registrada
                                        {stage.novedadesCount === 1 ? "" : "s"}
                                      </p>
                                    ) : null}
                                    {stage.updatedAt ? (
                                      <p className="text-[10px] text-muted-foreground">
                                        Última actividad:{" "}
                                        {new Date(stage.updatedAt).toLocaleString("es-CO", {
                                          day: "2-digit",
                                          month: "short",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
