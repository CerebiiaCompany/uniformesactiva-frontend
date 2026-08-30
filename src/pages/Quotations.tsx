import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, X, ShoppingCart, MessageSquare, FileText, Pencil, Package, Printer, Loader2 } from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuotes, type Quote, type QuoteOrderPayload } from "@/hooks/useQuotes";
import { NewOrderDialog } from "@/components/NewOrderDialog";
import { QuoteNovedadesDialog } from "@/components/QuoteNovedadesDialog";
import { ArticlesDetailDialog } from "@/components/ArticlesDetailDialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";
import { quotePayloadToArticleLines } from "@/lib/order-fields";
import { printQuoteProductionGuide } from "@/lib/quote-production-guide";
import { isAdminUser } from "@/lib/auth-roles";

interface FilterUserOption {
  id: string;
  label: string;
}

const QUOTE_STATUS_CONFIG: Record<
  string,
  { label: string; triggerClass: string; badgeClass: string }
> = {
  draft: {
    label: "Borrador",
    triggerClass: "bg-muted text-muted-foreground border-muted-foreground/20 hover:bg-muted/80",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
  sent: {
    label: "Enviada",
    triggerClass: "bg-blue-100/80 text-blue-800 border-blue-200/80 hover:bg-blue-100",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
  },
  in_review: {
    label: "En revisión",
    triggerClass: "bg-amber-100/90 text-amber-900 border-amber-300/70 hover:bg-amber-100",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
  },
  approved: {
    label: "Aprobada",
    triggerClass: "bg-emerald-100/85 text-emerald-900 border-emerald-300/70 hover:bg-emerald-100",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  rejected: {
    label: "Rechazada",
    triggerClass: "bg-red-100/85 text-red-900 border-red-300/70 hover:bg-red-100",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
  },
  ordered: {
    label: "Ordenado",
    triggerClass: "bg-green-100/85 text-green-900 border-green-300/70 hover:bg-green-100",
    badgeClass: "bg-green-100 text-green-800 border-green-200",
  },
  inactive: {
    label: "Inactiva",
    triggerClass: "bg-slate-100 text-slate-700 border-slate-300/70 hover:bg-slate-200/70",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

function getQuoteStatusInfo(status: string) {
  return (
    QUOTE_STATUS_CONFIG[status] ?? {
      label: status,
      triggerClass: "bg-muted text-muted-foreground border-border",
      badgeClass: "bg-muted text-muted-foreground border-border",
    }
  );
}

function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return (
    d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
    }) +
    " · " +
    d.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  );
}

export default function Quotations() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightHandledRef = useRef<string | null>(null);
  const [highlightedQuoteId, setHighlightedQuoteId] = useState<string | null>(null);
  const {
    quotes,
    setQuotes,
    loading,
    error,
    fetchQuotes,
    fetchQuoteById,
    updateQuoteStatus,
    placeOrderFromQuote,
    fetchQuoteNovedades,
    createQuoteNovedad,
    updateQuotePayment,
  } = useQuotes();

  // Estado del modal nueva / editar cotización
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [isPlacingOrderId, setIsPlacingOrderId] = useState<string | null>(null);
  const [printingQuoteId, setPrintingQuoteId] = useState<string | null>(null);

  // Modal de novedades
  const [novedadesOpen, setNovedadesOpen] = useState(false);
  const [novedadesQuote, setNovedadesQuote] = useState<Quote | null>(null);

  const [articlesQuote, setArticlesQuote] = useState<Quote | null>(null);
  const [articlesOpen, setArticlesOpen] = useState(false);
  const articlesLines = useMemo(
    () =>
      articlesQuote
        ? quotePayloadToArticleLines(articlesQuote.orderPayload as QuoteOrderPayload)
        : [],
    [articlesQuote]
  );
  const articlesFallback = useMemo(() => {
    if (!articlesQuote) return [];
    if (articlesLines.length > 0) return [];
    return String(articlesQuote.items || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [articlesQuote, articlesLines.length]);

  // Estado para filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUsers, setFilterUsers] = useState<FilterUserOption[]>([]);
  const [backendFilters, setBackendFilters] = useState({
    estado: "all",
    tomado_por: "all",
    probabilidad: "" as string | number,
    fecha_envio_desde: "",
    fecha_envio_hasta: "",
  });

  // Estado para debounce de búsqueda
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [debouncedProbabilidad, setDebouncedProbabilidad] = useState("" as string | number);

  // Refs para timeouts
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const probabilidadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Verificar si el usuario es admin (solo admin cambia estado con Select)
  const isAdmin = isAdminUser();

  // Obtener permisos del usuario desde localStorage
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const userPermissions = user?.permissions || [];

  // Permiso para crear cotizaciones
  const canCreateQuotes = isAdmin || userPermissions.some(
    (perm: any) => perm.module === "quotations" && perm.actions?.includes("create")
  );

  const [updatingStatusQuoteId, setUpdatingStatusQuoteId] = useState<string | null>(null);

  const handleAdminChangeStatus = async (quoteId: string, nextStatus: string) => {
    // Actualización optimista inmediata en memoria (sin recargar la pestaña)
    setQuotes((prev) =>
      prev.map((item) =>
        item.id === quoteId ? { ...item, status: nextStatus as any } : item
      )
    );
    setUpdatingStatusQuoteId(quoteId);

    try {
      const res = await updateQuoteStatus(quoteId, nextStatus);
      if (!res.success) {
        toast({
          variant: "destructive",
          title: "Error al actualizar estado",
          description: res.errorMessage || "No se pudo cambiar el estado de la cotización.",
        });
        await fetchQuotes();
        return;
      }
      const label = getQuoteStatusInfo(nextStatus).label;
      toast({
        title: "Estado actualizado",
        description: `Estado cambiado a: ${label}`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error al actualizar estado",
        description: err?.message || "No se pudo cambiar el estado.",
      });
      await fetchQuotes();
    } finally {
      setUpdatingStatusQuoteId(null);
    }
  };

  const canCreateOrderFromQuote =
    isAdmin ||
    userPermissions.some(
      (perm: any) =>
        (perm.module === "orders" && perm.actions?.includes("create")) ||
        (perm.module === "quotations" && perm.actions?.includes("update"))
    );

  const canEditQuotes =
    isAdmin ||
    userPermissions.some(
      (perm: any) => perm.module === "quotations" && perm.actions?.includes("update")
    );

  // Función para generar ID con formato Q-### (tres dígitos)
  const getFormattedId = (id: string) => {
    const shortId = id.slice(-3);
    return `Q-${shortId}`;
  };

  // Función para formatear monto con separador de miles
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('CLP', '').trim();
  };

  // Debounce para searchTerm
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(value);
    }, 500);
  };

  // Debounce para probabilidad
  const handleProbabilidadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBackendFilters(prev => ({ ...prev, probabilidad: value }));

    if (probabilidadTimeoutRef.current) {
      clearTimeout(probabilidadTimeoutRef.current);
    }

    probabilidadTimeoutRef.current = setTimeout(() => {
      setDebouncedProbabilidad(value);
    }, 500);
  };

  // Filtrar en frontend por búsqueda general (usando debouncedSearchTerm).
  // Las ya convertidas a orden no deben listarse en Cotizaciones.
  const filteredQuotes = quotes.filter((q) => {
    if (q.status === "ordered") return false;
    if (!debouncedSearchTerm) return true;
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return (
      q.id.toLowerCase().includes(lowerSearch) ||
      q.customerName.toLowerCase().includes(lowerSearch) ||
      q.items.toLowerCase().includes(lowerSearch) ||
      (q.takenBy && q.takenBy.toLowerCase().includes(lowerSearch))
    );
  });

  // Función para limpiar todos los filtros
  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setDebouncedProbabilidad("");

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (probabilidadTimeoutRef.current) clearTimeout(probabilidadTimeoutRef.current);

    setBackendFilters({
      estado: "all",
      tomado_por: "all",
      probabilidad: "",
      fecha_envio_desde: "",
      fecha_envio_hasta: "",
    });
  };

