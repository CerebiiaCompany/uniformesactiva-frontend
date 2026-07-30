import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface ProveedorOption {
  id: string;
  name: string;
}

interface ProveedorComboboxProps {
  value: string;
  proveedores: ProveedorOption[];
  onChange: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function ProveedorCombobox({
  value,
  proveedores,
  onChange,
  placeholder = "Buscar o seleccionar proveedor...",
  disabled = false,
}: ProveedorComboboxProps) {
  const [open, setOpen] = useState(false);

  const sortedProveedores = useMemo(
    () => [...proveedores].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })),
    [proveedores]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between rounded border px-3 py-2 text-sm transition-colors",
            "bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-red-600",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate text-left">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) => {
            const normalizedItem = itemValue.toLocaleLowerCase("es");
            const normalizedSearch = search.trim().toLocaleLowerCase("es");
            if (!normalizedSearch) return 1;
            return normalizedItem.includes(normalizedSearch) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Escribe iniciales para filtrar..." />
          <CommandList>
            <CommandEmpty>
              {sortedProveedores.length === 0
                ? "No hay proveedores. Crea uno con + Proveedor."
                : "Sin coincidencias."}
            </CommandEmpty>
            <CommandGroup>
              {sortedProveedores.map((proveedor) => (
                <CommandItem
                  key={proveedor.id}
                  value={proveedor.name}
                  onSelect={(selected) => {
                    const match =
                      sortedProveedores.find(
                        (p) => p.name.toLocaleLowerCase("es") === selected.toLocaleLowerCase("es")
                      )?.name ?? selected;
                    onChange(match === value ? "" : match);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === proveedor.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {proveedor.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
