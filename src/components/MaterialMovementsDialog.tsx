import { ArrowDown, ArrowUp, History, Loader2, X } from "lucide-react";
import { useMaterialMovements, type StockMovement } from "@/hooks/useMaterialMovements";
import { cn } from "@/lib/utils";
import { formatDecimal } from "@/lib/format-number";

interface MaterialLike {
    id: string;
    name: string;
    unit: string;
    stock: number | string;
}

interface MaterialMovementsDialogProps {
    open: boolean;
    material: MaterialLike | null;
    onClose: () => void;
}

function shortMaterialCode(id: string) {
    return `M-${id.replace(/-/g, "").slice(0, 3).toUpperCase()}`;
}

function formatMovementDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const date = d.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    const time = d.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
    return `${date} · ${time}`;
}

function TipoBadge({ tipo }: { tipo: StockMovement["tipo"] }) {
    if (tipo === "salida") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                <ArrowDown className="h-3 w-3" />
                Salida
            </span>
        );
    }
    if (tipo === "inicial") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <ArrowUp className="h-3 w-3" />
                Inicial
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <ArrowUp className="h-3 w-3" />
            Entrada
        </span>
    );
}

function quantityLabel(quantity: number | string, tipo: StockMovement["tipo"]) {
    const n = typeof quantity === "string" ? parseFloat(quantity) : Number(quantity);
    const abs = Math.abs(Number.isFinite(n) ? n : 0);
    const formatted = formatDecimal(abs);
    if (tipo === "salida" || n < 0) return `-${formatted}`;
    return `+${formatted}`;
}

export function MaterialMovementsDialog({
    open,
    material,
    onClose,
}: MaterialMovementsDialogProps) {
    const { movements, isLoading } = useMaterialMovements(material?.id ?? null, open);

    if (!open || !material) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-card text-card-foreground border rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col relative">
                <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <History className="h-5 w-5 text-muted-foreground shrink-0" />
                            <span className="truncate">
                                Historial de movimientos · {shortMaterialCode(material.id)}
                            </span>
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                            {material.name} · Stock actual: {formatDecimal(material.stock)}{" "}
                            {material.unit}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-muted rounded-md transition-colors shrink-0"
                        aria-label="Cerrar"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-6 py-4 overflow-auto flex-1">
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Cargando movimientos...
                        </div>
                    ) : movements.length === 0 ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                            Aún no hay movimientos registrados para este material.
                        </div>
                    ) : (
                        <div className="rounded-lg border overflow-x-auto">
                            <table className="w-full text-sm min-w-[720px]">
                                <thead>
                                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                                        <th className="px-3 py-2.5 font-medium">Fecha</th>
                                        <th className="px-3 py-2.5 font-medium">Tipo</th>
                                        <th className="px-3 py-2.5 font-medium text-right">Cantidad</th>
                                        <th className="px-3 py-2.5 font-medium">Referencia</th>
                                        <th className="px-3 py-2.5 font-medium">Proveedor</th>
                                        <th className="px-3 py-2.5 font-medium text-right">Costo total</th>
                                        <th className="px-3 py-2.5 font-medium">Nota</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map((m) => {
                                        const isOut = m.tipo === "salida";
                                        return (
                                            <tr key={m.id} className="border-b last:border-0">
                                                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                                                    {formatMovementDate(m.created_at)}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <TipoBadge tipo={m.tipo} />
                                                </td>
                                                <td
                                                    className={cn(
                                                        "px-3 py-2.5 text-right font-semibold tabular-nums",
                                                        isOut ? "text-red-600" : "text-foreground"
                                                    )}
                                                >
                                                    {quantityLabel(m.quantity, m.tipo)}
                                                </td>
                                                <td className="px-3 py-2.5 max-w-[220px]">
                                                    <span className="line-clamp-2">{m.reference || "—"}</span>
                                                </td>
                                                <td className="px-3 py-2.5 text-muted-foreground">
                                                    {m.proveedor?.trim() ? m.proveedor : "—"}
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                                                    {m.costo_total != null && m.costo_total !== ""
                                                        ? `$${Number(m.costo_total).toLocaleString("es-CO")}`
                                                        : "—"}
                                                </td>
                                                <td className="px-3 py-2.5 text-muted-foreground">
                                                    {m.nota?.trim() ? m.nota : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                        Las salidas se registran al pasar una orden a producción (según costeo de
                        variante) y también al solicitar materiales adicionales desde una tarjeta
                        Kanban.
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border rounded-md text-sm hover:bg-muted transition-colors shrink-0 self-end sm:self-auto"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
