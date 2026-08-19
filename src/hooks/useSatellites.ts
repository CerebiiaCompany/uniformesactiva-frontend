import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export type SatelliteStatus = "active" | "inactive";
export type SatellitePaymentStatus = "al_dia" | "pendiente" | "no_aplica";

export type SatelliteWorkStatus =
    | "enviado"
    | "recibido_completo"
    | "recibido_faltantes";

export type SatelliteSettlement = {
    status: "pending" | "paid";
    amount?: number;
    paid_at?: string | null;
    /** Confirmación de recepción del trabajo por la empresa */
    work_status?: SatelliteWorkStatus;
    observations?: string;
    agreed_cost?: number | null;
    confirmed_at?: string | null;
};

export interface Satellite {
    id: string;
    name: string;
    nit?: string;
    nit_tercero?: string;
    cod_tercero?: string;
    contact_name: string;
    phone: string;
    address: string;
    specialties: string[];
    notes: string;
    status: SatelliteStatus;
    payment_status: SatellitePaymentStatus;
    /** Liquidaciones por orden: { [orderId]: { status, amount, paid_at } } */
    settlements?: Record<string, SatelliteSettlement>;
    created_at: string;
    updated_at: string;
}

export interface SatelliteFilters {
    search?: string;
    desde?: string;
    hasta?: string;
    estado?: string;
    pago?: string;
    especialidad?: string;
}

export interface CreateSatellitePayload {
    name: string;
    nit?: string;
    nit_tercero?: string;
    cod_tercero?: string;
    contact_name?: string;
    phone?: string;
    address?: string;
    specialties?: string[];
    notes?: string;
    status?: SatelliteStatus;
    payment_status?: SatellitePaymentStatus;
}

export type UpdateSatellitePayload = Partial<CreateSatellitePayload> & {
    settlements?: Record<string, SatelliteSettlement>;
};

function buildParams(filters: SatelliteFilters = {}) {
    const params = new URLSearchParams();
    if (filters.search?.trim()) params.set("search", filters.search.trim());
    if (filters.desde) params.set("desde", filters.desde);
    if (filters.hasta) params.set("hasta", filters.hasta);
    if (filters.estado && filters.estado !== "todos") params.set("estado", filters.estado);
    if (filters.pago && filters.pago !== "todos") params.set("pago", filters.pago);
    if (filters.especialidad && filters.especialidad !== "todos") {
        params.set("especialidad", filters.especialidad);
    }
    return params.toString();
}

export function useGetSatellites(filters: SatelliteFilters = {}) {
    const qs = buildParams(filters);
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["satellites", filters],
        queryFn: () => http<Satellite[]>(endpoints.satellites.list(qs)),
    });

    return {
        satellites: data || [],
        isLoading,
        error,
        refetch,
    };
}

export function useCreateSatellite() {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: (payload: CreateSatellitePayload) =>
            http<Satellite>(endpoints.satellites.create(), {
                method: "POST",
                body: JSON.stringify(payload),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["satellites"] });
        },
    });

    return {
        createSatellite: mutation.mutateAsync,
        isPending: mutation.isPending,
        error: mutation.error,
    };
}

export function useUpdateSatellite() {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateSatellitePayload }) =>
            http<Satellite>(endpoints.satellites.detail(id), {
                method: "PATCH",
                body: JSON.stringify(payload),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["satellites"] });
        },
    });

    return {
        updateSatellite: mutation.mutateAsync,
        isPending: mutation.isPending,
    };
}

export function useDeleteSatellite() {
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: (id: string) =>
            http(endpoints.satellites.detail(id), { method: "DELETE" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["satellites"] });
        },
    });

    return {
        deleteSatellite: mutation.mutateAsync,
        isPending: mutation.isPending,
    };
}
