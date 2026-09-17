import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import {
  Building2,
  Pencil,
  Users,
  Building,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

const quickAccess = [
  {
    to: "/administration/users",
    title: "Usuarios",
    description: "Gestiona los usuarios de la compañía y sus accesos.",
    icon: Users,
  },
  {
    to: "/administration/areas",
    title: "Áreas",
    description: "Administra áreas organizacionales y su estructura.",
    icon: Building,
  },
  {
    to: "/administration/roles",
    title: "Roles",
    description: "Configura roles y permisos por módulo.",
    icon: ShieldCheck,
  },
];

function displayOrPlaceholder(value?: string | null) {
  const text = (value || "").trim();
  return text || "Sin asignar";
}

export default function Administration() {
  const { toast } = useToast();
  const { profile, loading, saving, fetchProfile, patchProfile } = useCompanyProfile();
  const [editOpen, setEditOpen] = useState(false);
  const [basicForm, setBasicForm] = useState({
    nombre: "",
    nit: "",
    correo_institucional: "",
    telefono: "",
  });

  useEffect(() => {
    if (!editOpen || !profile) return;
    setBasicForm({
      nombre: profile.nombre || "",
      nit: profile.nit || "",
      correo_institucional: profile.correo_institucional || "",
      telefono: profile.telefonos?.[0] || "",
    });
  }, [editOpen, profile]);

  const companyFields = useMemo(
    () => [
      { label: "COMPAÑÍA", value: displayOrPlaceholder(profile?.nombre) },
      { label: "NIT", value: displayOrPlaceholder(profile?.nit) },
      {
        label: "CORREO",
        value: displayOrPlaceholder(profile?.correo_institucional),
      },
      {
        label: "TELÉFONO",
        value: displayOrPlaceholder(profile?.telefonos?.[0]),
      },
    ],
    [profile]
  );

  const handleSaveBasic = async () => {
    const telefonos = [...(profile?.telefonos || [])];
    const phone = basicForm.telefono.trim();
    if (phone) {
      if (telefonos.length) telefonos[0] = phone;
      else telefonos.push(phone);
    } else if (telefonos.length) {
      telefonos.shift();
    }

    const result = await patchProfile({
      nombre: basicForm.nombre.trim(),
      nit: basicForm.nit.trim(),
      correo_institucional: basicForm.correo_institucional.trim(),
      telefonos,
    });

    if (result.errorMessage) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: result.errorMessage,
      });
      return;
    }

    toast({
      title: "Datos actualizados",
      description: "La información básica de la empresa se guardó correctamente.",
    });
    setEditOpen(false);
    await fetchProfile();
  };

  return (
    <AppLayout
      title="Administración"
      subtitle="Centraliza la configuración de tu compañía, usuarios, áreas y roles desde un solo lugar."
      eyebrow="Gerencia"
    >
      <div className="space-y-6">
        <Card className="animate-fade-in">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Inicio / Administración</p>
              <h2 className="text-2xl font-bold text-foreground mt-1">Administración</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Centraliza la configuración de tu compañía, usuarios, áreas y roles desde un solo
                lugar.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild className="gap-2">
                <Link to="/administration/company-profile">
                  <Building2 className="h-4 w-4" /> Perfil de empresa
                </Link>
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setEditOpen(true)}
                disabled={loading}
              >
                <Pencil className="h-4 w-4" /> Editar básico
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                Información de la compañía
              </h3>
              {loading ? (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Cargando…
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {companyFields.map((f) => (
                <div key={f.label} className="border border-border rounded-lg p-4">
                  <p className="text-[10px] font-semibold text-muted-foreground tracking-widest">
                    {f.label}
                  </p>
                  <p className="text-sm font-medium text-foreground mt-1 break-words">
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Accesos rápidos</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickAccess.map((q) => (
                <Link
                  key={q.to}
                  to={q.to}
                  className="text-left border border-border rounded-lg p-5 hover:shadow-md hover:border-primary/40 transition-all"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <q.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">{q.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{q.description}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Editar información básica</DialogTitle>
            <DialogDescription>
              Actualiza los datos principales de la empresa. Para el perfil completo usa «Perfil
              de empresa».
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="company-nombre">Compañía</Label>
              <Input
                id="company-nombre"
                value={basicForm.nombre}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, nombre: e.target.value }))
                }
                placeholder="Nombre de la empresa"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-nit">NIT</Label>
              <Input
                id="company-nit"
                value={basicForm.nit}
                onChange={(e) => setBasicForm((prev) => ({ ...prev, nit: e.target.value }))}
                placeholder="NIT"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-email">Correo</Label>
              <Input
                id="company-email"
                type="email"
                value={basicForm.correo_institucional}
                onChange={(e) =>
                  setBasicForm((prev) => ({
                    ...prev,
                    correo_institucional: e.target.value,
                  }))
                }
                placeholder="empresa@correo.com"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-phone">Teléfono</Label>
              <Input
                id="company-phone"
                value={basicForm.telefono}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, telefono: e.target.value }))
                }
                placeholder="+57 300 000 0000"
                disabled={saving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBasic} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
