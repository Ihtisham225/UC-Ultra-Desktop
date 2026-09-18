import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { flattenLocations, locationPath, type LocationRow } from "@/lib/storage-locations";

/**
 * Pick where something is kept. Takes the places as a prop rather than loading
 * them, so the web (server action) and the terminal (its synced store) feed it
 * from wherever they keep them. Search matches the whole path, so typing "A 3"
 * finds "Rack A › Shelf 3".
 */
export function LocationSelect({
  value, onChange, locations, placeholder = "Not on a shelf", emptyLabel = "Not on a shelf", className,
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  locations: LocationRow[];
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const flat = useMemo(() => flattenLocations(locations), [locations]);
  const label = locationPath(value, locations);

  return (
    // `modal`: used inside the product dialog — see PartySelect for why.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between font-normal ${className ?? ""}`}
        >
          <span className={`flex items-center gap-1.5 truncate ${label ? "" : "text-muted-foreground"}`}>
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{label ?? placeholder}</span>
          </span>
          <ChevronsUpDown className="size-4 opacity-50 shrink-0 ms-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-64" align="start">
        <Command filter={(itemValue, search) => {
          const words = search.toLowerCase().split(/\s+/).filter(Boolean);
          const hay = itemValue.toLowerCase();
          return words.every((w) => hay.includes(w)) ? 1 : 0;
        }}>
          <CommandInput placeholder="Search racks and shelves…" />
          <CommandList>
            <CommandEmpty>
              {locations.length === 0 ? "No shelves yet — add them on the Shelves page." : "No match."}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem value={`__none ${emptyLabel}`} onSelect={() => { onChange(null); setOpen(false); }}>
                <Check className={`size-4 me-2 ${value ? "opacity-0" : "opacity-100"}`} />
                <span className="text-muted-foreground">{emptyLabel}</span>
              </CommandItem>
              {flat.map(({ row, depth }) => (
                <CommandItem
                  key={row.id}
                  value={`${locationPath(row.id, locations, " ")} ${row.id}`}
                  onSelect={() => { onChange(row.id); setOpen(false); }}
                >
                  <Check className={`size-4 me-2 shrink-0 ${value === row.id ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate" style={{ paddingInlineStart: `${depth * 14}px` }}>{row.name}</span>
                  <span className="ms-auto text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{row.kind}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
