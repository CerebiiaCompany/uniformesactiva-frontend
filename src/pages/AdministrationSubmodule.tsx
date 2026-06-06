import { useState, useEffect } from "react";
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
  X,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Interfaz corregida con los datos reales que usamos de la API
interface User {
  id: string;
  nombre: string;
  area: string;
  cargo: string;
  correo: string;
  isMe?: boolean;
}

const mockAreas = [
  { id: "1", nombre: "Administración", responsable: "Carlos Ramírez", miembros: 3 },
  { id: "2", nombre: "Comercial", responsable: "María Gómez", miembros: 5 },
  { id: "3", nombre: "Producción", responsable: "Andrés Torres", miembros: 12 },
  { id: "4", nombre: "Contabilidad", responsable: "Laura Pérez", miembros: 2 },
];

interface IRole {
  id: string;
  name: string;
  description: string | null;
}

interface DBModule {
  id: string;
  code: string;
  name: string;
  description: string;
}

const PERMS = ["ver", "crear", "editar", "eliminar"] as const;
type Perm = (typeof PERMS)[number];
type PermissionMatrix = Record<string, Record<Perm, boolean>>;

const buildDefaultMatrix = (moduleCodes: string[]): PermissionMatrix => {
  const m: PermissionMatrix = {};
  moduleCodes.forEach((code) => {
    m[code] = { ver: false, crear: false, editar: false, eliminar: false };
  });
  return m;
};