function isUserAllowedForTomadaPor(u: any): boolean {
  if (!u) return false;
  if (u.is_superuser) return true;

  const roles: string[] = [];
  if (Array.isArray(u.roles)) {
    for (const r of u.roles) {
      if (typeof r === "string") roles.push(r);
      else if (r && typeof r === "object" && r.name) roles.push(String(r.name));
    }
  } else if (typeof u.roles === "string") {
    roles.push(u.roles);
  }

  if (typeof u.role === "string") {
    roles.push(u.role);
  } else if (u.role && typeof u.role === "object" && u.role.name) {
    roles.push(String(u.role.name));
  }

  const hasAllowedRole = roles.some((r) => {
    const lower = r.toLowerCase().trim();
    return (
      lower === "administrador" ||
      lower === "admin" ||
      lower === "superadmin" ||
      lower === "administrador general" ||
      lower === "comercial" ||
      lower === "asesor comercial" ||
      lower === "ventas"
    );
  });

  if (hasAllowedRole) return true;

  const areaLower = String(u.area || "").toLowerCase().trim();
  if (
    areaLower === "comercial" ||
    areaLower === "administración" ||
    areaLower === "administracion"
  ) {
    return true;
  }

  return false;
}

  // Cargar usuarios para el filtro "Tomada por" (Solo Administrador y Comercial)
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersData = await http<any[]>(endpoints.users.list()).catch(() => []);
        const filtered = Array.isArray(usersData)
          ? usersData.filter(isUserAllowedForTomadaPor)
          : [];
        const mapped: FilterUserOption[] = filtered.map((u) => ({
          id: String(u.id),
          label:
            `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
            u.username ||
            String(u.id),
        }));
        setFilterUsers(mapped);
      } catch {
        setFilterUsers([]);
      }
    };
    loadUsers();
  }, []);

  // Cargar datos al montar y cuando cambien los filtros del backend
  useEffect(() => {
    const numericProb = debouncedProbabilidad !== "" ? Number(debouncedProbabilidad) : undefined;

    fetchQuotes({
      estado: backendFilters.estado !== "all" ? backendFilters.estado : undefined,
      tomado_por:
        backendFilters.tomado_por !== "all" ? backendFilters.tomado_por : undefined,
      probabilidad: numericProb,
      fecha_envio_desde: backendFilters.fecha_envio_desde || undefined,
      fecha_envio_hasta: backendFilters.fecha_envio_hasta || undefined,
    });
  }, [
    backendFilters.estado,
    backendFilters.tomado_por,
    backendFilters.fecha_envio_desde,
    backendFilters.fecha_envio_hasta,
    debouncedProbabilidad,
    fetchQuotes,
  ]);

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (probabilidadTimeoutRef.current) clearTimeout(probabilidadTimeoutRef.current);
    };
  }, []);

  // Handlers
  const openCreateModal = () => {
    setEditQuote(null);
    setIsFormOpen(true);
  };

  const openEditModal = (quote: Quote) => {
    if (quote.status === "ordered" || quote.status === "inactive") {
      toast({
        variant: "destructive",
        title: "No editable",
        description:
          quote.status === "ordered"
            ? "Las cotizaciones ya ordenadas no se pueden editar."
            : "Las cotizaciones inactivas no se pueden editar.",
      });
      return;
    }
    setEditQuote(quote);
    setIsFormOpen(true);
  };

  // Deep-link desde notificaciones: /quotations?highlight=<quoteId>
  useEffect(() => {
    const highlight = (searchParams.get("highlight") || "").trim();
    if (!highlight || highlightHandledRef.current === highlight) return;

    let cancelled = false;
    void (async () => {
      const quote = await fetchQuoteById(highlight);
      if (cancelled) return;
      highlightHandledRef.current = highlight;
      if (quote) {
        setHighlightedQuoteId(quote.id);
        if (quote.status !== "ordered" && quote.status !== "inactive") {
          setEditQuote(quote);
          setIsFormOpen(true);
        }
      } else {
        toast({
          title: "Cotización no encontrada",
          description: "La notificación apunta a una cotización que ya no está disponible.",
          variant: "destructive",
        });
      }
      const next = new URLSearchParams(searchParams);
      next.delete("highlight");
      setSearchParams(next, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("highlight")]);

  const handlePlaceOrder = async (quote: Quote) => {
    if (!quote.hasOrderPayload) {
      toast({
        variant: "destructive",
        title: "Cotización incompleta",
        description:
          "Esta cotización no tiene el detalle de productos. Créala de nuevo con el formulario completo.",
      });
      return;
    }
    setIsPlacingOrderId(quote.id);
    try {
      const result = await placeOrderFromQuote(quote.id);
      if (result.success) {
        toast({
          title: "Orden creada",
          description:
            "La cotización pasó a Órdenes y ya no se muestra en Cotizaciones.",
        });
        navigate("/orders");
      } else {
        toast({
          variant: "destructive",
          title: "No se pudo crear la orden",
          description: result.errorMessage || "Intenta de nuevo.",
        });
      }
    } finally {
      setIsPlacingOrderId(null);
    }
  };

  const handlePrintQuote = async (quote: Quote) => {
    setPrintingQuoteId(quote.id);
    try {
      await printQuoteProductionGuide(quote, {
        refreshQuote: () => fetchQuoteById(quote.id),
      });
    } catch (err) {
      toast({
        title: "No se pudo generar la cotización",
        description:
          err instanceof Error
            ? err.message
            : "Intenta de nuevo o permite ventanas emergentes.",
        variant: "destructive",
      });
    } finally {
      setPrintingQuoteId(null);
    }
  };

  // Estados de carga y error
  if (loading && quotes.length === 0) {
    return (
      <AppLayout title="Cotizaciones" subtitle="Gestión de cotizaciones y propuestas" eyebrow="Comercial">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Cargando cotizaciones…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && quotes.length === 0) {
    return (
      <AppLayout title="Cotizaciones" subtitle="Gestión de cotizaciones y propuestas" eyebrow="Comercial">
        <Card>
          <CardContent className="py-8">
            <p className="text-destructive text-center">{error}</p>
            <div className="text-center mt-4">
              <Button onClick={() => fetchQuotes()}>Reintentar</Button>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Cotizaciones" subtitle="Gestión de cotizaciones y propuestas" eyebrow="Comercial">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">Cotizaciones</CardTitle>
          {canCreateQuotes && (
            <Button
              size="sm"
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={openCreateModal}
            >
              <Plus className="h-4 w-4 mr-1" /> Nueva cotización
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {/* Panel de Filtros - Una sola fila */}
          <div className="flex flex-nowrap items-end gap-2 p-3 border-b border-border bg-muted/5 overflow-x-auto">
            {/* Buscador General - Frontend */}
            <div className="flex-1 min-w-[120px] max-w-[180px] space-y-0.5">
              <Label htmlFor="search" className="text-xs font-medium text-muted-foreground">Buscar</Label>
              <Input
                id="search"
                placeholder="ID, Cliente..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="h-9 text-sm px-2.5"
              />
            </div>

            {/* Estado - Backend */}
            <div className="flex-1 min-w-[90px] max-w-[140px] space-y-0.5">
              <Label className="text-xs font-medium text-muted-foreground">Estado</Label>
              <Select
                value={backendFilters.estado}
                onValueChange={(val) => setBackendFilters(prev => ({ ...prev, estado: val }))}
              >
                <SelectTrigger className="h-9 text-sm px-2.5">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="approved">Aprobada</SelectItem>
                  <SelectItem value="rejected">Rechazada</SelectItem>
                  <SelectItem value="in_review">En Revisión</SelectItem>
                  <SelectItem value="inactive">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tomado por - Select de usuarios */}
            <div className="flex-1 min-w-[110px] max-w-[180px] space-y-0.5">
              <Label className="text-xs font-medium text-muted-foreground">Tomada por</Label>
              <Select
                value={backendFilters.tomado_por}
                onValueChange={(val) => setBackendFilters(prev => ({ ...prev, tomado_por: val }))}
              >
                <SelectTrigger className="h-9 text-sm px-2.5">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {filterUsers.map((u) => (
                    <SelectItem key={u.id} value={u.label}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Probabilidad / Intención - Backend con debounce */}
            <div className="flex-1 min-w-[80px] max-w-[110px] space-y-0.5">
              <Label htmlFor="probabilidad" className="text-xs font-medium text-muted-foreground">Intención %</Label>
              <Input
                id="probabilidad"
                type="number"
                min="0"
                max="100"
                placeholder="Ej. 80"
                value={backendFilters.probabilidad}
                onChange={handleProbabilidadChange}
                className="h-9 text-sm px-2.5"
              />
            </div>

            {/* Fecha Envío Desde - Backend */}
            <div className="shrink-0 w-[156px] space-y-0.5">
              <Label htmlFor="desde" className="text-xs font-medium text-muted-foreground">Envío desde</Label>
              <Input
                id="desde"
                type="date"
                value={backendFilters.fecha_envio_desde}
                onChange={(e) => setBackendFilters(prev => ({ ...prev, fecha_envio_desde: e.target.value }))}
                className="h-9 w-full box-border text-sm leading-none px-2.5 py-0 overflow-hidden [&::-webkit-datetime-edit]:min-w-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
              />
            </div>

            {/* Fecha Envío Hasta - Backend */}
            <div className="shrink-0 w-[156px] space-y-0.5">
              <Label htmlFor="hasta" className="text-xs font-medium text-muted-foreground">Envío hasta</Label>
              <Input
                id="hasta"
                type="date"
                value={backendFilters.fecha_envio_hasta}
                onChange={(e) => setBackendFilters(prev => ({ ...prev, fecha_envio_hasta: e.target.value }))}
                className="h-9 w-full box-border text-sm leading-none px-2.5 py-0 overflow-hidden [&::-webkit-datetime-edit]:min-w-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
              />
            </div>

            {/* Botón Limpiar - más pequeño */}
            <div className="flex items-end pb-0.5">
              <Button
                variant="destructive"
                className="h-9 px-3 text-sm bg-red-500 hover:bg-red-600 text-white whitespace-nowrap"
                onClick={handleClearFilters}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Limpiar
              </Button>
            </div>
          </div>

          {/* Tabla */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px] text-xs">ID</TableHead>
                <TableHead className="min-w-[120px] text-xs">Cliente</TableHead>
                <TableHead className="w-[88px] text-center text-xs">Artículos</TableHead>
                <TableHead className="w-[90px] text-right text-xs">Monto</TableHead>
                <TableHead className="w-[110px] text-xs">Estado</TableHead>
                <TableHead className="w-[100px] text-xs">Tomada por</TableHead>
                <TableHead className="w-[80px] text-center text-xs">Intención</TableHead>
                <TableHead className="w-[85px] text-center text-xs">Envío</TableHead>
                <TableHead className="w-[85px] text-xs">Validez</TableHead>
                <TableHead className="w-[60px] text-center text-xs">Novedades</TableHead>
                <TableHead className="w-[110px] text-center text-xs">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground text-sm">
                    {quotes.length === 0 ? "No hay cotizaciones disponibles" : "No hay resultados para los filtros aplicados"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuotes.map((q) => (
                  <TableRow
                    key={q.id}
                    className={cn(
                      "hover:bg-muted/50",
                      highlightedQuoteId === q.id && "bg-primary/10 ring-1 ring-primary/40"
                    )}
                  >
                    <TableCell className="font-semibold text-foreground text-sm">
                      {getFormattedId(q.id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm truncate max-w-[140px]">
                      {q.customerName}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Ver artículos de la cotización"
                        aria-label="Ver artículos de la cotización"
                        disabled={
                          !q.items &&
                          !(q.orderPayload as QuoteOrderPayload | undefined)?.items?.length
                        }
                        onClick={() => {
                          setArticlesQuote(q);
                          setArticlesOpen(true);
                        }}
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right text-foreground whitespace-nowrap text-sm tabular-nums">
                      {formatAmount(q.totalAmount)}
                    </TableCell>
                    <TableCell className="min-w-[125px]">
                      {isAdmin ? (
                        <Select
                          value={q.status}
                          disabled={updatingStatusQuoteId === q.id}
                          onValueChange={(nextVal) => handleAdminChangeStatus(q.id, nextVal)}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-7 w-auto min-w-[95px] rounded-full px-3 py-0 text-xs font-semibold border shadow-2xs transition-all justify-between gap-1.5 focus:ring-1 focus:ring-ring cursor-pointer select-none",
                              getQuoteStatusInfo(q.status).triggerClass
                            )}
                          >
                            <span className="text-xs font-semibold leading-none">
                              {getQuoteStatusInfo(q.status).label}
                            </span>
                          </SelectTrigger>
                          <SelectContent align="start" className="min-w-[130px]">
                            {Object.entries(QUOTE_STATUS_CONFIG).map(([key, cfg]) => (
                              <SelectItem key={key} value={key} className="text-xs cursor-pointer py-1.5">
                                <span
                                  className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                                    cfg.badgeClass
                                  )}
                                >
                                  {cfg.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center">
                          <StatusBadge status={q.status} compact />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm truncate max-w-[120px]">
                      {q.takenBy || "-"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${(q.probability || 0) >= 80 ? 'bg-green-100 text-green-800' :
                        (q.probability || 0) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                        {q.probability || 0}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground text-sm">
                      {q.shippingDate ? new Date(q.shippingDate).toLocaleDateString('es-ES') : "–"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(q.validUntil).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        title="Ver novedades"
                        onClick={() => {
                          setNovedadesQuote(q);
                          setNovedadesOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-md px-1.5 py-0.5 transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-sm tabular-nums">
                          {q.novedadesCount ?? 0}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Imprimir cotización (PDF)"
                          aria-label="Imprimir cotización"
                          disabled={printingQuoteId === q.id}
                          onClick={() => handlePrintQuote(q)}
                          className="h-8 w-8 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                        >
                          {printingQuoteId === q.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </Button>
                        {canEditQuotes &&
                          q.status !== "ordered" &&
                          q.status !== "inactive" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs gap-1"
                              onClick={() => openEditModal(q)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                          )}
                        {canCreateOrderFromQuote && q.status === "approved" && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 px-2.5 text-xs gap-1"
                            disabled={isPlacingOrderId === q.id}
                            onClick={() => handlePlaceOrder(q)}
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            {isPlacingOrderId === q.id ? "Ordenando..." : "Ordenar"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Nueva / editar cotización — mismo formulario que Nueva orden */}
      <NewOrderDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditQuote(null);
        }}
        mode="quote"
        editQuote={editQuote}
        onSuccess={() => {
          fetchQuotes();
        }}
      />

      <QuoteNovedadesDialog
        open={novedadesOpen}
        onOpenChange={(open) => {
          setNovedadesOpen(open);
          if (!open) setNovedadesQuote(null);
        }}
        quoteId={novedadesQuote?.id ?? null}
        quoteLabel={
          novedadesQuote
            ? `${getFormattedId(novedadesQuote.id)} · ${novedadesQuote.customerName}`
            : undefined
        }
        fetchNovedades={fetchQuoteNovedades}
        createNovedad={createQuoteNovedad}
      />

      <ArticlesDetailDialog
        open={articlesOpen}
        onOpenChange={(open) => {
          setArticlesOpen(open);
          if (!open) setArticlesQuote(null);
        }}
        documentLabel={articlesQuote ? getFormattedId(articlesQuote.id) : ""}
        customerName={articlesQuote?.customerName}
        lines={articlesLines}
        fallbackLines={articlesFallback}
      />
    </AppLayout>
  );
}
