import { useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  DollarSign,
  Factory,
  FileText,
  ImagePlus,
  MessageSquare,
  Paperclip,
  Plus,
  Scissors,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useGetSatellites } from "@/hooks/useSatellites";
import { useGetMaterials } from "@/hooks/useGetMaterials";
import type { ProductionOrder } from "@/data/mockData";

export type MoldStatus = "pendiente" | "en_proceso" | "listo" | "aprobado";

export type CardAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

export type CardNovedad = {
  id: string;
  texto: string;
  autorNombre: string;
  autorId?: string | null;
  createdAt: string;
  /** Imágenes adjuntas como evidencia de la novedad */
  images?: CardAttachment[];
  /** Archivos adjuntos como evidencia de la novedad */
  files?: CardAttachment[];
};

export type KanbanCardFormValues = {
  items: string;
  assignee: string;
  quantity: number;
  dueDate: string;
  satelliteId: string;
  satelliteCost: string;
  moldEnabled: boolean;
  moldStatus: MoldStatus;
  moldResponsible: string;
  moldSizes: string;
  moldCost: string;
  moldNotes: string;
  laborCostEnabled: boolean;
  laborCostPerUnit: string;
  cardImages: CardAttachment[];
  cardFiles: CardAttachment[];
  novedades: CardNovedad[];
  requestedMaterials: {
    materialId: string;
    materialName: string;
    quantity: number;
    unitCost?: number;
  }[];
};

function readCurrentUserLabel(): { id: string | null; name: string } {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return { id: null, name: "Usuario" };
    const u = JSON.parse(raw) as {
      id?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    const name =
      [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
      u.username ||
      "Usuario";
    return { id: u.id || null, name };
  } catch {
    return { id: null, name: "Usuario" };
  }
}

const MOLD_STATUS_OPTIONS: { value: MoldStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_proceso", label: "En proceso" },
  { value: "listo", label: "Listo" },
  { value: "aprobado", label: "Aprobado" },
];

type KanbanCardEditDialogProps = {
  open: boolean;
  mode: "add" | "edit";
  initial?: Partial<KanbanCardFormValues> | null;
  onOpenChange: (open: boolean) => void;
  onSave: (values: KanbanCardFormValues & { satelliteName: string | null }) => void | Promise<void>;
  saving?: boolean;
  /** Si false, oculta la sección de solicitar materiales. */
  canRequestInventory?: boolean;
  /** Si true, el formulario no permite guardar cambios. */
  readOnly?: boolean;
  /** Admin: editar descripción, responsable, cantidad y fecha. */
  canEditCoreFields?: boolean;
  /** Admin: asignar satélite externo. */
  canAssignSatellite?: boolean;
};

const NONE_SATELLITE = "__none__";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

async function filesToAttachments(fileList: FileList | null): Promise<CardAttachment[]> {
  if (!fileList?.length) return [];
  const files = Array.from(fileList);
  return Promise.all(
    files.map(
      (file) =>
        new Promise<CardAttachment>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              name: file.name,
              size: file.size,
              type: file.type || "application/octet-stream",
              dataUrl: String(reader.result || ""),
            });
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        })
    )
  );
}

