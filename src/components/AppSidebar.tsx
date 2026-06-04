import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Factory,
  Users,
  DollarSign,
  BarChart3,
  Package,
  Globe,
  Scissors,
  Settings,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { jwtDecode } from "jwt-decode";

interface ModulePermission {
  module: string;
  module_name: string;
  actions: string[];
}

interface CustomJwtPayload {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  roles?: string[];
  permissions?: ModulePermission[];
}

const MODULE_MAPPING: Record<string, string> = {
  "users": "Administración",
  "inventory": "Inventario",
  "clients": "Clientes",
  "billing": "Costos"
};

const generalItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Sitio Web", url: "/website", icon: Globe },
];

const comercialItems = [
  { title: "Clientes", url: "/customers", icon: Users },
  { title: "Cotizaciones", url: "/quotations", icon: FileText },
  { title: "Órdenes", url: "/orders", icon: ShoppingCart },
];

const operacionItems = [
  { title: "Fábrica", url: "/production", icon: Factory },
  { title: "Inventario", url: "/inventory", icon: Package },
  { title: "Costos", url: "/costing", icon: DollarSign },
];

const gerenciaItems = [
  { title: "Reportes", url: "/reports", icon: BarChart3 },
  { title: "Administración", url: "/administration", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const token = localStorage.getItem("token");
  const userJson = localStorage.getItem("user");

  let userRoles: string[] = [];
  let userPermissions: ModulePermission[] = [];
  let userEmail = "usuario@flowtextil.com";
  let userFullName = "Usuario";
  let initials = "US";

  // Procesamos la información del usuario autenticado
  if (userJson) {
    try {
      const userData = JSON.parse(userJson);
      userRoles = userData.roles || [];
      userPermissions = userData.permissions || [];
      userEmail = userData.email || "";

      const firstName = userData.first_name || "";
      const lastName = userData.last_name || "";
      userFullName = `${firstName} ${lastName}`.trim() || userData.username || "Usuario";

      initials = firstName && lastName
        ? `${firstName[0]}${lastName[0]}`.toUpperCase()
        : userFullName.substring(0, 2).toUpperCase();
    } catch (e) {
      console.error("Error al parsear el objeto user del localStorage:", e);
    }
  } else if (token) {
    try {
      const decoded = jwtDecode<CustomJwtPayload>(token);
      userRoles = decoded.roles || [];
      userPermissions = decoded.permissions || [];
      userEmail = decoded.email || "";

      const firstName = decoded.first_name || "";
      const lastName = decoded.last_name || "";
      userFullName = `${firstName} ${lastName}`.trim() || decoded.username || "Usuario";

      initials = firstName && lastName
        ? `${firstName[0]}${lastName[0]}`.toUpperCase()
        : userFullName.substring(0, 2).toUpperCase();
    } catch (e) {
      console.error("Error al decodificar el token en el Sidebar:", e);
    }
  }

  const is_admin = userRoles.some(role => role.includes("Administrador"));

  const canViewModule = (title: string) => {
    if (is_admin) return true;

    if (["Dashboard", "Sitio Web"].includes(title)) return true;

    return userPermissions.some((perm) => {
      if (perm.module === "orders" && (title === "Órdenes" || title === "Fábrica")) {
        return perm.actions.includes("read");
      }

      if (perm.module === "users" && (title === "Administración" || title === "Reportes")) {
        return perm.actions.includes("read");
      }
      const mappedTitle = MODULE_MAPPING[perm.module];
      return mappedTitle === title && perm.actions.includes("read");
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast({
      title: "Sesión Finalizada",
      description: "Has salido de FlowTextil correctamente.",
    });
    navigate("/", { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Scissors className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">FlowTextil</h1>
              <p className="text-[10px] text-sidebar-foreground/60">ERP + CRM Textil</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 overflow-hidden">
        {/* General */}
        {generalItems.some(item => canViewModule(item.title)) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest mb-1">
              General
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {generalItems.filter(item => canViewModule(item.title)).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} end={item.url === "/"} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Comercial */}
        {comercialItems.some(item => canViewModule(item.title)) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest mb-1">
              Comercial
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {comercialItems.filter(item => canViewModule(item.title)).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Operación */}
        {operacionItems.some(item => canViewModule(item.title)) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest mb-1">
              Operación
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {operacionItems.filter(item => canViewModule(item.title)).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Gerencia */}
        {gerenciaItems.some(item => canViewModule(item.title)) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest mb-1">
              Gerencia
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {gerenciaItems.filter(item => canViewModule(item.title)).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} end={item.url === "/"} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-3 overflow-hidden">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="animate-fade-in overflow-hidden">
                <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{userFullName}</p>
                <p className="text-[10px] text-sidebar-foreground/60 truncate">{userEmail}</p>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Cerrar sesión"
            className="h-8 w-8 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}