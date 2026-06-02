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

interface MockUser {
  id: string;
  nombre: string;
  area: string;
  cargo: string;
  correo: string;
  telefono: string;
  isMe?: boolean;
}

const mockUsers: MockUser[] = [
  { id: "1", nombre: "Carlos Ramírez", area: "Administración", cargo: "Gerente General", correo: "carlos@flowtextil.com", telefono: "+57 300 123 4567", isMe: true },
  { id: "2", nombre: "María Gómez", area: "Comercial", cargo: "Ejecutiva de Ventas", correo: "maria@flowtextil.com", telefono: "+57 301 234 5678" },
  { id: "3", nombre: "Andrés Torres", area: "Producción", cargo: "Jefe de Planta", correo: "andres@flowtextil.com", telefono: "+57 302 345 6789" },
  { id: "4", nombre: "Laura Pérez", area: "Contabilidad", cargo: "Contadora", correo: "laura@flowtextil.com", telefono: "+57 303 456 7890" },
];

const mockAreas = [
  { id: "1", nombre: "Administración", responsable: "Carlos Ramírez", miembros: 3 },
  { id: "2", nombre: "Comercial", responsable: "María Gómez", miembros: 5 },
  { id: "3", nombre: "Producción", responsable: "Andrés Torres", miembros: 12 },
  { id: "4", nombre: "Contabilidad", responsable: "Laura Pérez", miembros: 2 },
];

const ROLES = ["Administrador", "Operador", "Auditor"] as const;
const MODULES = ["Usuarios", "Áreas", "Plantillas", "Clasificación", "Campañas", "IA", "Auditoría", "Reportes"];
const PERMS = ["ver", "crear", "editar", "eliminar"] as const;
type Perm = (typeof PERMS)[number];
type PermissionMatrix = Record<string, Record<Perm, boolean>>;

const buildDefaultMatrix = (role: string): PermissionMatrix => {
  const m: PermissionMatrix = {};
  MODULES.forEach((mod) => {
    m[mod] = {
      ver: true,
      crear: role === "Administrador",
      editar: role === "Administrador",
      eliminar: role === "Administrador",
    };
  });
  return m;
};

