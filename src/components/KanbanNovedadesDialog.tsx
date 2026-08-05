import { FileText, ImagePlus, MessageSquare, Paperclip } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProductionOrder } from "@/data/mockData";
import type { CardAttachment, CardNovedad } from "@/components/KanbanCardEditDialog";

type KanbanNovedadesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: ProductionOrder | null;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(file: CardAttachment) {
  return Boolean(file.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name));
}

function EvidenceBlock({
  images,
  files,
  emptyLabel,
}: {
  images: CardAttachment[];
  files: CardAttachment[];
  emptyLabel: string;
}) {
  if (images.length === 0 && files.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {images.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1">
            <ImagePlus className="h-3 w-3 text-red-600" />
            Imágenes
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {images.map((img) => (
              <a
                key={img.id}
                href={img.dataUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border overflow-hidden bg-muted/30 block hover:opacity-90"
                title={img.name}
              >
                <img src={img.dataUrl} alt={img.name} className="h-24 w-full object-cover" />
                <p className="truncate px-1.5 py-1 text-[10px] text-muted-foreground">{img.name}</p>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1">
            <Paperclip className="h-3 w-3 text-red-600" />
            Archivos
          </p>
          <ul className="space-y-1.5">
            {files.map((file) => (
              <li key={file.id}>
                <a
                  href={file.dataUrl}
                  download={file.name}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted/40"
                >
                  <FileText className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="text-muted-foreground shrink-0">({formatBytes(file.size)})</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function splitEvidence(n: CardNovedad) {
  const all = [...(n.images || []), ...(n.files || [])];
  const images = all.filter(isImageAttachment);
  const files = all.filter((f) => !isImageAttachment(f));
  return { images, files };
}

export function KanbanNovedadesDialog({
  open,
  onOpenChange,
  card,
}: KanbanNovedadesDialogProps) {
  const novedades = card?.novedades || [];
  const cardImages = card?.cardImages || [];
  const cardFiles = card?.cardFiles || [];
  const hasCardEvidence = cardImages.length > 0 || cardFiles.length > 0;
  const anyNovedadEvidence = novedades.some(
    (n) => (n.images || []).length > 0 || (n.files || []).length > 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-red-600" />
            Novedades
            {card ? (
              <span className="font-normal text-muted-foreground text-sm truncate">
                — ORD-{card.orderId.slice(0, 3)} · {card.customerName}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {novedades.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aún no hay novedades en esta tarjeta.
            </p>
          ) : (
            novedades.map((n) => {
              const { images, files } = splitEvidence(n);
              return (
                <article
                  key={n.id}
                  className="rounded-xl border bg-card p-3.5 space-y-3"
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
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{n.texto}</p>
                  <div className="pt-1 border-t space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Evidencia
                    </p>
                    <EvidenceBlock
                      images={images}
                      files={files}
                      emptyLabel="Sin evidencia adjunta en esta novedad."
                    />
                  </div>
                </article>
              );
            })
          )}

          {/* Adjuntos de la tarjeta como respaldo si ninguna novedad trae evidencia propia */}
          {hasCardEvidence && !anyNovedadEvidence ? (
            <div className="rounded-xl border bg-muted/20 p-3.5 space-y-3">
              <p className="text-sm font-semibold inline-flex items-center gap-1.5">
                <Paperclip className="h-4 w-4 text-red-600" />
                Adjuntos de la tarjeta
              </p>
              <EvidenceBlock
                images={cardImages}
                files={cardFiles}
                emptyLabel="Sin adjuntos."
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
