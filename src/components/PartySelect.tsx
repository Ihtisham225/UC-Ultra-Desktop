import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

export interface PartyOptionLite { id: string; name: string; phone?: string | null; }

/**
 * A searchable party picker for forms that used to use a plain <Select>.
 *
 * A shop with a few hundred parties turns a plain dropdown into a scroll
 * hunt, so this filters as you type — on the phone number too, which is how
 * the counter usually knows a person apart when two share a name.
 */
export function PartySelect({
  value, onChange, options, placeholder = "Select…", emptyLabel = "None", className,
}: {
  value: string;
  onChange: (id: string) => void;
  options: PartyOptionLite[];
  placeholder?: string;
  /** Label for the "no party" choice; pass null to make the choice required. */
  emptyLabel?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`justify-between font-normal ${className ?? ""}`}
        >
          <span className={selected ? "truncate" : "truncate text-muted-foreground"}>
            {selected ? selected.name : placeholder}
          </span>
          <ChevronsUpDown className="size-4 opacity-50 shrink-0 ms-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-64" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search by name or phone…" />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {emptyLabel !== null && (
                <CommandItem
                  value={emptyLabel}
                  onSelect={() => { onChange(""); setOpen(false); }}
                >
                  <Check className={`size-4 me-2 ${value ? "opacity-0" : "opacity-100"}`} />
                  <span className="text-muted-foreground">{emptyLabel}</span>
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  // cmdk matches on this string, so the phone is searchable too.
                  value={`${o.name} ${o.phone ?? ""} ${o.id}`}
                  onSelect={() => { onChange(o.id); setOpen(false); }}
                >
                  <Check className={`size-4 me-2 ${value === o.id ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate">{o.name}</span>
                  {o.phone && (
                    <span className="ms-auto text-xs text-muted-foreground shrink-0">{o.phone}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
