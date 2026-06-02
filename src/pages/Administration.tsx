import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import {
  Building2,
  Pencil,
  Users,
  Building,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const companyFields = [
  { label: "COMPAÑÍA", value: "Sin asignar" },
  { label: "NIT", value: "Sin asignar" },
  { label: "CORREO", value: "Sin asignar" },
  { label: "TELÉFONO", value: "Sin asignar" },
];

const mockUsers = [
  { id: "1", nombre: "Carlos Ramírez", cargo: "Gerente General" },
  { id: "2", nombre: "María Gómez", cargo: "Ejecutiva de Ventas" },
  { id: "3", nombre: "Andrés Torres", cargo: "Jefe de Planta" },
  { id: "4", nombre: "Laura Pérez", cargo: "Contadora" },
];

const quickAccess = [
  { to: "/administration/users", title: "Usuarios", description: "Gestiona los usuarios de la compañía y sus accesos.", icon: Users },
  { to: "/administration/areas", title: "Áreas", description: "Administra áreas organizacionales y su estructura.", icon: Building },
  { to: "/administration/roles", title: "Roles", description: "Configura roles y permisos por módulo.", icon: ShieldCheck },
];

export default function Administration() {
  const [selectedOfficial, setSelectedOfficial] = useState<string>("");

  const handleAssignOfficial = () => {
    if (!selectedOfficial) {
      toast({ title: "Selecciona un usuario", variant: "destructive" });
      return;
    }
    toast({ title: "Oficial asignado", description: "Se asignó como oficial de datos." });
  };

  return (
    <AppLayout
      title="Administración"
      subtitle="Centraliza la configuración de tu compañía, usuarios, áreas y roles desde un solo lugar."
    >
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
              <Button asChild className="gap-2">
                <Link to="/administration/company-profile">
                  <Building2 className="h-4 w-4" /> Perfil de empresa
                </Link>
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
          <CardContent className="p-6 space-y-4">
            <div>
              <Badge variant="secondary" className="rounded-full">Oficial de datos</Badge>
              <h3 className="text-base font-semibold text-foreground mt-3">
                No hay oficial de datos asignado
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Designa a un usuario de la compañía como oficial responsable del tratamiento de datos personales.
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-2">
                USUARIO DE LA EMPRESA
              </p>
              <div className="flex flex-col md:flex-row gap-2">
                <Select value={selectedOfficial} onValueChange={setSelectedOfficial}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecciona un usuario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mockUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nombre} — {u.cargo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAssignOfficial} className="gap-2">
                  <UserCheck className="h-4 w-4" /> Asignar oficial
                </Button>
              </div>
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
    </AppLayout>
  );
}
