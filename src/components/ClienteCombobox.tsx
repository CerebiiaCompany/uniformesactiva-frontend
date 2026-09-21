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

export interface ClienteOption {
  id: string;
  name: string;
  nit?: string;
  phone?: string;
  email?: string;
  city?: string;
  address?: string;
}

interface ClienteComboboxProps {
  value: string;
  clients: ClienteOption[];
  onValueChange: (clientId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ClienteCombobox({
  value,
  clients,
  onValueChange,
  placeholder = "Selecciona cliente...",
  disabled = false,
  className,
}: ClienteComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" })
    );
  }, [clients]);

  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === value) || null;
  }, [clients, value]);

  const displayLabel = selectedClient
    ? `${selectedClient.name}${selectedClient.nit ? ` — ${selectedClient.nit}` : ""}`
    : "";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors",
            "text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50 hover:bg-muted/20",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate text-left font-normal">
            {displayLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[200] w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0 shadow-lg border-border"
        align="start"
      >
        <Command
          shouldFilter={true}
          filter={(itemValue, searchValue) => {
            const normalizedItem = itemValue.toLocaleLowerCase("es");
            const normalized = searchValue.trim().toLocaleLowerCase("es");
            if (!normalized) return 1;
            return normalizedItem.includes(normalized) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder="Buscar por nombre, NIT o teléfono..."
            value={search}
            onValueChange={setSearch}
            className="h-9 text-xs"
          />
          <CommandList className="max-h-60 overflow-y-auto p-1">
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              No se encontraron clientes.
            </CommandEmpty>
            <CommandGroup>
              {sortedClients.map((client) => {
                const isSelected = client.id === value;
                const filterKeywords = `${client.name} ${client.nit || ""} ${client.phone || ""} ${client.email || ""}`.trim();
                return (
                  <CommandItem
                    key={client.id}
                    value={`${filterKeywords}__id:${client.id}`}
                    onSelect={() => {
                      onValueChange(isSelected ? "" : client.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs rounded-md cursor-pointer hover:bg-muted/70 aria-selected:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">
                        {client.name}
                      </p>
                      {client.nit || client.phone || client.city ? (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[
                            client.nit ? `NIT: ${client.nit}` : null,
                            client.phone ? `Tel: ${client.phone}` : null,
                            client.city,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0 ml-1" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
