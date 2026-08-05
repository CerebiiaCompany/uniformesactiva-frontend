import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
  Plus,
  Trash2,
} from "lucide-react";
import { useGetSatellites, useCreateSatellite } from "@/hooks/useSatellites";
import { toast } from "@/hooks/use-toast";
import { getApiBaseUrl } from "@/lib/api-base";
import { clearSessionAndRedirectToLogin } from "@/lib/auth-redirect";
import { UnauthorizedError } from "@/lib/http";
import { cn } from "@/lib/utils";
import { endpoints } from "@/lib/api-endpoints";
import { sortModulesBySidebarOrder } from "@/lib/module-sidebar-order";
import { KanbanStageChip } from "@/components/KanbanStageChip";
import {
  getCapaActionsForRole,
  saveCapaActionsForRole,
  toggleCapaAction,
  getCapaActionsForStage,
  CAPA_KANBAN_ACTIONS,
  notifyKanbanEtapasUpdated,
  KANBAN_ETAPAS_UPDATED_EVENT,
  parseStageKeys,
  joinStageKeys,
  isKanbanOperatorRole,
  type CapaActionsMap,
} from "@/lib/production-capa-permissions";

// Interfaz corregida con los datos reales que usamos de la API
interface User {
  id: string;
  nombre: string;
  area: string;
  cargo: string;
  correo: string;
  phone?: string;
  status?: string;
  role?: string;
  productionStageKey?: string;
  productionStageKeys?: string[];
  satelliteId?: string | null;
  isMe?: boolean;
}

const AREA_DEFINITIONS = [
  {
    id: "admin",
    nombre: "Administración",
    descripcion: "Dirección, finanzas y configuración.",
  },
  {
    id: "comercial",
    nombre: "Comercial",
    descripcion: "Clientes, cotizaciones y órdenes.",
  },
  {
    id: "produccion",
    nombre: "Producción",
    descripcion: "", // se completa con capas del Kanban
  },
  {
    id: "inventario",
    nombre: "Inventario",
    descripcion: "Materiales, telas e insumos.",
  },
  {
    id: "logistica",
    nombre: "Logística",
    descripcion: "Despachos y domicilios.",
  },
] as const;

const USER_ROLES = [
  "Administrador",
  "Comercial",
  "Producción",
  "Inventario",
  "Despachos",
  "Diseño",
  "Satélite",
] as const;

const ROLE_CARD_META: Record<string, string> = {
  Administrador: "Acceso total al sistema y a la configuración de la compañía.",
  Comercial: "Gestiona clientes, cotizaciones y creación de órdenes.",
  Producción: "Opera su capa del Kanban: edita tarjetas, solicita inventario y avanza a la siguiente etapa.",
  Inventario: "Administra materiales, proveedores y movimientos de stock.",
  Despachos: "Gestiona entregas a clientes y domicilios a satélites.",
  Diseño: "Crea y mantiene las líneas de producto y sus fichas técnicas.",
  Satélite: "Opera tarjetas Kanban asignadas como satélite en sus capas configuradas.",
};

const USER_AREAS = [
  "Administración",
  "Comercial",
  "Producción",
  "Inventario",
  "Logística",
  "Despachos",
] as const;

type UserFormState = {
  full_name: string;
  email: string;
  phone: string;
  area: string;
  roles: string[];
  cargo: string;
  production_stage_keys: string[];
  satellite_id: string;
  password: string;
  status: string;
};

const CREATE_SATELLITE_OPTION = "__create_satellite__";

const emptyUserForm = (): UserFormState => ({
  full_name: "",
  email: "",
  phone: "",
  area: "",
  roles: [],
  cargo: "",
  production_stage_keys: [],
  satellite_id: "",
  password: "",
  status: "active",
});

function toggleStageKey(keys: string[], key: string): string[] {
  const set = new Set(keys);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return Array.from(set);
}

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

interface KanbanCapa {
  id: string;
  key: string;
  label: string;
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

const BASE_URL = getApiBaseUrl();

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    clearSessionAndRedirectToLogin();
    throw new UnauthorizedError();
  }
  return response;
}

const AREA_TO_ROLE: Record<string, string> = {
  Administración: "Administrador",
  Comercial: "Comercial",
  Producción: "Producción",
  Inventario: "Inventario",
  Logística: "Despachos",
  Despachos: "Despachos",
};

