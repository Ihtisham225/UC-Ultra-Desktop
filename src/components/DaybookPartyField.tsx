import { useState } from "react";
import { Check, ChevronsUpDown, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { partyRoleLabel } from "@/lib/handicraft";
import type { PartyOption } from "@/lib/handicraftTypes";

/**
 * Who a Roznamcha line is with.
 *
 * The register is offered first, but a typed name is a perfectly good answer:
 * a daybook is written while the person is still standing at the counter, and
 * forcing them onto the party list before the line can be saved is the surest
 * way to have the line not written at all. A picked party links the line to
 * their khata; a typed one is just a name, and can be linked later by editing.
 */
export function DaybookPartyField({
  partyId,
  partyName,
  onChange,
  parties,
  disabled,
}: {
  partyId: string | null;
  partyName: string;
  onChange: (next: { partyId: string | null; partyName: string }) => void;
  parties: PartyOption[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const typed = search.trim();
  // Offering "use this name" for something already on the register would put
  // two ways to pick the same person in front of the user.
  const showTyped =
    typed.length > 0 && !parties.some((p) => p.name.toLowerCase() === typed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={partyName ? "truncate" : "truncate text-muted-foreground"}>
            {partyName || "Who was it with?"}
          </span>
          {partyName && !partyId && (
            <PenLine className="size-3.5 opacity-50 shrink-0 ms-2" aria-label="Not on the register" />
          )}
          <ChevronsUpDown className="size-4 opacity-50 shrink-0 ms-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-72" align="start">
        <Command filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
          <CommandInput
            placeholder="Search the register, or type a name…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Nobody on the register by that name.</CommandEmpty>
            {showTyped && (
              <CommandGroup heading="Not on the register">
                <CommandItem
                  value={typed}
                  onSelect={() => {
                    onChange({ partyId: null, partyName: typed });
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <PenLine className="size-4 me-2 opacity-70" />
                  Write &ldquo;{typed}&rdquo; as the name
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="On the register">
              {parties.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.city ?? ""}`}
                  onSelect={() => {
                    onChange({ partyId: p.id, partyName: p.name });
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check className={`size-4 me-2 ${partyId === p.id ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate">{p.name}</span>
                  <span className="ms-auto text-xs text-muted-foreground truncate ps-2">
                    {p.city ? `${p.city} · ` : ""}{partyRoleLabel(p)}
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
