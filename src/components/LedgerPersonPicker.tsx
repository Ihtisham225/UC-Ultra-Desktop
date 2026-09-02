import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useShop } from "@/contexts/ShopContext";
import { rpc } from "@/lib/apiClient";

/** Mirror of the server's LedgerPerson — the desktop can't import it. */
export interface LedgerPerson {
  id: string;
  name: string;
  phone: string | null;
  source: "customer" | "party";
  role_label: string;
  /** The raw flags, so the picker can group by what a party actually is. */
  is_customer: boolean;
  is_supplier: boolean;
  is_maker: boolean;
  is_processor: boolean;
}
import { LEDGER_PERSON_TYPES, type LedgerPersonType as PersonType } from "@/lib/handicraft";

/**
 * Who a ledger is kept against. Searches customers and every kind of party in
 * one list — a yarn supplier, a karigar and a walk-in customer all keep khatas
 * — and can add someone on the spot rather than sending the user off to
 * another page mid-entry.
 */
export function LedgerPersonPicker({
  value,
  onChange,
  disabled,
}: {
  value: LedgerPerson | null;
  onChange: (p: LedgerPerson | null) => void;
  disabled?: boolean;
}) {
  const { currentShop } = useShop();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<LedgerPerson[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; phone: string; type: PersonType }>({
    name: "",
    phone: "",
    type: "customer",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!currentShop) return;
    rpc<LedgerPerson[]>("listLedgerPeopleAction")
      .then(setPeople)
      .catch(() => setPeople([]));
  }, [currentShop, createOpen]);

  const groups = useMemo(() => {
    // Grouped by what someone actually is, not by which table they came from —
    // "Customers" and "Parties" stopped meaning anything once the two books
    // merged, and a handicraft shop needs its makers and processing companies
    // visible as their own headings rather than buried in one long list.
    // Each person lands in exactly one group (first match wins) so nobody is
    // listed twice; the full role label still shows on the row.
    const buckets: { heading: string; items: LedgerPerson[] }[] = [
      { heading: "Makers", items: [] },
      { heading: "Processing", items: [] },
      { heading: "Suppliers", items: [] },
      { heading: "Customers", items: [] },
      { heading: "No role set", items: [] },
    ];
    for (const p of people) {
      const i = p.is_maker ? 0 : p.is_processor ? 1 : p.is_supplier ? 2 : p.is_customer ? 3 : 4;
      buckets[i].items.push(p);
    }
    return buckets.filter((g) => g.items.length > 0);
  }, [people]);

  /** Open the create dialog with whatever they'd already typed. */
  const startCreate = () => {
    setForm({ name: search.trim(), phone: "", type: "customer" });
    setOpen(false);
    setCreateOpen(true);
  };

  const create = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setBusy(true);
    const result = await rpc<{ ok: boolean; error?: string; person?: LedgerPerson }>(
      "createLedgerPersonAction",
      { name: form.name.trim(), phone: form.phone || null, type: form.type },
    );
    setBusy(false);
    if (!result.ok || !result.person) return toast.error(result.error ?? "Failed");
    toast.success(`${result.person.name} added`);
    onChange(result.person);
    setCreateOpen(false);
    setSearch("");
  };

  return (
    <>
      <div className="flex gap-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              disabled={disabled}
              className="flex-1 justify-between font-normal"
            >
              <span className="flex items-center gap-2 min-w-0">
                <User className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{value ? value.name : "Search people…"}</span>
                {value && (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {value.role_label}
                  </span>
                )}
              </span>
              <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search customers and parties…" value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>
                  <div className="py-3 text-sm text-muted-foreground">
                    Nobody by that name.
                    <Button type="button" variant="link" className="px-1" onClick={startCreate}>
                      Add them
                    </Button>
                  </div>
                </CommandEmpty>
                {groups.map((g) => (
                  <CommandGroup key={g.heading} heading={g.heading}>
                    {g.items.map((p) => (
                      <CommandItem
                        key={`${p.source}-${p.id}`}
                        // Search should find someone by phone as well as name.
                        value={`${p.name} ${p.phone ?? ""} ${p.role_label}`}
                        onSelect={() => {
                          onChange(p);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={`size-4 mr-2 ${
                            value?.id === p.id && value.source === p.source ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">{p.name}</span>
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {[p.role_label, p.phone].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {value && !disabled && (
          <Button type="button" variant="ghost" size="icon" title="Clear" onClick={() => onChange(null)}>
            <X className="size-4" />
          </Button>
        )}
        {!disabled && (
          <Button type="button" variant="outline" size="icon" title="Add a new person" onClick={startCreate}>
            <Plus className="size-4" />
          </Button>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New person</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>They are a</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as PersonType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEDGER_PERSON_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Customers go in the customer book; the rest go in Parties, so they also turn up in the
                purchase, making and job-work forms.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={create} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              Add person
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
