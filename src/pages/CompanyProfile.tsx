import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  UserCheck,
  Users,
  Briefcase,
  Database,
  ListChecks,
  Globe,
  HelpCircle,
  FileText,
  Eye,
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

const titulares = [
  "Datos de empleados",
  "Datos de proveedores",
  "Datos de clientes",
  "Usuarios web",
  "Prospectos comerciales",
  "Datos financieros",
];

const observaciones = [
  "Tratamiento de datos de menores de edad",
  "Uso de datos biométricos",
  "Videovigilancia",
  "Integraciones con plataformas de terceros",
];

export default function CompanyProfile() {
  const [phones, setPhones] = useState<string[]>([]);
  const [sensibles, setSensibles] = useState<string[]>([]);
  const [finalidades, setFinalidades] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);

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

        {/* Personal autorizado */}
        <Section
          icon={Users}
          title="Personal autorizado"
          description="Usuarios de la organización autorizados para tratar datos personales."
        >
          <Input placeholder="Buscar por nombre o usuario..." />
          <p className="text-xs text-muted-foreground">Sin usuarios disponibles. Crea usuarios en la sección de Administración.</p>
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

        {/* Datos personales recolectados */}
        <Section
          icon={Database}
          title="Datos personales recolectados"
          description="Categorías de titulares y tipos de datos personales que la empresa recolecta y trata."
        >
          <div>
            <Label className="text-sm">Categorías de titulares</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {titulares.map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <Checkbox id={t} />
                  <label htmlFor={t} className="text-sm text-foreground cursor-pointer">{t}</label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-sm">Datos sensibles tratados</Label>
            <div className="space-y-2 mt-2">
              {sensibles.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={s}
                    onChange={(e) => {
                      const n = [...sensibles];
                      n[i] = e.target.value;
                      setSensibles(n);
                    }}
                    placeholder="Ej. Datos de salud"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setSensibles(sensibles.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-primary gap-1" onClick={() => setSensibles([...sensibles, ""])}>
                <Plus className="h-4 w-4" /> Agregar dato sensible
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Otros datos sensibles</Label>
            <Textarea placeholder="Describa otros datos sensibles que no estén listados arriba..." rows={3} />
          </div>
        </Section>

        {/* Finalidades */}
        <Section
          icon={ListChecks}
          title="Finalidades del tratamiento"
          description="Propósitos por los cuales la empresa recolecta y trata cada tipo de dato personal."
        >
          <div className="space-y-2">
            {finalidades.map((f, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={f}
                  onChange={(e) => {
                    const n = [...finalidades];
                    n[i] = e.target.value;
                    setFinalidades(n);
                  }}
                  placeholder="Ej. Envío de facturación electrónica"
                />
                <Button variant="ghost" size="icon" onClick={() => setFinalidades(finalidades.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="text-primary gap-1" onClick={() => setFinalidades([...finalidades, ""])}>
              <Plus className="h-4 w-4" /> Agregar finalidad
            </Button>
          </div>
        </Section>

        {/* Transferencias internacionales */}
        <Section
          icon={Globe}
          title="Transferencias internacionales"
          description="Indica si la empresa almacena datos en servidores fuera del país o los transfiere a terceros."
        >
          <div className="flex flex-wrap gap-8">
            <div className="flex flex-col gap-2">
              <Switch />
              <Label className="text-sm">Servidores fuera del país</Label>
            </div>
            <div className="flex flex-col gap-2">
              <Switch />
              <Label className="text-sm">Transferencias a terceros</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Detalles de las transferencias</Label>
            <Textarea placeholder="Describa a qué países, con qué finalidad y bajo qué garantías se realizan las transferencias..." rows={3} />
          </div>
        </Section>

        {/* ARCO */}
        <Section
          icon={HelpCircle}
          title="Atención de derechos ARCO"
          description="Usuarios designados como encargados ARCO. Deben tener el permiso «Solicitudes ARCO» en su rol y figurar aquí."
        >
          <div className="space-y-2">
            <Label>Responsables (usuarios de la organización)</Label>
            <Input placeholder="Buscar por nombre o usuario..." />
          </div>
          <div className="space-y-2">
            <Label>Línea telefónica ARCO</Label>
            <Input placeholder="Ej. 018000123456" />
          </div>
        </Section>

        {/* Reglamento interno */}
        <Section
          icon={FileText}
          title="Reglamento interno"
          description="Políticas internas y documentos relacionados con la protección de datos personales."
        >
          <div className="flex flex-col gap-2">
            <Switch />
            <Label className="text-sm">¿Tiene políticas internas de protección de datos?</Label>
          </div>
          <div className="space-y-2">
            <Label>Descripción de los documentos</Label>
            <Textarea placeholder="Describa las políticas y documentos internos existentes..." rows={3} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Archivos adjuntos (URLs)</Label>
            <div className="space-y-2 mt-2">
              {docs.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={d}
                    onChange={(e) => {
                      const n = [...docs];
                      n[i] = e.target.value;
                      setDocs(n);
                    }}
                    placeholder="https://..."
                  />
                  <Button variant="ghost" size="icon" onClick={() => setDocs(docs.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-primary gap-1" onClick={() => setDocs([...docs, ""])}>
                <Plus className="h-4 w-4" /> Agregar documento
              </Button>
            </div>
          </div>
        </Section>

        {/* Observaciones especiales */}
        <Section
          icon={Eye}
          title="Observaciones especiales"
          description="Situaciones particulares relacionadas con el tratamiento de datos que requieren atención especial."
        >
          <div className="space-y-3">
            {observaciones.map((o) => (
              <div key={o} className="flex flex-col gap-2">
                <Switch />
                <Label className="text-sm">{o}</Label>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Observaciones adicionales</Label>
            <Textarea placeholder="Cualquier otra observación relevante sobre el tratamiento de datos..." rows={3} />
          </div>
        </Section>
      </div>
    </AppLayout>
  );
}
