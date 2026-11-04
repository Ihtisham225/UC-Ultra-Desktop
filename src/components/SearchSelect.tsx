import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export interface SearchSelectOption {
  id: string;
  label: string;
  /** Indent for a tree (categories); 0 or omitted for a flat list. */
  depth?: number;
}

/**
 * A dropdown you can type into — for lists long enough that scrolling a plain
 * Select to find one is slow (a shop's categories and brands). The first row
 * is always the "none" choice, so Enter-ing past the picker never grabs the
 * first real entry. COPIED verbatim to the desktop.
 */
export function SearchSelect({
  value, onChange, options, noneLabel, searchPlaceholder, disabled, className,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  options: SearchSelectOption[];
  noneLabel: string;
  searchPlaceholder: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value) ?? null;
  // The id keeps two same-named rows apart in cmdk's value; matching is on the
  // name only (keywords), or "cab" would find rows through the hex in their ids.
  const itemValue = (o: SearchSelectOption) => `${o.label} ${o.id}`;
  const filter = (_value: string, search: string, keywords?: string[]) => {
    const hay = (keywords ?? []).join(" ").toLowerCase();
    return search.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w)) ? 1 : 0;
  };
  const pick = (id: string | null) => { onChange(id); setOpen(false); };

  return (
    // `modal`: these sit inside the product dialog, and a non-modal popover
    // there can't be scrolled (the dialog swallows the wheel).
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={`w-full justify-between font-normal ${className ?? ""}`}
        >
          <span className={`truncate ${current ? "" : "text-muted-foreground"}`}>{current?.label ?? noneLabel}</span>
          <ChevronsUpDown className="size-4 opacity-50 shrink-0 ms-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-56" align="start">
        <Command filter={filter} defaultValue={current ? itemValue(current) : `__none ${noneLabel}`}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              <CommandItem value={`__none ${noneLabel}`} keywords={[noneLabel]} onSelect={() => pick(null)}>
                <Check className={`size-4 me-2 ${value ? "opacity-0" : "opacity-100"}`} />
                <span className="text-muted-foreground">{noneLabel}</span>
              </CommandItem>
              {options.map((o) => (
                <CommandItem key={o.id} value={itemValue(o)} keywords={[o.label]} onSelect={() => pick(o.id)}>
                  <Check className={`size-4 me-2 shrink-0 ${value === o.id ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate" style={{ paddingInlineStart: `${(o.depth ?? 0) * 14}px` }}>
                    {(o.depth ?? 0) > 0 ? "↳ " : ""}{o.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
