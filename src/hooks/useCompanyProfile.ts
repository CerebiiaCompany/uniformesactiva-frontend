import { useCallback, useEffect, useState } from "react";
import { http, HttpError } from "@/lib/http";
import { endpoints } from "@/lib/api-endpoints";

export type CompanyProfile = {
  id: string;
  nombre: string;
  nit: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  correo_institucional: string;
  sitio_web: string;
  telefonos: string[];
  representante_nombre: string;
  representante_cargo: string;
  representante_documento: string;
  representante_correo: string;
  actividad_economica: string;
  created_at?: string;
  updated_at?: string;
};

export type CompanyProfileInput = Omit<
  CompanyProfile,
  "id" | "created_at" | "updated_at"
>;

export const EMPTY_COMPANY_PROFILE: CompanyProfileInput = {
  nombre: "",
  nit: "",
  direccion: "",
  ciudad: "",
  departamento: "",
  correo_institucional: "",
  sitio_web: "",
  telefonos: [],
  representante_nombre: "",
  representante_cargo: "",
  representante_documento: "",
  representante_correo: "",
  actividad_economica: "",
};

function resolveError(err: unknown, fallback: string): string {
  if (err instanceof HttpError && err.message?.trim()) return err.message;
  if (err instanceof Error && err.message?.trim()) return err.message;
  return fallback;
}

function normalizeProfile(raw: Partial<CompanyProfile> | null | undefined): CompanyProfile {
  return {
    id: String(raw?.id || ""),
    nombre: String(raw?.nombre || ""),
    nit: String(raw?.nit || ""),
    direccion: String(raw?.direccion || ""),
    ciudad: String(raw?.ciudad || ""),
    departamento: String(raw?.departamento || ""),
    correo_institucional: String(raw?.correo_institucional || ""),
    sitio_web: String(raw?.sitio_web || ""),
    telefonos: Array.isArray(raw?.telefonos)
      ? raw!.telefonos.map((t) => String(t || "").trim()).filter(Boolean)
      : [],
    representante_nombre: String(raw?.representante_nombre || ""),
    representante_cargo: String(raw?.representante_cargo || ""),
    representante_documento: String(raw?.representante_documento || ""),
    representante_correo: String(raw?.representante_correo || ""),
    actividad_economica: String(raw?.actividad_economica || ""),
    created_at: raw?.created_at,
    updated_at: raw?.updated_at,
  };
}

export function useCompanyProfile(opts?: { autoLoad?: boolean }) {
  const autoLoad = opts?.autoLoad !== false;
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await http<CompanyProfile>(endpoints.company.profile());
      const normalized = normalizeProfile(data);
      setProfile(normalized);
      return { profile: normalized, errorMessage: null as string | null };
    } catch (err) {
      const message = resolveError(err, "No se pudo cargar el perfil de empresa");
      setError(message);
      return { profile: null, errorMessage: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProfile = useCallback(async (payload: CompanyProfileInput) => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...payload,
        telefonos: (payload.telefonos || [])
          .map((t) => String(t || "").trim())
          .filter(Boolean),
      };
      const data = await http<CompanyProfile>(endpoints.company.profile(), {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const normalized = normalizeProfile(data);
      setProfile(normalized);
      return { profile: normalized, errorMessage: null as string | null };
    } catch (err) {
      const message = resolveError(err, "No se pudo guardar el perfil de empresa");
      setError(message);
      return { profile: null, errorMessage: message };
    } finally {
      setSaving(false);
    }
  }, []);

  const patchProfile = useCallback(async (partial: Partial<CompanyProfileInput>) => {
    setSaving(true);
    setError(null);
    try {
      const body = { ...partial };
      if (Array.isArray(partial.telefonos)) {
        body.telefonos = partial.telefonos
          .map((t) => String(t || "").trim())
          .filter(Boolean);
      }
      const data = await http<CompanyProfile>(endpoints.company.profile(), {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const normalized = normalizeProfile(data);
      setProfile(normalized);
      return { profile: normalized, errorMessage: null as string | null };
    } catch (err) {
      const message = resolveError(err, "No se pudo actualizar el perfil de empresa");
      setError(message);
      return { profile: null, errorMessage: message };
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) void fetchProfile();
  }, [autoLoad, fetchProfile]);

  return {
    profile,
    loading,
    saving,
    error,
    fetchProfile,
    saveProfile,
    patchProfile,
  };
}
