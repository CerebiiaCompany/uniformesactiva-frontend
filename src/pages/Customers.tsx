import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, Building2, ShieldAlert, MapPin, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useCreateClient } from "@/hooks/useCreateClient";
import { useGetClients } from "@/hooks/useGetClients";

export default function Customers() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { clients, isLoading: isReading, refetch } = useGetClients();
  const { createClient, isLoading: isCreating, error: apiError } = useCreateClient();

  const [formData, setFormData] = useState({
    nit: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await createClient(formData);

    if (result.success) {
      toast.success("¡Cliente registrado exitosamente!", {
        description: `El cliente ${formData.name} ha sido guardado en la base de datos.`,
      });

      setFormData({ nit: "", name: "", email: "", phone: "", address: "", city: "" });
      setIsModalOpen(false);

      refetch();
    } else {
      toast.error("Error al registrar cliente", {
        description: "Revisa los campos de validación del formulario.",
      });
    }
  };

  return (
    <AppLayout title="Clientes" subtitle="CRM y gestión de clientes">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Nuevo cliente
          </Button>
        </div>

        {isReading ? (
          <div className="flex flex-col items-center justify-center pt-12 space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Sincronizando clientes con el servidor...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 border rounded-xl bg-card border-dashed">
            <p className="text-sm font-medium text-muted-foreground">No hay clientes registrados en la base de datos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((customer) => (
              <Card key={customer.id} className="hover:shadow-md transition-shadow cursor-pointer animate-fade-in">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {customer.name ? customer.name.split(" ").map((n) => n[0]).join("").toUpperCase() : "CL"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate" title={customer.name}>
                        {customer.name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3 flex-shrink-0" /> NIT: {customer.nit}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${customer.status === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                      }`}>
                      {customer.status === "active" ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-4 border-b border-border/50 pb-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                      <Mail className="h-3 w-3 flex-shrink-0" /> {customer.email}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-3 w-3 flex-shrink-0" /> {customer.phone}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                      <MapPin className="h-3 w-3 flex-shrink-0" /> {customer.address}, {customer.city}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Módulo Comercial</span>
                    <span className="font-semibold text-foreground text-[11px]">ID de Sistema</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Registro */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md bg-background p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Registrar Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Introduce la información requerida. El backend aplicará las validaciones estrictas de negocio.
            </DialogDescription>
          </DialogHeader>

          {apiError && (
            <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md flex items-center gap-2 border border-destructive/20 animate-fade-in">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">NIT (Solo números)</label>
              <Input
                name="nit"
                type="text"
                pattern="[0-9]+"
                title="El NIT debe contener únicamente números"
                placeholder="Ej: 901234567"
                required
                disabled={isCreating}
                value={formData.nit}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Nombre / Razón Social</label>
              <Input
                name="name"
                type="text"
                placeholder="Ej: Distribuidora Activa S.A.S."
                required
                disabled={isCreating}
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Correo Electrónico</label>
              <Input
                name="email"
                type="email"
                placeholder="Ej: contacto@empresa.com"
                required
                disabled={isCreating}
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Teléfono</label>
              <Input
                name="phone"
                type="text"
                placeholder="Ej: 3151234567"
                required
                disabled={isCreating}
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Dirección</label>
                <Input
                  name="address"
                  type="text"
                  placeholder="Ej: Calle 10 #4-20"
                  required
                  disabled={isCreating}
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Ciudad</label>
                <Input
                  name="city"
                  type="text"
                  placeholder="Ej: Cúcuta"
                  required
                  disabled={isCreating}
                  value={formData.city}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isCreating}
              >
                {isCreating ? "Guardando..." : "Guardar Cliente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}