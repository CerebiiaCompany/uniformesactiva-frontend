import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  UserCheck,
  Briefcase,
  Plus,
  ChevronRight,
  Trash2,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  EMPTY_COMPANY_PROFILE,
  useCompanyProfile,
  type CompanyProfileInput,
} from "@/hooks/useCompanyProfile";

interface SectionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  onSave?: () => void;
  saving?: boolean;
  disabled?: boolean;
}

function Section({
  icon: Icon,
  title,
  description,
  children,
  onSave,
  saving,
  disabled,
}: SectionProps) {
  return (
    <Card className="animate-fade-in">
      <CardContent className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className="space-y-4">{children}</div>
        <div className="flex justify-end mt-6">
          <Button onClick={onSave} disabled={disabled || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CompanyProfile() {
  const { toast } = useToast();
  const { profile, loading, saving, fetchProfile, saveProfile } = useCompanyProfile();
  const [form, setForm] = useState<CompanyProfileInput>(EMPTY_COMPANY_PROFILE);

  useEffect(() => {
    if (!profile) return;
    setForm({
      nombre: profile.nombre,
      nit: profile.nit,
      direccion: profile.direccion,
      ciudad: profile.ciudad,
      departamento: profile.departamento,
      correo_institucional: profile.correo_institucional,
      sitio_web: profile.sitio_web,
      telefonos: profile.telefonos.length ? [...profile.telefonos] : [],
      representante_nombre: profile.representante_nombre,
      representante_cargo: profile.representante_cargo,
      representante_documento: profile.representante_documento,
      representante_correo: profile.representante_correo,
      actividad_economica: profile.actividad_economica,
    });
  }, [profile]);

  const setField = <K extends keyof CompanyProfileInput>(
    key: K,
    value: CompanyProfileInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const result = await saveProfile(form);
    if (result.errorMessage) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: result.errorMessage,
      });
      return;
    }
    toast({
      title: "Perfil actualizado",
      description: "Los datos de la empresa se guardaron correctamente.",
    });
    await fetchProfile();
  };

  return (
    <AppLayout
      title="Perfil de empresa"
      subtitle="Configuración y datos legales de la compañía"
      eyebrow="Gerencia"
    >
      <div className="space-y-6 max-w-6xl">
        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">
                Inicio
              </Link>
              <ChevronRight className="h-3 w-3" />
              <Link to="/administration" className="hover:text-foreground">
                Administración
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">Perfil de empresa</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mt-2">Perfil de empresa</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Completa y mantén actualizada la información de tu empresa para el cumplimiento
              de la Ley 1581 de Protección de Datos.
            </p>
            {loading ? (
              <p className="text-xs text-muted-foreground mt-3 inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cargando datos…
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Section
          icon={Building2}
          title="Identificación de la empresa"
          description="Nombre, NIT, dirección, ciudad, departamento, teléfonos, sitio web y correo institucional."
          onSave={handleSave}
          saving={saving}
          disabled={loading}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre de la empresa</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setField("nombre", e.target.value)}
                placeholder="Ej. Mi Empresa S.A.S"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label>NIT</Label>
              <Input
                value={form.nit}
                onChange={(e) => setField("nit", e.target.value)}
                placeholder="Ej. 9001234567"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección principal</Label>
              <Input
                value={form.direccion}
                onChange={(e) => setField("direccion", e.target.value)}
                placeholder="Ej. Cra 7 #12-34"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input
                value={form.ciudad}
                onChange={(e) => setField("ciudad", e.target.value)}
                placeholder="Ej. Bogotá"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Input
                value={form.departamento}
                onChange={(e) => setField("departamento", e.target.value)}
                placeholder="Ej. Cundinamarca"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Correo institucional</Label>
              <Input
                type="email"
                value={form.correo_institucional}
                onChange={(e) => setField("correo_institucional", e.target.value)}
                placeholder="empresa@correo.com"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Sitio web</Label>
              <Input
                value={form.sitio_web}
                onChange={(e) => setField("sitio_web", e.target.value)}
                placeholder="Ej. https://empresa.com"
                disabled={loading || saving}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Teléfonos</Label>
            <div className="space-y-2 mt-2">
              {form.telefonos.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={p}
                    onChange={(e) => {
                      const next = [...form.telefonos];
                      next[i] = e.target.value;
                      setField("telefonos", next);
                    }}
                    placeholder="Ej. +57 300 000 0000"
                    disabled={loading || saving}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={loading || saving}
                    onClick={() =>
                      setField(
                        "telefonos",
                        form.telefonos.filter((_, idx) => idx !== i)
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="text-primary gap-1"
                disabled={loading || saving}
                onClick={() => setField("telefonos", [...form.telefonos, ""])}
              >
                <Plus className="h-4 w-4" /> Agregar teléfono
              </Button>
            </div>
          </div>
        </Section>

        <Section
          icon={UserCheck}
          title="Representante legal"
          description="Datos del representante legal o persona autorizada para la toma de decisiones."
          onSave={handleSave}
          saving={saving}
          disabled={loading}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input
                value={form.representante_nombre}
                onChange={(e) => setField("representante_nombre", e.target.value)}
                placeholder="Ej. Juan Pérez"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input
                value={form.representante_cargo}
                onChange={(e) => setField("representante_cargo", e.target.value)}
                placeholder="Ej. Gerente General"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Número de documento</Label>
              <Input
                value={form.representante_documento}
                onChange={(e) => setField("representante_documento", e.target.value)}
                placeholder="Ej. 1012345678"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Correo de contacto</Label>
              <Input
                type="email"
                value={form.representante_correo}
                onChange={(e) => setField("representante_correo", e.target.value)}
                placeholder="Ej. representante@empresa.com"
                disabled={loading || saving}
              />
            </div>
          </div>
        </Section>

        <Section
          icon={Briefcase}
          title="Actividad económica"
          description="Descripción de la actividad económica principal de la empresa."
          onSave={handleSave}
          saving={saving}
          disabled={loading}
        >
          <div className="space-y-2">
            <Label>Descripción de la actividad económica</Label>
            <Textarea
              value={form.actividad_economica}
              onChange={(e) => setField("actividad_economica", e.target.value)}
              placeholder="Ej. Empresa dedicada a la fabricación y comercialización de uniformes..."
              rows={4}
              disabled={loading || saving}
            />
          </div>
        </Section>
      </div>
    </AppLayout>
  );
}
