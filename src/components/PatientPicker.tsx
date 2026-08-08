import { useState } from "react";
import { useLocalStore } from "@/hooks/useLocalStore";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeartPulse, UserPlus, X, Check } from "lucide-react";
import { toast } from "sonner";

export interface PatientLite {
  id: string;
  name: string;
  phone: string | null;
  age: string | null;
  gender: string | null;
}

/**
 * Patient selector for the lab side of POS. Offline-first like CustomerPicker
 * (patients live in the local sync store), but it reads the separate patient
 * register and captures age/sex here, at order time — the lab shouldn't have
 * to ask for them when the sample is already in the machine.
 */
export const PatientPicker = ({
  value,
  onChange,
}: { value: PatientLite | null; onChange: (p: PatientLite | null) => void }) => {
  const { currentShop } = useShop();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", age: "", gender: "" });
  const [busy, setBusy] = useState(false);
  const { data: list, save } = useLocalStore<PatientLite & { name: string }>(
    "patients",
    currentShop?.id,
  );

  const create = async () => {
    if (!currentShop || !form.name.trim()) return toast.error("Patient name is required");
    setBusy(true);
    try {
      const p = await save({
        name: form.name.trim(),
        phone: form.phone || null,
        age: form.age || null,
        gender: form.gender || null,
      });
      toast.success("Patient added");
      onChange({ id: p.id, name: p.name, phone: p.phone ?? null, age: p.age ?? null, gender: p.gender ?? null });
      setForm({ name: "", phone: "", age: "", gender: "" });
      setCreateOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const summary = value ? [value.age, value.gender, value.phone].filter(Boolean).join(" · ") : "";

  return (
    <>
      <div className="flex gap-2 items-center">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 justify-start h-auto py-1.5">
              <HeartPulse className="size-3.5 mr-1.5 shrink-0" />
              {value ? (
                <span className="truncate text-start">
                  {value.name}
                  {summary && <span className="block text-[10px] font-normal text-muted-foreground">{summary}</span>}
                </span>
              ) : (
                <span className="text-muted-foreground">Select patient</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-72" align="start">
            <Command>
              <CommandInput placeholder="Search patients…" />
              <CommandList>
                <CommandEmpty>No patients found</CommandEmpty>
                <CommandGroup>
                  {[...list].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                    <CommandItem key={p.id} value={p.name + " " + (p.phone ?? "")} onSelect={() => { onChange(p); setOpen(false); }}>
                      <Check className={"size-3.5 mr-2 " + (value?.id === p.id ? "opacity-100" : "opacity-0")} />
                      <div>
                        <div>{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[p.age, p.gender, p.phone].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value && (
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onChange(null)} title="Clear patient">
            <X className="size-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-8" onClick={() => setCreateOpen(true)} title="New patient">
          <UserPlus className="size-3.5" />
        </Button>
      </div>
      {/* The report prints age and sex — flag it here, at the counter, rather
          than leaving the lab to chase the patient later. */}
      {value && (!value.age || !value.gender) && (
        <p className="text-[11px] text-warning mt-1">
          Missing {[!value.age && "age", !value.gender && "sex"].filter(Boolean).join(" and ")} — add it on the Patients page for a complete report.
        </p>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New patient</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Name *</Label>
              <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Age</Label>
                <Input value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="e.g. 32" /></div>
              <div className="space-y-1.5"><Label>Sex</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="03XX-XXXXXXX" inputMode="tel" /></div>
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
