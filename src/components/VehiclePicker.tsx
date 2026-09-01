import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { useShop } from "@/contexts/ShopContext";
import { useLocalStore } from "@/hooks/useLocalStore";
import { normalizePlate, tidyPlate } from "@/lib/oil";

export interface VehicleLite {
  id: string;
  vehicle_number: string;
  make: string | null;
  model_number: string | null;
}

/** A synced `vehicles` row as it sits in the local store. */
export interface LocalVehicle {
  id: string;
  shop_id: string;
  vehicle_number: string;
  vehicle_key: string;
  make: string | null;
  model_number: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

const describe = (v: { make: string | null; model_number: string | null }) =>
  [v.make, v.model_number].filter(Boolean).join(" ") || "No make recorded";

/**
 * Pick the car at the till: a searchable list of everything registered, plus a
 * way to register one that isn't.
 *
 * Reads and writes the LOCAL store, so it keeps working with no connection —
 * the register is synced like customers are. Plates are matched on their
 * normalized form, so "lea 07 1234" finds "LEA-07-1234".
 */
export function VehiclePicker({
  value,
  onChange,
}: {
  value: VehicleLite | null;
  onChange: (v: VehicleLite | null) => void;
}) {
  const { currentShop } = useShop();
  const { data: vehicles, save } = useLocalStore<LocalVehicle>("vehicles", currentShop?.id);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ vehicle_number: "", make: "", model_number: "" });
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const q = search.trim();
    const sorted = [...vehicles].sort((a, b) => a.vehicle_number.localeCompare(b.vehicle_number));
    if (!q) return sorted.slice(0, 50);
    const key = normalizePlate(q);
    const lq = q.toLowerCase();
    return sorted
      .filter(
        (v) =>
          (key !== "" && normalizePlate(v.vehicle_number).includes(key)) ||
          (v.make ?? "").toLowerCase().includes(lq) ||
          (v.model_number ?? "").toLowerCase().includes(lq),
      )
      .slice(0, 50);
  }, [vehicles, search]);

  const create = async () => {
    const plate = form.vehicle_number.trim();
    if (!plate) return toast.error("Vehicle number is required");
    const key = normalizePlate(plate);
    if (!key) return toast.error("That doesn't look like a registration number.");
    // One car, one row — the server has a unique index, and the counter should
    // be told which car they already have rather than being handed a clash.
    const clash = vehicles.find((v) => normalizePlate(v.vehicle_number) === key);
    if (clash) return toast.error(`${clash.vehicle_number} is already registered.`);

    setBusy(true);
    try {
      const now = new Date().toISOString();
      const row = await save({
        id: uuid(),
        shop_id: currentShop!.id,
        vehicle_number: tidyPlate(plate),
        vehicle_key: key,
        make: form.make.trim() || null,
        model_number: form.model_number.trim() || null,
        updated_at: now,
        created_at: now,
      } as Partial<LocalVehicle> & { id: string });
      toast.success(`${row.vehicle_number} registered`);
      onChange({
        id: row.id,
        vehicle_number: row.vehicle_number,
        make: row.make,
        model_number: row.model_number,
      });
      setForm({ vehicle_number: "", make: "", model_number: "" });
      setCreateOpen(false);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 items-center">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 justify-start min-w-0">
              <Car className="size-3.5 me-1.5 shrink-0" />
              {value ? (
                <span className="truncate font-mono">{value.vehicle_number}</span>
              ) : (
                <span className="text-muted-foreground">Select vehicle</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-80" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search by plate, make or model…"
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>No vehicle found. Register it below.</CommandEmpty>
                <CommandGroup>
                  {matches.map((v) => (
                    <CommandItem
                      key={v.id}
                      value={v.id}
                      onSelect={() => {
                        onChange({
                          id: v.id,
                          vehicle_number: v.vehicle_number,
                          make: v.make,
                          model_number: v.model_number,
                        });
                        setOpen(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-mono font-medium truncate">{v.vehicle_number}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{describe(v)}</div>
                      </div>
                      {value?.id === v.id && <Check className="size-4 shrink-0" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
              <div className="border-t p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    // Whatever they typed is almost certainly the plate.
                    setForm({ vehicle_number: search.trim(), make: "", model_number: "" });
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="size-3.5 me-1.5" /> Register a new vehicle
                </Button>
              </div>
            </Command>
          </PopoverContent>
        </Popover>

        {value ? (
          <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Clear vehicle" onClick={() => onChange(null)}>
            <X className="size-4" />
          </Button>
        ) : (
          <Button
            variant="outline" size="icon" className="size-8 shrink-0"
            aria-label="Register a new vehicle"
            onClick={() => { setForm({ vehicle_number: "", make: "", model_number: "" }); setCreateOpen(true); }}
          >
            <Plus className="size-4" />
          </Button>
        )}
      </div>

      {value && <p className="text-[11px] text-muted-foreground mt-1">{describe(value)}</p>}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Register a vehicle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Vehicle number *</Label>
              <Input
                autoFocus
                value={form.vehicle_number}
                onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                placeholder="LEA 07-1234"
                className="uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Make</Label>
              <Input
                value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
                placeholder="Vitz, Swift, Corolla"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input
                value={form.model_number}
                onChange={(e) => setForm({ ...form, model_number: e.target.value })}
                placeholder="GLi 1.3 / 2018"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy}>{busy ? "Saving…" : "Register"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
