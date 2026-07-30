import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, MessageSquare, Plus } from "lucide-react";
import type { QuoteNovedad } from "@/hooks/useQuotes";

interface QuoteNovedadesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string | null;
  quoteLabel?: string;
  fetchNovedades: (quoteId: string) => Promise<{
    success: boolean;
    data: QuoteNovedad[];
    errorMessage: string | null;
  }>;
  createNovedad: (
    quoteId: string,
    texto: string
  ) => Promise<{
    success: boolean;
    data: QuoteNovedad | null;
    errorMessage: string | null;
  }>;
}

export function QuoteNovedadesDialog({
  open,
  onOpenChange,
  quoteId,
  quoteLabel,
  fetchNovedades,
  createNovedad,
}: QuoteNovedadesDialogProps) {
  const [items, setItems] = useState<QuoteNovedad[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !quoteId) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setTexto("");
      const result = await fetchNovedades(quoteId);
      if (cancelled) return;
      if (result.success) {
        setItems(result.data);
      } else {
        setItems([]);
        setError(result.errorMessage || "No se pudieron cargar las novedades");
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, quoteId, fetchNovedades]);

  const handleCreate = async () => {
    if (!quoteId) return;
    const trimmed = texto.trim();
    if (!trimmed) {
      setError("Escribe el contenido de la novedad.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createNovedad(quoteId, trimmed);
    setSaving(false);
    if (!result.success || !result.data) {
      setError(result.errorMessage || "No se pudo guardar la novedad");
      return;
    }
    setItems((prev) => [result.data!, ...prev]);
    setTexto("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-red-500" />
            Novedades
            {quoteLabel ? (
              <span className="font-normal text-muted-foreground text-sm">
                — {quoteLabel}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="novedad-texto" className="text-xs">
            Nueva novedad
          </Label>
          <Textarea
            id="novedad-texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe una novedad o seguimiento..."
            className="min-h-[80px] text-sm resize-none"
            disabled={saving}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-1"
              onClick={handleCreate}
              disabled={saving || !texto.trim()}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Agregar
            </Button>
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex-1 min-h-0 overflow-y-auto border-t pt-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando...
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aún no hay novedades en esta cotización.
            </p>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/80 truncate">
                    {n.autorNombre || "Usuario"}
                  </span>
                  <span className="shrink-0">
                    {n.createdAt
                      ? new Date(n.createdAt).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.texto}</p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
