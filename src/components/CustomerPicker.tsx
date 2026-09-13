import { useRef, useState } from "react";
import { useLocalStore } from "@/hooks/useLocalStore";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, UserPlus, X, Check, UserX, Plus } from "lucide-react";
import { toast } from "sonner";

export interface CustomerLite { id: string; name: string; phone: string | null; }

const WALK_IN = "__walk_in__";
const ADD_NEW = "__add_new__";
const itemValue = (c: CustomerLite) => `${c.name} ${c.phone ?? ""}`.trim();

export const CustomerPicker = ({
  value,
  onChange,
  step,
  onPicked,
}: {
  value: CustomerLite | null;
  onChange: (c: CustomerLite | null) => void;
  /** Place in the till's Enter-key chain (see lib/checkout-keys). */
  step?: number;
  /** Called once a choice is made and the dropdown has closed — the till moves on. */
  onPicked?: () => void;
}) => {
  const { currentShop } = useShop();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  /**
   * Set when a choice is made, read when the dropdown (or the new-customer
   * form) finishes closing. Advancing there, rather than straight after the
   * choice, is what stops Radix handing focus back to the trigger a moment
   * later and undoing the move.
   */
  const pickedRef = useRef(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  // Offline-first: parties come from the local sync store so the picker works
  // during a sale with no connection. New ones are queued for push.
  //
  // Customers and suppliers are one party table now, so this filters by the
  // role rather than reading a customers-only table — that is what lets a
  // supplier who also buys appear here without a second record.
  const { data: parties, save } = useLocalStore<CustomerLite & { name: string; is_customer?: boolean }>(
    "suppliers",
    currentShop?.id,
  );
  const list = parties.filter((p) => p.is_customer);

  const choose = (c: CustomerLite | null) => {
    onChange(c);
    pickedRef.current = true;
    setOpen(false);
  };

  const openCreate = () => {
    // Whatever they had typed is almost certainly the new customer's name.
    setForm({ name: query.trim(), phone: "" });
    setOpen(false);
    setCreateOpen(true);
  };

  const create = async () => {
    if (!currentShop || !form.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      // is_supplier defaults true server-side, so say it explicitly or every
      // customer added at the till turns up in the supplier picker too.
      const c = await save({
        name: form.name.trim(),
        phone: form.phone || null,
        is_customer: true,
        is_supplier: false,
      } as Parameters<typeof save>[0]);
      toast.success("Customer added");
      onChange({ id: c.id, name: c.name, phone: c.phone ?? null });
      setForm({ name: "", phone: "" });
      pickedRef.current = true;
      setCreateOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  /** Hand the till its next step once whatever was open has closed. */
  const advanceOnClose = (e: Event) => {
    if (!pickedRef.current) return;
    pickedRef.current = false;
    if (onPicked) {
      e.preventDefault();
      onPicked();
    }
  };

  return (
    <>
      <div className="flex gap-2 items-center">
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setQuery(""); }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-start"
              data-checkout-step={step}
              data-checkout-picker={step === undefined ? undefined : ""}
            >
              <User className="size-3.5 mr-1.5" />
              {value ? <span className="truncate">{value.name}</span> : <span className="text-muted-foreground">Walk-in customer</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-72" align="start" onCloseAutoFocus={advanceOnClose}>
            {/* ⚠️ The highlight starts on the CURRENT choice. Otherwise reopening
                the list and pressing Enter would pick whatever sits at the top —
                Walk-in — and silently drop the customer already chosen. */}
            <Command defaultValue={value ? itemValue(value) : WALK_IN}>
              <CommandInput placeholder="Search customers…" value={query} onValueChange={setQuery} />
              <CommandList>
                <CommandEmpty>No customers found</CommandEmpty>
                <CommandGroup>
                  <CommandItem value={WALK_IN} keywords={["walk-in", "walk in", "none"]} onSelect={() => choose(null)}>
                    <UserX className="size-3.5 mr-2 text-muted-foreground" />
                    <span className="text-muted-foreground">Walk-in customer</span>
                  </CommandItem>
                  {[...list].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                    <CommandItem key={c.id} value={itemValue(c)} onSelect={() => choose(c)}>
                      <Check className={"size-3.5 mr-2 " + (value?.id === c.id ? "opacity-100" : "opacity-0")} />
                      <div>
                        <div>{c.name}</div>
                        {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {/* Always reachable by arrow keys, whatever was typed. */}
                <CommandGroup forceMount>
                  <CommandItem value={ADD_NEW} forceMount onSelect={openCreate}>
                    <Plus className="size-3.5 mr-2" />
                    {query.trim() ? <>Add &ldquo;{query.trim()}&rdquo; as a new customer</> : "Add a new customer"}
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value && (
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onChange(null)}>
            <X className="size-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-8" onClick={() => { setQuery(""); openCreate(); }}>
          <UserPlus className="size-3.5" />
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onCloseAutoFocus={advanceOnClose}>
          <DialogHeader><DialogTitle>New customer</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Name</Label>
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); phoneRef.current?.focus(); } }}
              /></div>
            <div className="space-y-1.5"><Label>Phone (with country code, e.g. +92300…)</Label>
              <Input
                ref={phoneRef}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void create(); } }}
                placeholder="+923001234567"
              /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
