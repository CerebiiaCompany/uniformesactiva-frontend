import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Website() {
  return (
    <AppLayout title="Sitio Web" subtitle="Módulo de sitio corporativo">
      <div className="max-w-2xl space-y-6">
        <Card className="animate-fade-in">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Globe className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Sitio Web Corporativo</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Configura tu presencia web con catálogo de productos y formulario de cotización
              que se integra automáticamente al CRM.
            </p>
            <div className="flex gap-3 justify-center">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Configurar sitio
              </Button>
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-1" /> Vista previa
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Solicitudes de cotización web</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Las solicitudes desde el formulario web se crearán automáticamente como leads en el CRM.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