const ROLE_TO_AREA: Record<string, string> = {
  Administrador: "Administración",
  Comercial: "Comercial",
  Producción: "Producción",
  Inventario: "Inventario",
  Despachos: "Logística",
  Diseño: "Producción",
  Satélite: "Producción",
};

function normalizeRoleName(raw: unknown): string {
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return "";
    const m = s.match(/name=['"]([^'"]+)['"]/);
    return (m?.[1] || s).trim();
  }
  if (raw && typeof raw === "object" && "name" in raw) {
    return String((raw as { name?: unknown }).name || "").trim();
  }
  return "";
}

function normalizeRoles(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const names = list.map(normalizeRoleName).filter(Boolean);
  const matched = names.find((r) =>
    (USER_ROLES as readonly string[]).includes(r)
  );
  return matched ? [matched] : names.slice(0, 1);
}

function resolveUserArea(area: string, roles: string[]): string {
  const raw = (area || "").trim();
  if (raw && raw.toLowerCase() !== "administrador") {
    const exact = (USER_AREAS as readonly string[]).find(
      (a) => a.toLowerCase() === raw.toLowerCase()
    );
    if (exact) return exact;
    return raw;
  }
  for (const role of roles) {
    const mapped = ROLE_TO_AREA[role];
    if (mapped && (USER_AREAS as readonly string[]).includes(mapped)) {
      return mapped;
    }
  }
  return "Administración";
}

function buildEditFormFromApiUser(u: Record<string, unknown>): UserFormState {
  const roles = normalizeRoles(u.roles);
  const first = String(u.first_name || "").trim();
  const last = String(u.last_name || "").trim();
  const fullFromParts = `${first} ${last}`.trim();
  const fullName =
    fullFromParts ||
    String(u.full_name || "").trim() ||
    String(u.username || "").trim();

  return {
    full_name: fullName,
    email: String(u.email || "").trim(),
    phone: String(u.phone || "").trim(),
    area: resolveUserArea(String(u.area || ""), roles),
    roles: roles.length ? roles : ["Comercial"],
    cargo: String(u.cargo || "").trim(),
    production_stage_keys: parseStageKeys(
      Array.isArray(u.production_stage_keys)
        ? u.production_stage_keys
        : u.production_stage_key
    ),
    satellite_id: u.satellite_id ? String(u.satellite_id) : "",
    password: "",
    status:
      String(u.status || "active").toLowerCase() === "inactive"
        ? "inactive"
        : "active",
  };
}

function userBelongsToArea(user: User, areaNombre: string): boolean {
  const areaName = areaNombre.toLowerCase();
  const userArea = (user.area || "").toLowerCase();
  const userRole = (user.role || "").toLowerCase();

  if (areaName === "administración" || areaName === "administracion") {
    return (
      userArea.includes("administr") ||
      userRole === "administrador" ||
      userRole.includes("admin")
    );
  }
  if (areaName === "logística" || areaName === "logistica") {
    return (
      userArea.includes("logíst") ||
      userArea.includes("logist") ||
      userArea.includes("despacho") ||
      userRole === "despachos"
    );
  }
  if (areaName === "producción" || areaName === "produccion") {
    return userArea.includes("produc") || userRole === "producción" || userRole === "produccion";
  }
  return userArea === areaName || userArea.includes(areaName) || userRole === areaName;
}

