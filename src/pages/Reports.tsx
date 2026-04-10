import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, FileText, TrendingUp, Factory } from "lucide-react";

const reports = [
  { title: "Reporte de Órdenes", description: "Por estado, cliente y fecha", icon: FileText, count: "6 órdenes activas" },
  { title: "Reporte de Ventas", description: "Ingresos por período y vendedor", icon: TrendingUp, count: "$390K este mes" },
  { title: "Rentabilidad", description: "Márgenes por orden y cliente", icon: BarChart3, count: "27.5% margen prom." },
  { title: "Eficiencia Productiva", description: "Tiempos por etapa y retrasos", icon: Factory, count: "2 retrasos activos" },
];

export default function Reports() {
  return (
    <AppLayout title="Reportes" subtitle="Informes y análisis">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report) => (
          <Card key={report.title} className="hover:shadow-md transition-shadow cursor-pointer animate-fade-in">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <report.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{report.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
                <p className="text-xs font-medium text-primary mt-2">{report.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