const VALID = ["users", "areas", "roles"] as const;
type SubTab = (typeof VALID)[number];

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AdministrationSubmodule() {
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const active: SubTab = (VALID as readonly string[]).includes(tab ?? "") ? (tab as SubTab) : "users";
  const [search, setSearch] = useState("");
  // Estado inicializado como un arreglo vacío listo para recibir los usuarios reales
  const [users, setUsers] = useState<User[]>([]);
  const [rolesList, setRolesList] = useState<IRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [dbModules, setDbModules] = useState<DBModule[]>([]);
  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [loading, setLoading] = useState(false);

  // --- ESTADOS PARA CONTROLAR EL MODAL Y FORMULARIO DE NUEVO USUARIO ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    roles: ["Operativo"],
    status: "active"
  });

  // --- ESTADOS PARA CONTROLAR EL MODAL Y FORMULARIO DE EDICIÓN ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    roles: ["Operativo"],
    status: "active"
  });

  // --- ESTADOS PARA CONTROLAR EL MODAL DE ELIMINACIÓN ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDeleteId, setUserToDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsersData = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${BASE_URL}/api/v1/users/`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : "",
          },
        });

        if (!response.ok) {
          throw new Error("No se pudo cargar la lista de usuarios del servidor.");
        }

        const data = await response.json();

        const mappedUsers = data.map((u: any) => ({
          id: u.id,
          nombre: `${u.first_name} ${u.last_name}`.trim() || u.username,
          area: u.roles && u.roles.length > 0 ? u.roles.join(", ") : "Sin rol asignado",
          cargo: u.status === "active" ? "Activo" : "Inactivo",
          correo: u.email,
          isMe: u.username === "admin_flow" || u.username === "enava_dev",
        }));

        setUsers(mappedUsers);
      } catch (error) {
        console.error("Error cargando usuarios de la API:", error);
      }
    };

    if (active === "users") {
      fetchUsersData();
    }
  }, [active]);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/v1/users/permisos/modules/`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          }
        });
        if (!response.ok) throw new Error("No se pudo obtener la lista de módulos de la BD.");

        const modulesData: DBModule[] = await response.json();
        setDbModules(modulesData);

        const codes = modulesData.map(m => m.code);
        setMatrix(buildDefaultMatrix(codes));
      } catch (error) {
        console.error("Error cargando módulos dinámicos:", error);
      }
    };

    if (active === "roles") {
      fetchModules();
    }
  }, [active]);

  useEffect(() => {
    const fetchInitialRoles = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/v1/users/permisos/roles/`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          }
        });
        if (!response.ok) throw new Error("No se pudo cargar el catálogo de roles.");

        const data: IRole[] = await response.json();
        setRolesList(data);

        if (data.length > 0) {
          setSelectedRole(data[0].id);
        }
      } catch (error) {
        console.error("Error cargando catálogo de roles:", error);
      }
    };

    if (active === "roles") {
      fetchInitialRoles();
    }
  }, [active]);

  useEffect(() => {
    if (active === "roles" && selectedRole && dbModules.length > 0) {
      fetchPermissionsForRole();
    }
  }, [selectedRole, active, dbModules]);

  const fetchPermissionsForRole = async () => {
    if (!selectedRole) return;

    loading || setLoading(true);
    const GET_PERMISSIONS_URL = `${BASE_URL}/api/v1/users/permisos/roles/${selectedRole}/permissions/`;

    try {
      const response = await fetch(GET_PERMISSIONS_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('No se pudieron obtener los permisos del rol.');

      const data = await response.json();

      const codes = dbModules.map(m => m.code);
      const newMatrix = buildDefaultMatrix(codes);

      if (data.module_permissions && Array.isArray(data.module_permissions)) {
        data.module_permissions.forEach((item: any) => {
          const modKey = item.module;
          const actions = item.actions || [];

          if (newMatrix[modKey] !== undefined) {
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

  const handleSelectRole = (roleId: string) => {
    setSelectedRole(roleId);
  };

  const togglePerm = (mod: string, perm: Perm) => {
    setMatrix((prev) => ({
      ...prev,
      [mod]: {
        ...prev[mod],
        [perm]: prev[mod] ? !prev[mod][perm] : false
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedRole) return;

    const UPDATE_PERMISSIONS_URL = `${BASE_URL}/api/v1/users/permisos/roles/${selectedRole}/permissions/`;

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

      const currentRoleObj = rolesList.find(r => r.id === selectedRole);

      toast({
        title: "Cambios guardados",
        description: `La matriz de permisos para el rol ${currentRoleObj?.name || ""} se sincronizó con éxito.`,
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

  // --- HANDLER PARA ENVIAR EL POST DE CREACIÓN A DJANGO ---
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${BASE_URL}/api/v1/users/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.status === 201) {
        toast({
          title: "Usuario creado",
          description: `El usuario ${data.username} se ha registrado exitosamente.`,
        });

        const newUserMapped: User = {
          id: data.id || String(Date.now()),
          nombre: `${data.first_name} ${data.last_name}`.trim() || data.username,
          area: data.roles && data.roles.length > 0 ? data.roles.join(", ") : "Sin rol asignado",
          cargo: data.status === "active" ? "Activo" : "Inactivo",
          correo: data.email,
          isMe: false,
        };

        setUsers((prev) => [newUserMapped, ...prev]);
        setIsModalOpen(false);

        setFormData({
          username: "",
          email: "",
          first_name: "",
          last_name: "",
          password: "",
          roles: ["Operativo"],
          status: "active"
        });
      } else if (response.status === 400) {
        let errorMsg = "Verifica los datos ingresados.";
        if (data.username) errorMsg = "El nombre de usuario ya existe.";
        else if (data.email) errorMsg = "El correo electrónico ya está registrado.";

        toast({
          variant: "destructive",
          title: "Error al crear usuario",
          description: errorMsg,
        });
      } else {
        throw new Error();
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error de red",
        description: "Hubo un error al comunicar con el endpoint de Django.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- HANDLER PARA OBTENER LOS DATOS ACTUALES E INYECTARLOS AL FORMULARIO DE EDICIÓN ---
  const handleOpenEditModal = async (userId: string) => {
    try {
      const token = localStorage.getItem("token");

      // Cambiamos el método de GET a PATCH para alinearnos con lo que descubriste en Postman
      const response = await fetch(`${BASE_URL}/api/v1/users/${userId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        // Enviamos un objeto vacío ya que Postman demostró que el backend responde con los datos del usuario
        body: JSON.stringify({}),
      });

      if (!response.ok) throw new Error("No se pudieron extraer los detalles del usuario.");

      const u = await response.json();

      setSelectedUserId(userId);

      // Mapeamos las propiedades exactas que vimos en tu respuesta de Postman
      setEditFormData({
        username: u.username || "",
        email: u.email || "",
        first_name: u.first_name || "",
        last_name: u.last_name || "",
        // Mapeamos roles asegurándonos de que si viene un array vacío o null use por defecto 'Operativo'
        roles: u.roles && u.roles.length > 0 ? u.roles : ["Operativo"],
        status: u.status || "active"
      });

      setIsEditModalOpen(true);
    } catch (error) {
      console.error("Error cargando usuario para edición:", error);
      toast({
        variant: "destructive",
        title: "Error de carga",
        description: "No se pudieron recuperar los datos actualizados del usuario.",
      });
    }
  };

  // --- HANDLER PARA ENVIAR EL PATCH DE ACTUALIZACIÓN A DJANGO ---
  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(true);

    try {
      const token = localStorage.getItem("token");

      // Limpiamos y aseguramos que el estado vaya estrictamente en minúsculas hacia Django
      const cleanStatus = String(editFormData.status).toLowerCase().trim();
      const backendStatus = cleanStatus.includes("inactiv") || cleanStatus === "inactive" ? "inactive" : "active";

      // Construimos el payload idéntico a la estructura limpia que Postman aprobó con éxito
      const payload = {
        username: editFormData.username.trim(),
        email: editFormData.email.trim(),
        first_name: editFormData.first_name.trim(),
        last_name: editFormData.last_name.trim(),
        roles: editFormData.roles,
        status: backendStatus
      };

      const response = await fetch(`${BASE_URL}/api/v1/users/${selectedUserId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Usuario actualizado",
          description: `Los cambios de ${data.username} se guardaron correctamente.`,
        });

        // Mapeo inverso exacto para actualizar la tabla del frontend en tiempo real
        const updatedUserMapped: User = {
          id: String(data.id),
          nombre: `${data.first_name} ${data.last_name}`.trim() || data.username,
          area: data.roles && data.roles.length > 0 ? data.roles.join(", ") : "Sin rol asignado",
          cargo: data.status === "active" ? "Activo" : "Inactivo",
          correo: data.email,
          isMe: data.username === "admin_flow" || data.username === "enava_dev",
        };

        setUsers((prev) => prev.map((u) => (u.id === String(data.id) ? updatedUserMapped : u)));
        setIsEditModalOpen(false);
      } else if (response.status === 400) {
        let errorMsg = "Ocurrió un problema al actualizar.";
        if (data.username) errorMsg = "El nombre de usuario ya se encuentra en uso o contiene caracteres inválidos.";
        else if (data.email) errorMsg = "El correo electrónico ya se encuentra registrado.";

        toast({
          variant: "destructive",
          title: "Error de validación",
          description: errorMsg,
        });
      } else {
        throw new Error();
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error de red",
        description: "Hubo una falla al conectar con el servidor para guardar los cambios.",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteUserSubmit = async () => {
    if (!userToDeleteId) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${BASE_URL}/api/v1/users/${userToDeleteId}/`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
      });

      if (!response.ok) {
        throw new Error("No se pudo eliminar (inactivar) el usuario del servidor.");
      }

      if (tab === "users" || !tab) {
        setUsers((prevUsers) => prevUsers.filter((u) => u.id !== userToDeleteId));
      }

      setIsDeleteModalOpen(false);
      setUserToDeleteId(null);

    } catch (error) {
      console.error("Error al intentar eliminar el usuario:", error);
      alert("Hubo un error al intentar eliminar el usuario.");
    }
  };

  const filteredUsers = users.filter((u) => {
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

              {/* Contenido de la pestaña de Usuarios */}
              <TabsContent value="users" className="mt-6 space-y-5">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, correo o estado..."
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
                    <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                      <UserPlus className="h-4 w-4" /> Crear usuario
                    </Button>
                  </div>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Nombre</TableHead>
                        <TableHead>Área / Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Correo</TableHead>
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
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditModal(u.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setUserToDeleteId(u.id);
                                setIsDeleteModalOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Contenido de la pestaña de Áreas */}
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

              {/* Contenido de la pestaña de Roles */}
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
                  {rolesList.length > 0 && selectedRole ? (
                    <Select value={selectedRole} onValueChange={handleSelectRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rolesList.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-10 w-full animate-pulse bg-muted rounded-md" />
                  )}
                </div>

                <div className="border border-border rounded-lg overflow-hidden relative">
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
                        {dbModules.map((mod) => (
                          <TableRow key={mod.code}>
                            <TableCell className="font-medium">{mod.name}</TableCell>
                            {PERMS.map((p) => (
                              <TableCell key={p} className="text-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={matrix[mod.code]?.[p] ?? false}
                                    onCheckedChange={() => togglePerm(mod.code, p)}
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

      {/* --- RENDERIZADO DEL MODAL EMERGENTE PARA CREAR USUARIO --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <UserPlus className="w-5 h-5 text-primary" />
                <span>Registrar Nuevo Usuario</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="p-6 space-y-4 overflow-y-auto">

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nombres</label>
                  <Input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="Ingrese ambos nombres"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Apellidos</label>
                  <Input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Ingrese ambos apellidos"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nombre de Usuario</label>
                <Input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Ingrese el nombre de usuario"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Correo Electrónico</label>
                <Input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Ingrese el correo electronico"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contraseña</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••••••"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rol / Área</label>
                  <Select
                    value={formData.roles[0]}
                    onValueChange={(val) => setFormData({ ...formData, roles: [val] })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                      <SelectItem value="Operativo">Operativo</SelectItem>
                      <SelectItem value="Comercial">Comercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Estado Inicial</label>
                  <Select
                    value={formData.status}
                    onValueChange={(val) => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? "Guardando..." : "Guardar Usuario"}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- RENDERIZADO DEL MODAL EMERGENTE PARA EDITAR USUARIO (PATCH) --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Pencil className="w-5 h-5 text-primary" />
                <span>Modificar Usuario</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setIsEditModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="p-6 space-y-4 overflow-y-auto">

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nombres</label>
                  <Input
                    type="text"
                    required
                    value={editFormData.first_name}
                    onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                    placeholder="Modificar nombres"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Apellidos</label>
                  <Input
                    type="text"
                    required
                    value={editFormData.last_name}
                    onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                    placeholder="Modificar apellidos"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nombre de Usuario</label>
                <Input
                  type="text"
                  required
                  value={editFormData.username}
                  onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                  placeholder="Modificar nombre de usuario"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Correo Electrónico</label>
                <Input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  placeholder="Modificar correo electrónico"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rol / Área</label>
                  <Select
                    value={editFormData.roles[0]}
                    onValueChange={(val) => setEditFormData((prev) => ({ ...prev, roles: [val] }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                      <SelectItem value="Operativo">Operativo</SelectItem>
                      <SelectItem value="Comercial">Comercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Estado Actual</label>
                  <Select
                    value={editFormData.status}
                    onValueChange={(val) => setEditFormData((prev) => ({ ...prev, status: val }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isEditing}
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isEditing} className="gap-2">
                  {isEditing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEditing ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE CONFIRMACIÓN PARA ELIMINAR USUARIO --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md overflow-hidden flex flex-col">

            {/* Encabezado */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Trash2 className="w-5 h-5 text-destructive" />
                <span>Confirmar Eliminación</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDeleteId(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Cuerpo */}
            <div className="p-6 text-sm text-muted-foreground">
              <p>¿Estás seguro de que deseas eliminar este usuario? Esta acción cambiará su estado a <strong>Inactivo</strong> en el sistema.</p>
            </div>

            {/* Acciones del Modal */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/10">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDeleteId(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteUserSubmit}
              >
                Confirmar
              </Button>
            </div>

          </div>
        </div>
      )}
    </AppLayout>
  );
}