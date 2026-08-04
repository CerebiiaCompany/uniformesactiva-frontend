import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
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
  /** Permite usar un nombre nuevo si no está en el catálogo */
  allowCreate?: boolean;
  /**
   * Si se define, al elegir "Crear «nombre»" se llama para persistir el proveedor
   * en el catálogo y luego se selecciona el nombre devuelto.
   */
  onCreateNew?: (name: string) => Promise<string | void>;
}

export function ProveedorCombobox({
  value,
  proveedores,
  onChange,
  placeholder = "Buscar o seleccionar proveedor...",
  disabled = false,
  allowCreate = false,
  onCreateNew,
}: ProveedorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const sortedProveedores = useMemo(
    () => [...proveedores].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })),
    [proveedores]
  );

  const normalizedSearch = search.trim();
  const exactMatch = useMemo(() => {
    if (!normalizedSearch) return null;
    return (
      sortedProveedores.find(
        (p) => p.name.toLocaleLowerCase("es") === normalizedSearch.toLocaleLowerCase("es")
      ) ?? null
    );
  }, [sortedProveedores, normalizedSearch]);

  const canCreate =
    allowCreate &&
    normalizedSearch.length > 0 &&
    !exactMatch &&
    !creating;

  const selectName = (name: string) => {
    onChange(name === value ? "" : name);
    setOpen(false);
    setSearch("");
  };

  const handleCreate = async () => {
    const name = normalizedSearch;
    if (!name) return;

    if (!onCreateNew) {
      selectName(name);
      return;
    }

    setCreating(true);
    try {
      const created = await onCreateNew(name);
      const finalName = (created || name).trim();
      onChange(finalName);
      setOpen(false);
      setSearch("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (creating) return;
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || creating}
          className={cn(
            "flex w-full items-center justify-between rounded border px-3 py-2 text-sm transition-colors",
            "bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-red-600",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate text-left">
            {creating ? "Creando proveedor..." : value || placeholder}
          </span>
          {creating ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-70" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command
          shouldFilter={true}
          filter={(itemValue, searchValue) => {
            const normalizedItem = itemValue.toLocaleLowerCase("es");
            const normalized = searchValue.trim().toLocaleLowerCase("es");
            if (!normalized) return 1;
            // El item de crear siempre visible cuando aplica
            if (itemValue.startsWith("__create__:")) return 1;
            return normalizedItem.includes(normalized) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder="Escribe iniciales para filtrar..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {allowCreate && normalizedSearch
                ? null
                : sortedProveedores.length === 0
                  ? allowCreate
                    ? "Escribe un nombre para crear el proveedor."
                    : "No hay proveedores. Crea uno con + Proveedor."
                  : "Sin coincidencias."}
            </CommandEmpty>
            {canCreate && (
              <CommandGroup>
                <CommandItem
                  value={`__create__:${normalizedSearch}`}
                  onSelect={() => {
                    void handleCreate();
                  }}
                  className="text-red-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Crear «{normalizedSearch}»
                </CommandItem>
              </CommandGroup>
            )}
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
                    selectName(match);
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
