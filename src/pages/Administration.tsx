import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Building2, Pencil, Users, Building, ShieldCheck } from "lucide-react";

const companyFields = [
  { label: "COMPAÑÍA", value: "Sin asignar" },
  { label: "NIT", value: "Sin asignar" },
  { label: "CORREO", value: "Sin asignar" },
  { label: "TELÉFONO", value: "Sin asignar" },
];

const quickAccess = [
  { title: "Usuarios", description: "Gestiona los usuarios de la compañía y sus accesos.", icon: Users },
  { title: "Áreas", description: "Administra áreas organizacionales y su estructura.", icon: Building },
  { title: "Roles", description: "Configura roles y permisos por módulo.", icon: ShieldCheck },
];

export default function Administration() {
  return (
    <AppLayout title="Administración" subtitle="Centraliza la configuración de tu compañía, usuarios, áreas y roles desde un solo lugar.">
      <div className="space-y-6">
        <Card className="animate-fade-in">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Inicio / Administración</p>
              <h2 className="text-2xl font-bold text-foreground mt-1">Administración</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Centraliza la configuración de tu compañía, usuarios, áreas y roles desde un solo lugar.
              </p>
            </div>
            <div className="flex gap-2">
              <Button className="gap-2">
                <Building2 className="h-4 w-4" /> Perfil de empresa
              </Button>
              <Button variant="outline" className="gap-2">
                <Pencil className="h-4 w-4" /> Editar básico
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Información de la compañía</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {companyFields.map((f) => (
                <div key={f.label} className="border border-border rounded-lg p-4">
                  <p className="text-[10px] font-semibold text-muted-foreground tracking-widest">{f.label}</p>
                  <p className="text-sm font-medium text-foreground mt-1">{f.value}</p>
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
                <div key={q.title} className="border border-border rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <q.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">{q.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{q.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
