import { useState, useEffect } from "react"; // 1️⃣ Importamos useEffect
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pencil,
  Users,
  Building,
  ShieldCheck,
  Search,
  FileDown,
  FileUp,
  UserPlus,
  Save,
  MoreHorizontal,
  ArrowLeft,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

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

const ROLES = ["Administrador", "Operativo", "Comercial"] as const;

const MODULES_MAP = {
  "users": "Gestión de Usuarios",
  "inventory": "Inventarios",
  "orders": "Pedidos y Producción",
  "clients": "Clientes y Empresas",
  "billing": "Facturación y Abonos"
};

const MODULE_KEYS = Object.keys(MODULES_MAP);
const PERMS = ["ver", "crear", "editar", "eliminar"] as const;
type Perm = (typeof PERMS)[number];
type PermissionMatrix = Record<string, Record<Perm, boolean>>;

// Matriz inicial limpia por si falla la petición o está cargando
const buildDefaultMatrix = (): PermissionMatrix => {
  const m: PermissionMatrix = {};
  MODULE_KEYS.forEach((mod) => {
    m[mod] = { ver: false, crear: false, editar: false, eliminar: false };
  });
  return m;
};

const VALID = ["users", "areas", "roles"] as const;
type SubTab = (typeof VALID)[number];

const BASE_URL = "http://127.0.0.1:8000";
const ROLE_IDS: Record<string, string> = {
  "Administrador": "b3d68153-03be-4521-a77c-53b85647833a",
  "Operativo": "add99bc2-c7ee-4234-80b4-42921a07655d",
  "Comercial": "3049e008-851c-4e73-bd7a-66a392254fb5"
};

export default function AdministrationSubmodule() {
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const active: SubTab = (VALID as readonly string[]).includes(tab ?? "") ? (tab as SubTab) : "users";

  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>(ROLES[0]);
  const [matrix, setMatrix] = useState<PermissionMatrix>(buildDefaultMatrix());
  const [loading, setLoading] = useState(false);

  // 3️⃣ EFECTO: Se ejecuta automáticamente al montar el componente y cada vez que cambia 'selectedRole'
  useEffect(() => {
    if (active === "roles") {
      fetchPermissionsForRole();
    }
  }, [selectedRole, active]);

  const fetchPermissionsForRole = async () => {
    const roleId = ROLE_IDS[selectedRole];
    if (!roleId) return;

    setLoading(true);
    const GET_PERMISSIONS_URL = `${BASE_URL}/api/v1/users/permisos/roles/${roleId}/permissions/`;

    try {
      const response = await fetch(GET_PERMISSIONS_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('No se pudieron obtener los permisos del rol.');

      const data = await response.json();

      // Construimos una nueva matriz a partir de lo que devolvió Django
      const newMatrix = buildDefaultMatrix();

      if (data.module_permissions && Array.isArray(data.module_permissions)) {
        data.module_permissions.forEach((item: any) => {
          const modKey = item.module; // ej. "users"
          const actions = item.actions || []; // ej. ["read", "create"]

          if (newMatrix[modKey]) {
            newMatrix[modKey] = {
              ver: actions.includes("read"),
              crear: actions.includes("create"),
              editar: actions.includes("update"),
              eliminar: actions.includes("delete"),
            };
          }
        });
      }

      setMatrix(newMatrix);
    } catch (error: any) {
      console.error("Error cargando permisos:", error);
      toast({
        variant: "destructive",
        title: "Error de carga",
        description: "No se pudo sincronizar los permisos actuales desde el servidor.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = (role: string) => {
    setSelectedRole(role);
  };

  const togglePerm = (mod: string, perm: Perm) => {
    setMatrix((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], [perm]: !prev[mod][perm] },
    }));
  };

  const handleSave = async () => {
    const roleId = ROLE_IDS[selectedRole];

    if (!roleId) {
      toast({
        variant: "destructive",
        title: "Error de consistencia",
        description: `El rol seleccionado (${selectedRole}) no existe en la base de datos.`,
      });
      return;
    }

    const UPDATE_PERMISSIONS_URL = `${BASE_URL}/api/v1/users/permisos/roles/${roleId}/permissions/`;

    // 4️⃣ Mapeamos los datos de vuelta convirtiendo 'ver' en 'can_read' etc.
    const formattedPermissions = Object.keys(matrix).map((moduleKey) => ({
      module: moduleKey,
      can_read: matrix[moduleKey].ver,
      can_create: matrix[moduleKey].crear,
      can_update: matrix[moduleKey].editar,
      can_delete: matrix[moduleKey].eliminar,
    }));

    const payload = {
      permissions: formattedPermissions
    };

    try {
      const response = await fetch(UPDATE_PERMISSIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Error al guardar los permisos en Django');

      toast({
        title: "Cambios guardados",
        description: `La matriz de permisos para el rol ${selectedRole} se sincronizó con éxito.`,
      });
    } catch (error: any) {
      console.error("Error en la conexión RBAC:", error);
      toast({
        variant: "destructive",
        title: "Error de servidor",
        description: error.message || "No se pudo sincronizar la matriz con el backend.",
      });
    }
  };

  const filteredUsers = mockUsers.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.nombre.toLowerCase().includes(q) ||
      u.correo.toLowerCase().includes(q) ||
      u.cargo.toLowerCase().includes(q)
    );
  });

  const titles: Record<SubTab, string> = {
    users: "Usuarios",
    areas: "Áreas",
    roles: "Roles y Permisos",
  };

  return (
    <AppLayout
      title={`Administración · ${titles[active]}`}
      subtitle="Gestiona usuarios, áreas y roles de tu compañía."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/administration")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Volver a Administración
          </Button>
        </div>

        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <Tabs value={active} onValueChange={(v) => navigate(`/administration/${v}`)}>
              <TabsList className="rounded-full bg-muted p-1">
                <TabsTrigger value="users" className="rounded-full gap-2">
                  <Users className="h-4 w-4" /> Usuarios
                </TabsTrigger>
                <TabsTrigger value="areas" className="rounded-full gap-2">
                  <Building className="h-4 w-4" /> Áreas
                </TabsTrigger>
                <TabsTrigger value="roles" className="rounded-full gap-2">
                  <ShieldCheck className="h-4 w-4" /> Roles
                </TabsTrigger>
              </TabsList>

              {/* ... Contenido de la pestaña de Usuarios ... */}
              <TabsContent value="users" className="mt-6 space-y-5">
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

              {/* ... Contenido de la pestaña de Áreas ... */}
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

              {/* ... Contenido de la pestaña de Roles ... */}
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

                <div className="border border-border rounded-lg overflow-hidden relative">
                  {/* Opacidad visual simple mientras carga */}
                  <div className={loading ? "opacity-40 pointer-events-none" : ""}>
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
                        {MODULE_KEYS.map((modKey) => (
                          <TableRow key={modKey}>
                            <TableCell className="font-medium">{MODULES_MAP[modKey as keyof typeof MODULES_MAP]}</TableCell>
                            {PERMS.map((p) => (
                              <TableCell key={p} className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={matrix[modKey]?.[p] ?? false}
                                    onCheckedChange={() => togglePerm(modKey, p)}
                                  />
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center font-semibold text-sm text-muted-foreground">
                      Cargando permisos reales...
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={loading} className="gap-2">
                    <Save className="h-4 w-4" /> Guardar Cambios
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}