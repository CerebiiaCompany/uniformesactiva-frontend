import { useState } from "react";
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
} from "lucide-react";

interface SectionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  onSave?: () => void;
}

function Section({ icon: Icon, title, description, children, onSave }: SectionProps) {
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
          <Button onClick={onSave}>Guardar cambios</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CompanyProfile() {
  const [phones, setPhones] = useState<string[]>([]);

  return (
    <AppLayout title="Perfil de empresa" subtitle="Configuración y datos legales de la compañía">
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">Inicio</Link>
              <ChevronRight className="h-3 w-3" />
              <Link to="/administration" className="hover:text-foreground">Administración</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">Perfil de empresa</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mt-2">Perfil de empresa</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Completa y mantén actualizada la información de tu empresa para el cumplimiento de la Ley 1581 de Protección de Datos.
            </p>
          </CardContent>
        </Card>

        {/* Identificación */}
        <Section
          icon={Building2}
          title="Identificación de la empresa"
          description="Nombre, NIT, dirección, ciudad, departamento, teléfonos, sitio web y correo institucional."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre de la empresa</Label>
              <Input placeholder="Ej. Mi Empresa S.A.S" />
            </div>
            <div className="space-y-2">
              <Label>NIT</Label>
              <Input placeholder="Ej. 9001234567" />
            </div>
            <div className="space-y-2">
              <Label>Dirección principal</Label>
              <Input placeholder="Ej. Cra 7 #12-34" />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input placeholder="Ej. Bogotá" />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Input placeholder="Ej. Cundinamarca" />
            </div>
            <div className="space-y-2">
              <Label>Correo institucional</Label>
              <Input type="email" placeholder="empresa@correo.com" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Sitio web</Label>
              <Input placeholder="Ej. https://empresa.com" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Teléfonos adicionales</Label>
            <div className="space-y-2 mt-2">
              {phones.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={p}
                    onChange={(e) => {
                      const n = [...phones];
                      n[i] = e.target.value;
                      setPhones(n);
                    }}
                    placeholder="Ej. +57 300 000 0000"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setPhones(phones.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-primary gap-1" onClick={() => setPhones([...phones, ""])}>
                <Plus className="h-4 w-4" /> Agregar teléfono
              </Button>
            </div>
          </div>
        </Section>

        {/* Representante legal */}
        <Section
          icon={UserCheck}
          title="Representante legal"
          description="Datos del representante legal o persona autorizada para la toma de decisiones."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input placeholder="Ej. Juan Pérez" />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input placeholder="Ej. Gerente General" />
            </div>
            <div className="space-y-2">
              <Label>Número de documento</Label>
              <Input placeholder="Ej. 1012345678" />
            </div>
            <div className="space-y-2">
              <Label>Correo de contacto</Label>
              <Input type="email" placeholder="Ej. representante@empresa.com" />
            </div>
          </div>
        </Section>

        {/* Actividad económica */}
        <Section
          icon={Briefcase}
          title="Actividad económica"
          description="Descripción de la actividad económica principal de la empresa."
        >
          <div className="space-y-2">
            <Label>Descripción de la actividad económica</Label>
            <Textarea placeholder="Ej. Empresa dedicada a la comercialización de dispositivos móviles y accesorios..." rows={4} />
          </div>
        </Section>
      </div>
    </AppLayout>
  );
}
