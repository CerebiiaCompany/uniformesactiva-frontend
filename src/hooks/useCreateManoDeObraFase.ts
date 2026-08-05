import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export interface CreateManoDeObraFasePayload {
    name: string;
    orden?: number;
}

export interface ManoDeObraFaseResponse {
    id: string;
    name: string;
    orden?: number;
}

export function useCreateManoDeObraFase() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const createManoDeObraFase = async (payload: CreateManoDeObraFasePayload) => {
        setIsLoading(true);
        setError(null);

        try {
            const name = payload.name.trim();
            if (!name) {
                const message = "El nombre de la fase es obligatorio.";
                setError(message);
                return { success: false as const, error: message };
            }

            const data = await http<ManoDeObraFaseResponse>(endpoints.costos.fasesManoDeObra(), {
                method: "POST",
                body: JSON.stringify({
                    name,
                    orden: payload.orden ?? 0,
                }),
            });

            await queryClient.invalidateQueries({ queryKey: ["cost-catalog", "fases-mano-de-obra"] });
            return { success: true as const, data };
        } catch (err: any) {
            const message = err.message || "Error al crear la fase de mano de obra.";
            setError(message);
            return { success: false as const, error: message };
        } finally {
            setIsLoading(false);
        }
    };

    return { createManoDeObraFase, isLoading, error };
}
