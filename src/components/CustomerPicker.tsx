import { useState } from "react";
import { useLocalStore } from "@/hooks/useLocalStore";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, UserPlus, X, Check } from "lucide-react";
import { toast } from "sonner";

export interface CustomerLite { id: string; name: string; phone: string | null; }

export const CustomerPicker = ({
  value,
  onChange,
}: { value: CustomerLite | null; onChange: (c: CustomerLite | null) => void }) => {
  const { currentShop } = useShop();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  // Offline-first: customers come from the local sync store so the picker works
  // during a sale with no connection. New customers are queued for push.
  const { data: list, save } = useLocalStore<CustomerLite & { name: string }>(
    "customers",
    currentShop?.id,
  );

  const create = async () => {
    if (!currentShop || !form.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      const c = await save({ name: form.name.trim(), phone: form.phone || null });
      toast.success("Customer added");
      onChange({ id: c.id, name: c.name, phone: c.phone ?? null });
      setForm({ name: "", phone: "" });
      setCreateOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 items-center">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 justify-start">
              <User className="size-3.5 mr-1.5" />
              {value ? <span className="truncate">{value.name}</span> : <span className="text-muted-foreground">Walk-in customer</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-72" align="start">
            <Command>
              <CommandInput placeholder="Search customers…" />
              <CommandList>
                <CommandEmpty>No customers found</CommandEmpty>
                <CommandGroup>
                  {[...list].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                    <CommandItem key={c.id} value={c.name + " " + (c.phone ?? "")} onSelect={() => { onChange(c); setOpen(false); }}>
                      <Check className={"size-3.5 mr-2 " + (value?.id === c.id ? "opacity-100" : "opacity-0")} />
                      <div>
                        <div>{c.name}</div>
                        {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                      </div>
                    </CommandItem>
                  ))}
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
        <Button variant="ghost" size="icon" className="size-8" onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-3.5" />
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New customer</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone (with country code, e.g. +92300…)</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+923001234567" /></div>
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