function mapApiUser(u: Record<string, unknown>): User {
  const first = String(u.first_name || "");
  const last = String(u.last_name || "");
  const roles = normalizeRoles(u.roles);
  const role = roles[0] || "";
  let currentUsername = "";
  try {
    const raw = localStorage.getItem("user");
    if (raw) currentUsername = String(JSON.parse(raw)?.username || "");
  } catch {
    currentUsername = "";
  }

  return {
    id: String(u.id),
    nombre: `${first} ${last}`.trim() || String(u.username || ""),
    area: resolveUserArea(String(u.area || ""), roles),
    cargo: String(u.cargo || "").trim(),
    correo: String(u.email || ""),
    phone: String(u.phone || "").trim(),
    status: String(u.status || "active"),
    role,
    productionStageKey: String(u.production_stage_key || ""),
    productionStageKeys: parseStageKeys(
      Array.isArray(u.production_stage_keys)
        ? u.production_stage_keys
        : u.production_stage_key
    ),
    satelliteId: u.satellite_id ? String(u.satellite_id) : null,
    isMe:
      Boolean(currentUsername) &&
      String(u.username || "") === currentUsername,
  };
}

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
  const [formData, setFormData] = useState<UserFormState>(emptyUserForm);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<UserFormState>(emptyUserForm);
  const [kanbanCapas, setKanbanCapas] = useState<KanbanCapa[]>([]);
  const [capaActions, setCapaActions] = useState<CapaActionsMap>({});
  const [newSatelliteName, setNewSatelliteName] = useState("");
  const [editNewSatelliteName, setEditNewSatelliteName] = useState("");

  const { satellites, isLoading: loadingSatellites, refetch: refetchSatellites } =
    useGetSatellites({ estado: "active" });
  const { createSatellite, isPending: creatingSatellite } = useCreateSatellite();

  const activeSatellites = useMemo(
    () => satellites.filter((s) => s.status === "active"),
    [satellites]
  );

  // --- ESTADOS PARA CONTROLAR EL MODAL DE ELIMINACIÓN ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDeleteId, setUserToDeleteId] = useState<string | null>(null);

  const fetchCapas = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await apiFetch(endpoints.orders.kanbanEtapas(), {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (!response.ok) return;
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setKanbanCapas(
        list
          .map((e: { id: string; key: string; label: string; orden?: number }) => ({
            id: e.id,
            key: e.key,
            label: e.label,
            orden: e.orden ?? 0,
          }))
          .sort((a, b) => a.orden - b.orden)
          .map(({ id, key, label }) => ({ id, key, label }))
      );
    } catch {
      // silenciosamente: el select de capa quedará vacío si falla
    }
  }, []);

  useEffect(() => {
    const fetchUsersData = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await apiFetch(`${BASE_URL}/api/v1/users/`, {
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
        setUsers(Array.isArray(data) ? data.map((u: Record<string, unknown>) => mapApiUser(u)) : []);
      } catch (error) {
        console.error("Error cargando usuarios de la API:", error);
      }
    };

    if (active === "users" || active === "areas" || active === "roles") {
      fetchUsersData();
      fetchCapas();
    }
  }, [active, fetchCapas]);

  // Refrescar capas al volver a la ventana o cuando Fábrica crea/edita un Kanban
  useEffect(() => {
    const refresh = () => {
      if (active === "users" || active === "areas" || active === "roles") {
        fetchCapas();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener(KANBAN_ETAPAS_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener(KANBAN_ETAPAS_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, fetchCapas]);

  const selectedRoleObj = useMemo(
    () => rolesList.find((r) => r.id === selectedRole) || null,
    [rolesList, selectedRole]
  );

  const roleUserCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const role of rolesList) {
      counts[role.name] = users.filter((u) => u.role === role.name).length;
    }
    return counts;
  }, [rolesList, users]);

  const displayRoles = useMemo(() => {
    const order = [
      "Administrador",
      "Comercial",
      "Producción",
      "Inventario",
      "Despachos",
      "Diseño",
      "Satélite",
    ];
    const byName = new Map(rolesList.map((r) => [r.name, r]));
    const ordered = order
      .map((name) => byName.get(name))
      .filter(Boolean) as IRole[];
    const extras = rolesList.filter((r) => !order.includes(r.name));
    return [...ordered, ...extras];
  }, [rolesList]);

  const areasRows = useMemo(() => {
    const kanbanDescripcion =
      kanbanCapas.length > 0
        ? kanbanCapas.map((c) => c.label).join(", ")
        : "Sin capas Kanban configuradas.";

    return AREA_DEFINITIONS.map((area) => {
      const members = users.filter((u) => userBelongsToArea(u, area.nombre));

      const responsable =
        members.find((m) => m.role === "Administrador")?.nombre ||
        members[0]?.nombre ||
        "Sin asignar";

      const descripcion =
        area.nombre === "Producción" ? kanbanDescripcion : area.descripcion;

      return {
        id: area.id,
        nombre: area.nombre,
        responsable,
        descripcion,
        miembros: members.length,
      };
    });
  }, [users, kanbanCapas]);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await apiFetch(`${BASE_URL}/api/v1/users/permisos/modules/`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          }
        });
        if (!response.ok) throw new Error("No se pudo obtener la lista de módulos de la BD.");

        const modulesData: DBModule[] = sortModulesBySidebarOrder(
          await response.json()
        );
        setDbModules(modulesData);

        const codes = modulesData.map((m) => m.code);
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
        const response = await apiFetch(`${BASE_URL}/api/v1/users/permisos/roles/`, {
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

  useEffect(() => {
    if (!selectedRole) {
      setCapaActions({});
      return;
    }
    setCapaActions(getCapaActionsForRole(rolesList.find((r) => r.id === selectedRole)?.name || ""));
  }, [selectedRole, rolesList]);

  const fetchPermissionsForRole = async () => {
    if (!selectedRole) return;

    loading || setLoading(true);
    const GET_PERMISSIONS_URL = `${BASE_URL}/api/v1/users/permisos/roles/${selectedRole}/permissions/`;

    try {
      const response = await apiFetch(GET_PERMISSIONS_URL, {
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
      if (error instanceof UnauthorizedError) return;
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
    const role = rolesList.find((r) => r.id === roleId);
    if (role?.name === "Producción" || role?.name === "Satélite") {
      fetchCapas();
    }
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

    // Producción / Satélite: permisos por capa Kanban
    if (selectedRoleObj?.name === "Producción" || selectedRoleObj?.name === "Satélite") {
      saveCapaActionsForRole(selectedRoleObj.name, capaActions);
      toast({
        title: "Cambios guardados",
        description: `Los permisos por capa Kanban de ${selectedRoleObj.name} se guardaron correctamente.`,
      });
      return;
    }

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
      const response = await apiFetch(UPDATE_PERMISSIONS_URL, {
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
      if (error instanceof UnauthorizedError) return;
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
    if (!formData.roles[0]) {
      toast({
        variant: "destructive",
        title: "Rol requerido",
        description: "Selecciona un rol para el usuario.",
      });
      return;
    }
    if (isKanbanOperatorRole(formData.roles[0] || "") && formData.production_stage_keys.length === 0) {
      toast({
        variant: "destructive",
        title: "Capa requerida",
        description: "Para Producción o Satélite debes seleccionar al menos una capa.",
      });
      return;
    }
    if (formData.roles[0] === "Satélite") {
      const creatingNew = formData.satellite_id === CREATE_SATELLITE_OPTION;
      if (!formData.satellite_id || (creatingNew && !newSatelliteName.trim())) {
        toast({
          variant: "destructive",
          title: "Nombre de satélite requerido",
          description: "Selecciona un taller satélite o escribe el nombre para crearlo.",
        });
        return;
      }
    }
    if (!formData.area) {
      toast({
        variant: "destructive",
        title: "Área requerida",
        description: "Selecciona el área del usuario.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token");
      const nameParts = formData.full_name.trim().split(/\s+/);
      const first_name = nameParts[0] || formData.full_name.trim();
      const last_name = nameParts.slice(1).join(" ");

      let satelliteId: string | null = null;
      if (formData.roles[0] === "Satélite") {
        if (formData.satellite_id === CREATE_SATELLITE_OPTION) {
          const created = await createSatellite({
            name: newSatelliteName.trim(),
            contact_name: formData.full_name.trim(),
            phone: formData.phone.trim(),
            status: "active",
          });
          satelliteId = created.id;
          await refetchSatellites();
        } else {
          satelliteId = formData.satellite_id;
        }
      }

      const payload = {
        full_name: formData.full_name.trim(),
        first_name,
        last_name,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        area: formData.area,
        cargo: formData.cargo.trim(),
        roles: formData.roles,
        production_stage_keys: isKanbanOperatorRole(formData.roles[0] || "")
          ? formData.production_stage_keys
          : [],
        production_stage_key: isKanbanOperatorRole(formData.roles[0] || "")
          ? joinStageKeys(formData.production_stage_keys)
          : "",
        satellite_id: satelliteId,
        password: formData.password || undefined,
        status: formData.status,
      };

      const response = await apiFetch(`${BASE_URL}/api/v1/users/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 201) {
        const createdUsername = data.username || formData.email;
        const usedTempPassword = !formData.password.trim();
        toast({
          title: "Usuario creado",
          description: usedTempPassword
            ? `Usuario: ${createdUsername}. Contraseña temporal: Temp.${createdUsername}123! (cámbiala al primer acceso).`
            : `El usuario ${createdUsername} se ha registrado. Puede iniciar sesión con su usuario o correo.`,
        });

        setUsers((prev) => [mapApiUser(data), ...prev]);
        setIsModalOpen(false);
        setFormData(emptyUserForm());
        setNewSatelliteName("");
      } else if (response.status === 400) {
        const errorMsg =
          data?.error?.message ||
          data?.production_stage_key?.[0] ||
          data?.email?.[0] ||
          data?.username?.[0] ||
          "Verifica los datos ingresados.";

        toast({
          variant: "destructive",
          title: "Error al crear usuario",
          description: typeof errorMsg === "string" ? errorMsg : "Verifica los datos ingresados.",
        });
      } else {
        throw new Error();
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
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
    const cached = users.find((u) => u.id === userId);
    if (cached) {
      setSelectedUserId(userId);
      setEditFormData({
        full_name: cached.nombre || "",
        email: cached.correo || "",
        phone: cached.phone || "",
        area: resolveUserArea(cached.area || "", cached.role ? [cached.role] : []),
        roles: cached.role ? [cached.role] : ["Comercial"],
        cargo: cached.cargo || "",
        production_stage_keys: cached.productionStageKeys?.length
          ? cached.productionStageKeys
          : parseStageKeys(cached.productionStageKey),
        satellite_id: cached.satelliteId || "",
        password: "",
        status: cached.status === "inactive" ? "inactive" : "active",
      });
      setEditNewSatelliteName("");
      setIsEditModalOpen(true);
    }

    try {
      const token = localStorage.getItem("token");
      const response = await apiFetch(endpoints.users.detail(userId), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (!response.ok) {
        if (!cached) {
          throw new Error("No se pudieron extraer los detalles del usuario.");
        }
        return;
      }

      const u = (await response.json()) as Record<string, unknown>;
      setSelectedUserId(userId);
      setEditFormData(buildEditFormFromApiUser(u));
      setEditNewSatelliteName("");
      setIsEditModalOpen(true);
    } catch (error) {
      if (error instanceof UnauthorizedError) return;
      if (cached) return;
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
    if (!editFormData.roles[0]) {
      toast({
        variant: "destructive",
        title: "Rol requerido",
        description: "Selecciona un rol para el usuario.",
      });
      return;
    }
    if (isKanbanOperatorRole(editFormData.roles[0] || "") && editFormData.production_stage_keys.length === 0) {
      toast({
        variant: "destructive",
        title: "Capa requerida",
        description: "Para Producción o Satélite debes seleccionar al menos una capa.",
      });
      return;
    }
    if (editFormData.roles[0] === "Satélite") {
      const creatingNew = editFormData.satellite_id === CREATE_SATELLITE_OPTION;
      if (!editFormData.satellite_id || (creatingNew && !editNewSatelliteName.trim())) {
        toast({
          variant: "destructive",
          title: "Nombre de satélite requerido",
          description: "Selecciona un taller satélite o escribe el nombre para crearlo.",
        });
        return;
      }
    }

    setIsEditing(true);

    try {
      const token = localStorage.getItem("token");
      const cleanStatus = String(editFormData.status).toLowerCase().trim();
      const backendStatus =
        cleanStatus.includes("inactiv") || cleanStatus === "inactive" ? "inactive" : "active";
      const nameParts = editFormData.full_name.trim().split(/\s+/);
      const first_name = nameParts[0] || editFormData.full_name.trim();
      const last_name = nameParts.slice(1).join(" ");

      let satelliteId: string | null = null;
      if (editFormData.roles[0] === "Satélite") {
        if (editFormData.satellite_id === CREATE_SATELLITE_OPTION) {
          const created = await createSatellite({
            name: editNewSatelliteName.trim(),
            contact_name: editFormData.full_name.trim(),
            phone: editFormData.phone.trim(),
            status: "active",
          });
          satelliteId = created.id;
          await refetchSatellites();
        } else {
          satelliteId = editFormData.satellite_id;
        }
      }

      const payload = {
        full_name: editFormData.full_name.trim(),
        first_name,
        last_name,
        email: editFormData.email.trim(),
        phone: editFormData.phone.trim(),
        area: editFormData.area,
        cargo: editFormData.cargo.trim(),
        roles: editFormData.roles,
        production_stage_keys: isKanbanOperatorRole(editFormData.roles[0] || "")
          ? editFormData.production_stage_keys
          : [],
        production_stage_key: isKanbanOperatorRole(editFormData.roles[0] || "")
          ? joinStageKeys(editFormData.production_stage_keys)
          : "",
        satellite_id: satelliteId,
        status: backendStatus,
      };

      const response = await apiFetch(`${BASE_URL}/api/v1/users/${selectedUserId}/`, {
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

        setUsers((prev) => prev.map((u) => (u.id === String(data.id) ? mapApiUser(data) : u)));
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
      if (err instanceof UnauthorizedError) return;
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
      const response = await apiFetch(`${BASE_URL}/api/v1/users/${userToDeleteId}/`, {
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
      if (error instanceof UnauthorizedError) return;
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
      eyebrow="Gerencia"
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
                        <TableHead>Área</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Cargo</TableHead>
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
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{u.role || "—"}</span>
                              {isKanbanOperatorRole(u.role || "") &&
                              (u.productionStageKeys?.length || u.productionStageKey) ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(u.productionStageKeys?.length
                                    ? u.productionStageKeys
                                    : parseStageKeys(u.productionStageKey)
                                  ).map((key) => (
                                    <KanbanStageChip
                                      key={key}
                                      stageKey={key}
                                      label={
                                        kanbanCapas.find((c) => c.key === key)?.label || key
                                      }
                                      className="text-[10px] px-2 py-0.5"
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
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
                      Áreas operativas de la compañía y sus responsables.
                    </p>
                  </div>
                  <Button className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                    <Building className="h-4 w-4" /> Crear área
                  </Button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Área</TableHead>
                        <TableHead>Responsable</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-center">Miembros</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {areasRows.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.nombre}</TableCell>
                          <TableCell>{a.responsable}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[320px]">
                            {a.descripcion}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">{a.miembros}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Eliminar área"
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

              {/* Contenido de la pestaña de Roles */}
              <TabsContent value="roles" className="mt-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Roles y permisos</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Permisos por módulo del sistema (órdenes, producción, inventario, satélites,
                      entregas...).
                    </p>
                  </div>
                  <Button className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                    <ShieldCheck className="h-4 w-4" /> Crear rol
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayRoles.length === 0
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-28 rounded-xl border bg-muted/40 animate-pulse"
                        />
                      ))
                    : displayRoles.map((role) => {
                        const selected = role.id === selectedRole;
                        const count = roleUserCounts[role.name] ?? 0;
                        return (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => handleSelectRole(role.id)}
                            className={cn(
                              "text-left rounded-xl border p-4 transition-colors",
                              selected
                                ? "border-red-500 bg-red-50/80 shadow-sm"
                                : "border-border bg-card hover:border-red-300 hover:bg-red-50/40"
                            )}
                          >
                            <p className="font-semibold text-foreground">{role.name}</p>
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed min-h-[2.5rem]">
                              {ROLE_CARD_META[role.name] ||
                                role.description ||
                                "Sin descripción."}
                            </p>
                            <p className="text-xs text-muted-foreground mt-3">
                              {count} usuario(s)
                            </p>
                          </button>
                        );
                      })}
                </div>

                {selectedRoleObj ? (
                  <div className="space-y-4 rounded-xl border p-4">
                    {selectedRoleObj.name === "Producción" ||
                    selectedRoleObj.name === "Satélite" ? (
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">
                            Permisos por capa Kanban — {selectedRoleObj.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Cada usuario de {selectedRoleObj.name} solo opera tarjetas de su capa y
                            puede moverlas únicamente a la siguiente. Marca qué acciones puede hacer
                            en su capa.
                          </p>
                        </div>

                        {kanbanCapas.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No hay capas Kanban. Configúralas primero en Fábrica.
                          </p>
                        ) : (
                          <div className="border border-border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead>Capa</TableHead>
                                  {CAPA_KANBAN_ACTIONS.map((action) => (
                                    <TableHead key={action.code} className="text-center">
                                      <span className="block">{action.label}</span>
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {kanbanCapas.map((capa, idx) => {
                                  const nextLabel =
                                    idx < kanbanCapas.length - 1
                                      ? kanbanCapas[idx + 1].label
                                      : null;
                                  const selected = getCapaActionsForStage(
                                    capaActions,
                                    capa.key
                                  );
                                  return (
                                    <TableRow key={capa.id}>
                                      <TableCell>
                                        <KanbanStageChip
                                          stageKey={capa.key}
                                          label={capa.label}
                                          className="font-semibold"
                                        />
                                        <p className="text-[11px] text-muted-foreground mt-1.5">
                                          {nextLabel
                                            ? `Mueve solo a → ${nextLabel}`
                                            : "Última etapa (sin siguiente)"}
                                        </p>
                                      </TableCell>
                                      {CAPA_KANBAN_ACTIONS.map((action) => (
                                        <TableCell key={action.code} className="text-center">
                                          <div className="flex justify-center">
                                            <Checkbox
                                              checked={selected.includes(action.code)}
                                              onCheckedChange={() =>
                                                setCapaActions((prev) =>
                                                  toggleCapaAction(prev, capa.key, action.code)
                                                )
                                              }
                                            />
                                          </div>
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">
                            Módulos — {selectedRoleObj.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Marca qué módulos puede ver y operar este rol.
                          </p>
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
                      </>
                    )}

                    <div className="flex justify-end">
                      <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Save className="h-4 w-4" /> Guardar cambios
                      </Button>
                    </div>
                  </div>
                ) : null}
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
                <span>Nuevo usuario</span>
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
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Nombre completo <span className="text-red-600">*</span>
                </label>
                <Input
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Ej. Ana Restrepo"
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Correo <span className="text-red-600">*</span>
                </label>
                <Input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ana@uniformesactiva.com"
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Teléfono</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+57 300 000 0000"
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Área <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={formData.area || undefined}
                    onValueChange={(val) => {
                      const autoRole = AREA_TO_ROLE[val];
                      setFormData({
                        ...formData,
                        area: val,
                        ...(autoRole
                          ? {
                              roles: [autoRole],
                              production_stage_keys: isKanbanOperatorRole(autoRole || "")
                                  ? formData.production_stage_keys
                                  : [],
                            }
                          : {}),
                      });
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_AREAS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Rol <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={formData.roles[0] || undefined}
                    onValueChange={(val) =>
                      setFormData({
                        ...formData,
                        roles: [val],
                        production_stage_keys: isKanbanOperatorRole(val)
                          ? formData.production_stage_keys
                          : [],
                        satellite_id: val === "Satélite" ? formData.satellite_id : "",
                      })
                    }
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.roles[0] === "Satélite" ? (
                <div className="space-y-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  <label className="text-sm font-medium">
                    Nombre de satélite <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={formData.satellite_id || undefined}
                    onValueChange={(val) => {
                      setFormData({ ...formData, satellite_id: val });
                      if (val !== CREATE_SATELLITE_OPTION) setNewSatelliteName("");
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue
                        placeholder={
                          loadingSatellites
                            ? "Cargando satélites..."
                            : "Selecciona o crea un satélite"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSatellites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.specialties?.length
                            ? ` · ${s.specialties.slice(0, 2).join(", ")}`
                            : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value={CREATE_SATELLITE_OPTION}>
                        <span className="inline-flex items-center gap-1.5">
                          <Plus className="h-3.5 w-3.5" />
                          Crear nuevo satélite…
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.satellite_id === CREATE_SATELLITE_OPTION ? (
                    <Input
                      value={newSatelliteName}
                      onChange={(e) => setNewSatelliteName(e.target.value)}
                      placeholder="Nombre del nuevo taller satélite"
                      className="h-10 rounded-lg"
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Vincula este usuario con un taller del módulo Satélites. Si no existe, créalo
                    desde aquí.
                  </p>
                </div>
              ) : null}

              {isKanbanOperatorRole(formData.roles[0] || "") ? (
                <div className="space-y-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  <label className="text-sm font-medium">
                    Capas <span className="text-red-600">*</span>
                  </label>
                  {kanbanCapas.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No hay capas Kanban configuradas en Fábrica.
                    </p>
                  ) : (
                    <div className="rounded-lg border px-3 py-2.5 space-y-2">
                      {kanbanCapas.map((c) => {
                        const checked = formData.production_stage_keys.includes(c.key);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2.5 cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                setFormData({
                                  ...formData,
                                  production_stage_keys: toggleStageKey(
                                    formData.production_stage_keys,
                                    c.key
                                  ),
                                })
                              }
                            />
                            <KanbanStageChip stageKey={c.key} label={c.label} />
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Puede encargarse de varias capas. En cada una solo podrá avanzar la tarjeta a
                    la etapa siguiente.
                  </p>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cargo</label>
                <Input
                  value={formData.cargo}
                  onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                  placeholder="Ej. Coordinadora de corte"
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Contraseña inicial</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Opcional — se genera una temporal si la dejas vacía"
                    className="h-10 rounded-lg pr-10"
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

              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
                <div>
                  <p className="text-sm font-medium">Usuario activo</p>
                  <p className="text-xs text-muted-foreground">
                    Puede iniciar sesión y operar sus módulos.
                  </p>
                </div>
                <Switch
                  checked={formData.status === "active"}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, status: checked ? "active" : "inactive" })
                  }
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  {isSubmitting ? "Guardando..." : "Crear usuario"}
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
                <span>Modificar usuario</span>
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
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Nombre completo <span className="text-red-600">*</span>
                </label>
                <Input
                  required
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  placeholder="Ej. Ana Restrepo"
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Correo <span className="text-red-600">*</span>
                </label>
                <Input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  placeholder="ana@uniformesactiva.com"
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Teléfono</label>
                <Input
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="+57 300 000 0000"
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Área <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={editFormData.area || undefined}
                    onValueChange={(val) => {
                      const autoRole = AREA_TO_ROLE[val];
                      setEditFormData({
                        ...editFormData,
                        area: val,
                        ...(autoRole
                          ? {
                              roles: [autoRole],
                              production_stage_keys: isKanbanOperatorRole(autoRole || "")
                                  ? editFormData.production_stage_keys
                                  : [],
                            }
                          : {}),
                      });
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_AREAS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Rol <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={editFormData.roles[0] || undefined}
                    onValueChange={(val) =>
                      setEditFormData({
                        ...editFormData,
                        roles: [val],
                        production_stage_keys: isKanbanOperatorRole(val)
                          ? editFormData.production_stage_keys
                          : [],
                        satellite_id: val === "Satélite" ? editFormData.satellite_id : "",
                      })
                    }
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editFormData.roles[0] === "Satélite" ? (
                <div className="space-y-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  <label className="text-sm font-medium">
                    Nombre de satélite <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={editFormData.satellite_id || undefined}
                    onValueChange={(val) => {
                      setEditFormData({ ...editFormData, satellite_id: val });
                      if (val !== CREATE_SATELLITE_OPTION) setEditNewSatelliteName("");
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue
                        placeholder={
                          loadingSatellites
                            ? "Cargando satélites..."
                            : "Selecciona o crea un satélite"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSatellites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.specialties?.length
                            ? ` · ${s.specialties.slice(0, 2).join(", ")}`
                            : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value={CREATE_SATELLITE_OPTION}>
                        <span className="inline-flex items-center gap-1.5">
                          <Plus className="h-3.5 w-3.5" />
                          Crear nuevo satélite…
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {editFormData.satellite_id === CREATE_SATELLITE_OPTION ? (
                    <Input
                      value={editNewSatelliteName}
                      onChange={(e) => setEditNewSatelliteName(e.target.value)}
                      placeholder="Nombre del nuevo taller satélite"
                      className="h-10 rounded-lg"
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Vincula este usuario con un taller del módulo Satélites. Si no existe, créalo
                    desde aquí.
                  </p>
                </div>
              ) : null}

              {isKanbanOperatorRole(editFormData.roles[0] || "") ? (
                <div className="space-y-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  <label className="text-sm font-medium">
                    Capas <span className="text-red-600">*</span>
                  </label>
                  {kanbanCapas.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No hay capas Kanban configuradas en Fábrica.
                    </p>
                  ) : (
                    <div className="rounded-lg border px-3 py-2.5 space-y-2">
                      {kanbanCapas.map((c) => {
                        const checked = editFormData.production_stage_keys.includes(c.key);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2.5 cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                setEditFormData({
                                  ...editFormData,
                                  production_stage_keys: toggleStageKey(
                                    editFormData.production_stage_keys,
                                    c.key
                                  ),
                                })
                              }
                            />
                            <KanbanStageChip stageKey={c.key} label={c.label} />
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Puede encargarse de varias capas. En cada una solo podrá avanzar la tarjeta a
                    la etapa siguiente.
                  </p>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cargo</label>
                <Input
                  value={editFormData.cargo}
                  onChange={(e) => setEditFormData({ ...editFormData, cargo: e.target.value })}
                  placeholder="Ej. Coordinadora de corte"
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
                <div>
                  <p className="text-sm font-medium">Usuario activo</p>
                  <p className="text-xs text-muted-foreground">
                    Puede iniciar sesión y operar sus módulos.
                  </p>
                </div>
                <Switch
                  checked={editFormData.status === "active"}
                  onCheckedChange={(checked) =>
                    setEditFormData({
                      ...editFormData,
                      status: checked ? "active" : "inactive",
                    })
                  }
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isEditing}
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isEditing}
                  className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isEditing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEditing ? "Guardando..." : "Guardar cambios"}
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