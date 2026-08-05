import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Etiqueta corta superior (estilo login: ACCESO). Por defecto no se muestra. */
  eyebrow?: string;
}

export function AppLayout({ children, title, subtitle, eyebrow }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/80 bg-card/90 backdrop-blur-md px-4 shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0 h-8 w-8" />
              <div className="min-w-0 border-l border-border/80 pl-3 leading-tight">
                <div className="flex items-baseline gap-2 min-w-0">
                  {eyebrow ? (
                    <span className="page-eyebrow shrink-0 text-[10px] leading-none">{eyebrow}</span>
                  ) : null}
                  <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">
                    {title}
                  </h2>
                </div>
                {subtitle ? (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{subtitle}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 app-shell-main">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
