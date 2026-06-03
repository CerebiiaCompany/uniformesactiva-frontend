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

const generalItems = [
  { title: "Dashboard", url: "/Dashboard", icon: LayoutDashboard },
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

  const handleLogout = () => {
    localStorage.removeItem("token");
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
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest mb-1">
            General
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {generalItems.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest mb-1">
            Comercial
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {comercialItems.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest mb-1">
            Operación
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operacionItems.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest mb-1">
            Gerencia
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {gerenciaItems.map((item) => (
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
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-3 overflow-hidden">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                AD
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="animate-fade-in overflow-hidden">
                <p className="text-xs font-medium text-sidebar-accent-foreground truncate">Admin</p>
                <p className="text-[10px] text-sidebar-foreground/60 truncate">admin@flowtextil.com</p>
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