import { useRef, useState } from "react";
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
  value, onChange, options, placeholder = "Select…", emptyLabel = "None", className, step, onPicked,
}: {
  value: string;
  onChange: (id: string) => void;
  options: PartyOptionLite[];
  placeholder?: string;
  /** Label for the "no party" choice; pass null to make the choice required. */
  emptyLabel?: string | null;
  className?: string;
  /** Place in a screen's Enter chain (lib/checkout-keys); arriving opens the list. */
  step?: number;
  /** Called once a choice is made and the list has closed — the screen moves on. */
  onPicked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pickedRef = useRef(false);
  const choose = (id: string) => {
    pickedRef.current = true;
    onChange(id);
    setOpen(false);
  };
  const selected = options.find((o) => o.id === value);

  return (
    // ⚠️ `modal` matters: this picker is used inside dialogs (the purchase
    // form, the customer challan form). Without it the popover's dismissal
    // escapes to the dialog behind, which reads it as a click outside and
    // closes itself — so choosing a party would shut the form you were
    // filling in.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-checkout-step={step}
          data-checkout-picker={step === undefined ? undefined : ""}
          className={`justify-between font-normal ${className ?? ""}`}
        >
          <span className={selected ? "truncate" : "truncate text-muted-foreground"}>
            {selected ? selected.name : placeholder}
          </span>
          <ChevronsUpDown className="size-4 opacity-50 shrink-0 ms-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width] min-w-64"
        align="start"
        onCloseAutoFocus={(e) => {
          if (!pickedRef.current) return;
          pickedRef.current = false;
          if (onPicked) {
            e.preventDefault();
            onPicked();
          }
        }}
      >
        {/* The highlight starts on the CURRENT choice, so Enter on a reopened
            list keeps it rather than taking whoever is listed first. */}
        <Command
          defaultValue={selected ? `${selected.name} ${selected.phone ?? ""} ${selected.id}` : emptyLabel ?? undefined}
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
                  onSelect={() => choose("")}
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
                  onSelect={() => choose(o.id)}
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