function SectionCard({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function KanbanCardEditDialog({
  open,
  mode,
  initial,
  onOpenChange,
  onSave,
  saving = false,
  canRequestInventory = true,
  readOnly = false,
  canEditCoreFields = false,
  canAssignSatellite = false,
}: KanbanCardEditDialogProps) {
  const { satellites, isLoading: loadingSatellites } = useGetSatellites({
    estado: "active",
  });
  const { materials, isLoading: loadingMaterials } = useGetMaterials({});

  const [items, setItems] = useState("");
  const [assignee, setAssignee] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dueDate, setDueDate] = useState("");
  const [satelliteId, setSatelliteId] = useState(NONE_SATELLITE);
  const [satelliteCost, setSatelliteCost] = useState("");
  const [moldEnabled, setMoldEnabled] = useState(false);
  const [moldStatus, setMoldStatus] = useState<MoldStatus>("pendiente");
  const [moldResponsible, setMoldResponsible] = useState("");
  const [moldSizes, setMoldSizes] = useState("");
  const [moldCost, setMoldCost] = useState("0.00");
  const [moldNotes, setMoldNotes] = useState("");
  const [laborCostEnabled, setLaborCostEnabled] = useState(false);
  const [laborCostPerUnit, setLaborCostPerUnit] = useState("0.00");
  const [cardImages, setCardImages] = useState<CardAttachment[]>([]);
  const [cardFiles, setCardFiles] = useState<CardAttachment[]>([]);
  const [novedades, setNovedades] = useState<CardNovedad[]>([]);
  const [nuevaNovedad, setNuevaNovedad] = useState("");
  const [novedadImages, setNovedadImages] = useState<CardAttachment[]>([]);
  const [novedadFiles, setNovedadFiles] = useState<CardAttachment[]>([]);
  const [requestedMaterials, setRequestedMaterials] = useState<
    { materialId: string; materialName: string; quantity: number; unitCost?: number }[]
  >([]);
  const [pickMaterialId, setPickMaterialId] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const imagesInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const novedadImagesInputRef = useRef<HTMLInputElement>(null);
  const novedadFilesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setItems(initial?.items || "");
    setAssignee(initial?.assignee || "");
    setQuantity(initial?.quantity ?? 1);
    setDueDate(initial?.dueDate || "");
    setSatelliteId(initial?.satelliteId || NONE_SATELLITE);
    setSatelliteCost(initial?.satelliteCost || "");
    setMoldEnabled(Boolean(initial?.moldEnabled));
    setMoldStatus((initial?.moldStatus as MoldStatus) || "pendiente");
    setMoldResponsible(initial?.moldResponsible || "");
    setMoldSizes(initial?.moldSizes || "");
    setMoldCost(initial?.moldCost || "0.00");
    setMoldNotes(initial?.moldNotes || "");
    setLaborCostEnabled(Boolean(initial?.laborCostEnabled));
    setLaborCostPerUnit(initial?.laborCostPerUnit ?? "0.00");
    setCardImages(initial?.cardImages ?? []);
    setCardFiles(initial?.cardFiles ?? []);
    setNovedades(initial?.novedades ?? []);
    setNuevaNovedad("");
    setNovedadImages([]);
    setNovedadFiles([]);
    setRequestedMaterials(initial?.requestedMaterials || []);
    setPickMaterialId("");
    setPickQty("1");
  }, [open, initial]);

  const activeSatellites = useMemo(
    () => satellites.filter((s) => s.status === "active"),
    [satellites]
  );

  const selectedSatelliteName = useMemo(() => {
    if (!satelliteId || satelliteId === NONE_SATELLITE) return null;
    return activeSatellites.find((s) => s.id === satelliteId)?.name || null;
  }, [activeSatellites, satelliteId]);

  const laborTotalEstimado = (Number(quantity) || 0) * (Number(laborCostPerUnit) || 0);

  const addMaterialRequest = () => {
    if (!pickMaterialId) return;
    const mat = materials.find((m) => m.id === pickMaterialId);
    if (!mat) return;
    const qty = Math.max(0.01, Number(pickQty) || 1);
    const unitCost = Number(mat.unit_cost) || 0;
    setRequestedMaterials((prev) => {
      const existing = prev.find((p) => p.materialId === mat.id);
      if (existing) {
        return prev.map((p) =>
          p.materialId === mat.id
            ? { ...p, quantity: p.quantity + qty, unitCost: unitCost || p.unitCost }
            : p
        );
      }
      return [
        ...prev,
        {
          materialId: mat.id,
          materialName: mat.name,
          quantity: qty,
          unitCost,
        },
      ];
    });
    setPickMaterialId("");
    setPickQty("1");
  };

  const removeMaterialRequest = (materialId: string) => {
    setRequestedMaterials((prev) => prev.filter((p) => p.materialId !== materialId));
  };

  const handleImagesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const next = await filesToAttachments(e.target.files);
      if (next.length) setCardImages((prev) => [...prev, ...next]);
    } finally {
      e.target.value = "";
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const next = await filesToAttachments(e.target.files);
      if (next.length) setCardFiles((prev) => [...prev, ...next]);
    } finally {
      e.target.value = "";
    }
  };

  const handleNovedadImagesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const next = await filesToAttachments(e.target.files);
      if (next.length) setNovedadImages((prev) => [...prev, ...next]);
    } finally {
      e.target.value = "";
    }
  };

  const handleNovedadFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const next = await filesToAttachments(e.target.files);
      if (next.length) setNovedadFiles((prev) => [...prev, ...next]);
    } finally {
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if ((!canRequestInventory && readOnly) || !items.trim() || saving) return;
    const trimmedNote = nuevaNovedad.trim();
    let nextNovedades = novedades;
    if (trimmedNote) {
      const author = readCurrentUserLabel();
      nextNovedades = [
        {
          id: `nov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          texto: trimmedNote,
          autorNombre: author.name,
          autorId: author.id,
          createdAt: new Date().toISOString(),
          images: novedadImages,
          files: novedadFiles,
        },
        ...novedades,
      ];
    }
    await onSave({
      items: items.trim(),
      assignee: assignee.trim(),
      quantity: Number(quantity) || 0,
      dueDate,
      satelliteId: satelliteId === NONE_SATELLITE ? "" : satelliteId,
      satelliteCost,
      moldEnabled,
      moldStatus,
      moldResponsible: moldResponsible.trim(),
      moldSizes: moldSizes.trim(),
      moldCost,
      moldNotes: moldNotes.trim(),
      laborCostEnabled,
      laborCostPerUnit,
      cardImages,
      cardFiles,
      novedades: nextNovedades,
      requestedMaterials,
      satelliteName: selectedSatelliteName,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Nueva tarjeta" : "Editar tarjeta"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Descripción</Label>
            <Input
              value={items}
              onChange={(e) => setItems(e.target.value)}
              placeholder="Descripción"
              className={cn("h-10 rounded-lg", !canEditCoreFields && "bg-muted/40")}
              disabled={readOnly || !canEditCoreFields}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Responsable</Label>
              <Input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Nombre"
                className={cn("h-10 rounded-lg", !canEditCoreFields && "bg-muted/40")}
                disabled={readOnly || !canEditCoreFields}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cantidad</Label>
              <Input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className={cn("h-10 rounded-lg", !canEditCoreFields && "bg-muted/40")}
                disabled={readOnly || !canEditCoreFields}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Fecha de entrega</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={cn("h-10 rounded-lg", !canEditCoreFields && "bg-muted/40")}
              disabled={readOnly || !canEditCoreFields}
            />
            {!canEditCoreFields ? (
              <p className="text-[11px] text-muted-foreground">
                Solo un administrador puede modificar descripción, responsable, cantidad y fecha.
              </p>
            ) : null}
          </div>

          {canRequestInventory ? (
          <SectionCard icon={Boxes} title="Solicitar materiales del inventario">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[160px] space-y-1">
                <Label className="text-[10px] text-muted-foreground">Material</Label>
                <Select value={pickMaterialId} onValueChange={setPickMaterialId}>
                  <SelectTrigger className="h-9">
                    <SelectValue
                      placeholder={loadingMaterials ? "Cargando..." : "Selecciona material"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-[10px] text-muted-foreground">Cant.</Label>
                <Input
                  value={pickQty}
                  onChange={(e) => setPickQty(e.target.value)}
                  className="h-9"
                  inputMode="decimal"
                />
              </div>
              <Button
                type="button"
                size="icon"
                className="h-9 w-9 bg-red-600 hover:bg-red-700 text-white shrink-0"
                onClick={addMaterialRequest}
                disabled={!pickMaterialId}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {requestedMaterials.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin materiales solicitados. Al guardar la tarjeta se descuenta del inventario solo
                la cantidad nueva (o el incremento si ya habías solicitado antes).
              </p>
            ) : (
              <ul className="space-y-1.5">
                {requestedMaterials.map((m) => (
                  <li
                    key={m.materialId}
                    className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate font-medium">
                      {m.materialName}{" "}
                      <span className="text-muted-foreground font-normal">× {m.quantity}</span>
                    </span>
                    <button
                      type="button"
                      className="text-red-600 hover:underline shrink-0"
                      onClick={() => removeMaterialRequest(m.materialId)}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          ) : null}

          <SectionCard
            icon={Scissors}
            title="Moldería (patronaje)"
            action={<Switch checked={moldEnabled} onCheckedChange={setMoldEnabled} disabled={readOnly} />}
          >
            {!moldEnabled ? (
              <p className="text-xs text-muted-foreground">
                Actívalo en las tarjetas de Diseño para registrar el molde, las tallas escaladas y
                su costo.
              </p>
            ) : (
              <div className="space-y-3 pt-1 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Estado del molde</Label>
                    <Select
                      value={moldStatus}
                      onValueChange={(v) => setMoldStatus(v as MoldStatus)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MOLD_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Patronista / responsable</Label>
                    <Input
                      value={moldResponsible}
                      onChange={(e) => setMoldResponsible(e.target.value)}
                      placeholder="Ej. Diego R. o satélite"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Tallas escaladas</Label>
                    <Input
                      value={moldSizes}
                      onChange={(e) => setMoldSizes(e.target.value)}
                      placeholder="Ej. S, M, L, XL / 8-16"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Costo de moldería</Label>
                    <Input
                      value={moldCost}
                      onChange={(e) => setMoldCost(e.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Observaciones de moldería</Label>
                  <Input
                    value={moldNotes}
                    onChange={(e) => setMoldNotes(e.target.value)}
                    placeholder="Ej. Ajustar sisa, molde base v2"
                    className="h-10"
                  />
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  El costo de moldería suma al <strong>costo real</strong> de la orden y aparece
                  en Reportes &gt; Costos.
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={DollarSign}
            title="Costo de mano de obra"
            action={<Switch checked={laborCostEnabled} onCheckedChange={setLaborCostEnabled} />}
          >
            {!laborCostEnabled ? (
              <p className="text-xs text-muted-foreground">
                Registra el costo de mano de obra asociado a esta etapa.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Costo por unidad</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={laborCostPerUnit}
                    onChange={(e) => setLaborCostPerUnit(e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">Total estimado</Label>
                  <p className="h-10 flex items-center text-sm tabular-nums text-foreground">
                    {formatMoney(laborTotalEstimado)}
                  </p>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Factory} title="Asignar a satélite (proveedor externo)">
            {canAssignSatellite ? (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={satelliteId}
                    onValueChange={setSatelliteId}
                    disabled={readOnly}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-10 flex-1",
                        satelliteId !== NONE_SATELLITE && "border-red-500 focus:ring-red-500"
                      )}
                    >
                      <SelectValue
                        placeholder={
                          loadingSatellites ? "Cargando satélites..." : "— Sin satélite —"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_SATELLITE}>— Sin satélite —</SelectItem>
                      {activeSatellites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.specialties?.length
                            ? ` · ${s.specialties.slice(0, 2).join(", ")}`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={satelliteCost}
                    onChange={(e) => setSatelliteCost(e.target.value)}
                    placeholder="Costo total"
                    className="h-10 sm:w-36"
                    inputMode="decimal"
                    disabled={readOnly || satelliteId === NONE_SATELLITE}
                  />
                </div>
                {!loadingSatellites && activeSatellites.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay satélites activos. Créalos en el módulo Satélites.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={
                      satelliteId !== NONE_SATELLITE && selectedSatelliteName
                        ? selectedSatelliteName
                        : "Sin satélite"
                    }
                    className="h-10 flex-1 bg-muted/40"
                    disabled
                    readOnly
                  />
                  <Input
                    value={satelliteCost || "—"}
                    className="h-10 sm:w-36 bg-muted/40"
                    disabled
                    readOnly
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Solo un administrador puede modificar la asignación a satélite.
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={ImagePlus}
            title="Imágenes"
            action={
              <>
                <input
                  ref={imagesInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImagesSelected}
                />
                <button
                  type="button"
                  className="text-xs font-medium text-red-600 hover:underline"
                  onClick={() => imagesInputRef.current?.click()}
                >
                  + Subir imágenes
                </button>
              </>
            }
          >
            {cardImages.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin imágenes. Sube fotos de referencia o avance.
              </p>
            ) : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {cardImages.map((img) => (
                  <li
                    key={img.id}
                    className="relative group rounded-lg border overflow-hidden bg-muted/30"
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      className="h-20 w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() =>
                        setCardImages((prev) => prev.filter((p) => p.id !== img.id))
                      }
                      aria-label={`Quitar ${img.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <p className="truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                      {img.name}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            icon={Paperclip}
            title="Archivos adjuntos"
            action={
              <>
                <input
                  ref={filesInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFilesSelected}
                />
                <button
                  type="button"
                  className="text-xs font-medium text-red-600 hover:underline"
                  onClick={() => filesInputRef.current?.click()}
                >
                  + Adjuntar archivo
                </button>
              </>
            }
          >
            {cardFiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin archivos adjuntos.</p>
            ) : (
              <ul className="space-y-1.5">
                {cardFiles.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-red-600 shrink-0" />
                      <div className="min-w-0">
                        <a
                          href={file.dataUrl}
                          download={file.name}
                          className="font-medium truncate block hover:underline"
                        >
                          {file.name}
                        </a>
                        <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-red-600 hover:underline shrink-0"
                      onClick={() =>
                        setCardFiles((prev) => prev.filter((p) => p.id !== file.id))
                      }
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard icon={MessageSquare} title="Novedades">
            <p className="text-xs text-muted-foreground">
              Deja aquí cualquier novedad o nota para que el administrador la revise.
              Puedes adjuntar imagen o archivo como evidencia.
            </p>
            <Textarea
              value={nuevaNovedad}
              onChange={(e) => setNuevaNovedad(e.target.value)}
              placeholder="Escribe una novedad o seguimiento..."
              className="min-h-[88px] text-sm resize-none rounded-lg"
              disabled={saving || (readOnly && !canRequestInventory)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={novedadImagesInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleNovedadImagesSelected}
              />
              <input
                ref={novedadFilesInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleNovedadFilesSelected}
              />
              <button
                type="button"
                className="text-xs font-medium text-red-600 hover:underline inline-flex items-center gap-1"
                onClick={() => novedadImagesInputRef.current?.click()}
                disabled={saving || (readOnly && !canRequestInventory)}
              >
                <ImagePlus className="h-3.5 w-3.5" />
                + Evidencia imagen
              </button>
              <button
                type="button"
                className="text-xs font-medium text-red-600 hover:underline inline-flex items-center gap-1"
                onClick={() => novedadFilesInputRef.current?.click()}
                disabled={saving || (readOnly && !canRequestInventory)}
              >
                <Paperclip className="h-3.5 w-3.5" />
                + Evidencia archivo
              </button>
            </div>
            {(novedadImages.length > 0 || novedadFiles.length > 0) && (
              <div className="space-y-2 rounded-lg border bg-muted/20 p-2.5">
                {novedadImages.length > 0 ? (
                  <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {novedadImages.map((img) => (
                      <li
                        key={img.id}
                        className="relative group rounded-lg border overflow-hidden bg-muted/30"
                      >
                        <img
                          src={img.dataUrl}
                          alt={img.name}
                          className="h-16 w-full object-cover"
                        />
                        <button
                          type="button"
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                          onClick={() =>
                            setNovedadImages((prev) => prev.filter((p) => p.id !== img.id))
                          }
                          aria-label={`Quitar ${img.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {novedadFiles.length > 0 ? (
                  <ul className="space-y-1">
                    {novedadFiles.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate inline-flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-red-600 shrink-0" />
                          {file.name}
                        </span>
                        <button
                          type="button"
                          className="text-red-600 hover:underline shrink-0"
                          onClick={() =>
                            setNovedadFiles((prev) => prev.filter((p) => p.id !== file.id))
                          }
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
            {novedades.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aún no hay novedades en esta tarjeta.</p>
            ) : (
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {novedades.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border bg-muted/20 px-2.5 py-2 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground/80 truncate">
                        {n.autorNombre || "Usuario"}
                      </span>
                      <span className="shrink-0">
                        {n.createdAt
                          ? new Date(n.createdAt).toLocaleString("es-CO", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{n.texto}</p>
                    {((n.images || []).length > 0 || (n.files || []).length > 0) && (
                      <p className="text-[10px] text-muted-foreground">
                        Evidencia: {(n.images || []).length} imagen(es),{" "}
                        {(n.files || []).length} archivo(s)
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={(readOnly && !canRequestInventory) || !items.trim() || saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function cardFormFromProductionOrder(card: ProductionOrder): KanbanCardFormValues {
  return {
    items: card.items,
    assignee: card.assignee,
    quantity: card.quantity,
    dueDate: card.dueDate,
    satelliteId: card.satelliteId || "",
    satelliteCost:
      card.satelliteCost != null && Number.isFinite(card.satelliteCost)
        ? String(card.satelliteCost)
        : "",
    moldEnabled: Boolean(card.moldEnabled),
    moldStatus: (card.moldStatus as MoldStatus) || "pendiente",
    moldResponsible: card.moldResponsible || "",
    moldSizes: card.moldSizes || "",
    moldCost:
      card.moldCost != null && Number.isFinite(card.moldCost)
        ? String(card.moldCost)
        : "0.00",
    moldNotes: card.moldNotes || "",
    laborCostEnabled: Boolean(card.laborCostEnabled),
    laborCostPerUnit:
      card.laborCostPerUnit != null && Number.isFinite(card.laborCostPerUnit)
        ? String(card.laborCostPerUnit)
        : "0.00",
    cardImages: card.cardImages || [],
    cardFiles: card.cardFiles || [],
    novedades: card.novedades || [],
    requestedMaterials: card.requestedMaterials || [],
  };
}