export default function Administration() {
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedOfficial, setSelectedOfficial] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>(ROLES[0]);
  const [matrix, setMatrix] = useState<PermissionMatrix>(buildDefaultMatrix(ROLES[0]));

  const handleSelectRole = (role: string) => {
    setSelectedRole(role);
    setMatrix(buildDefaultMatrix(role));
  };

  const togglePerm = (mod: string, perm: Perm) => {
    setMatrix((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], [perm]: !prev[mod][perm] },
    }));
  };

  const handleSave = () => {
    // Estructura lista para conectar con API Django
    const payload = { role: selectedRole, permissions: matrix };
    console.log("Saving permissions payload:", payload);
    toast({ title: "Cambios guardados", description: `Permisos actualizados para ${selectedRole}.` });
  };

  const handleAssignOfficial = () => {
    if (!selectedOfficial) {
      toast({ title: "Selecciona un usuario", variant: "destructive" });
      return;
    }
    toast({ title: "Oficial asignado", description: `Se asignó como oficial de datos.` });
  };

  const filteredUsers = mockUsers.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.nombre.toLowerCase().includes(q) ||
      u.correo.toLowerCase().includes(q) ||
      u.cargo.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout
      title="Administración"
      subtitle="Centraliza la configuración de tu compañía, usuarios, áreas y roles desde un solo lugar."
    >
      <div className="space-y-6">
        {/* Header card */}
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

        {/* Info compañía */}
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

        {/* Oficial de datos */}
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

        {/* Accesos rápidos */}
        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Accesos rápidos</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: "usuarios", title: "Usuarios", description: "Gestiona los usuarios de la compañía y sus accesos.", icon: Users },
                { key: "areas", title: "Áreas", description: "Administra áreas organizacionales y su estructura.", icon: Building },
                { key: "roles", title: "Roles", description: "Configura roles y permisos por módulo.", icon: ShieldCheck },
              ].map((q) => (
                <button
                  key={q.key}
                  onClick={() => setActiveSubTab(q.key)}
                  className="text-left border border-border rounded-lg p-5 hover:shadow-md hover:border-primary/40 transition-all"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <q.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">{q.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{q.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sub-módulos por tabs */}
        {activeSubTab && (
          <Card className="animate-fade-in">
            <CardContent className="p-6">
              <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                <TabsList className="rounded-full bg-muted p-1">
                  <TabsTrigger value="usuarios" className="rounded-full gap-2">
                    <Users className="h-4 w-4" /> Usuarios
                  </TabsTrigger>
                  <TabsTrigger value="areas" className="rounded-full gap-2">
                    <Building className="h-4 w-4" /> Áreas
                  </TabsTrigger>
                  <TabsTrigger value="roles" className="rounded-full gap-2">
                    <ShieldCheck className="h-4 w-4" /> Roles
                  </TabsTrigger>
                </TabsList>

                {/* USUARIOS */}
                <TabsContent value="usuarios" className="mt-6 space-y-5">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por nombre, correo o cargo..."
                      className="pl-11 rounded-full h-11"
                    />
                  </div>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Usuarios</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Consulta y administra los usuarios de tu compañía, sus áreas y permisos asignados.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="gap-2">
                        <FileDown className="h-4 w-4" /> Descargar plantilla
                      </Button>
                      <Button variant="outline" className="gap-2">
                        <FileUp className="h-4 w-4" /> Importar Excel
                      </Button>
                      <Button className="gap-2">
                        <UserPlus className="h-4 w-4" /> Crear usuario
                      </Button>
                    </div>
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Nombre</TableHead>
                          <TableHead>Área</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead>Correo</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">
                              {u.nombre}
                              {u.isMe && (
                                <span className="ml-2 text-xs text-primary font-semibold">(Tú)</span>
                              )}
                            </TableCell>
                            <TableCell>{u.area}</TableCell>
                            <TableCell>{u.cargo}</TableCell>
                            <TableCell className="text-muted-foreground">{u.correo}</TableCell>
                            <TableCell className="text-muted-foreground">{u.telefono}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* ÁREAS */}
                <TabsContent value="areas" className="mt-6 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Áreas</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Administra las áreas organizacionales de tu compañía.
                      </p>
                    </div>
                    <Button className="gap-2">
                      <Building className="h-4 w-4" /> Crear área
                    </Button>
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Área</TableHead>
                          <TableHead>Responsable</TableHead>
                          <TableHead>Miembros</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockAreas.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.nombre}</TableCell>
                            <TableCell>{a.responsable}</TableCell>
                            <TableCell>{a.miembros}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* ROLES — Matriz RBAC */}
                <TabsContent value="roles" className="mt-6 space-y-5">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Matriz de Roles y Permisos</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Configura los permisos granulares por módulo para cada rol del sistema.
                    </p>
                  </div>

                  <div className="max-w-sm">
                    <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-2">
                      ROL
                    </p>
                    <Select value={selectedRole} onValueChange={handleSelectRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Módulo</TableHead>
                          <TableHead className="text-center">Ver</TableHead>
                          <TableHead className="text-center">Crear</TableHead>
                          <TableHead className="text-center">Editar</TableHead>
                          <TableHead className="text-center">Eliminar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MODULES.map((mod) => (
                          <TableRow key={mod}>
                            <TableCell className="font-medium">{mod}</TableCell>
                            {PERMS.map((p) => (
                              <TableCell key={p} className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={matrix[mod]?.[p] ?? false}
                                    onCheckedChange={() => togglePerm(mod, p)}
                                  />
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSave} className="gap-2">
                      <Save className="h-4 w-4" /> Guardar Cambios
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
