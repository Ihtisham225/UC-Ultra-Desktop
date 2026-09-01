import { useMemo, useState } from "react";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { useConfirm } from "@/components/ConfirmDialog";
import { usePagination } from "@/hooks/usePagination";
import { Pagination } from "@/components/Pagination";
import { useLocalStore } from "@/hooks/useLocalStore";
import { downloadCsv } from "@/lib/csv";
import { format } from "date-fns";
import { normalizePlate, tidyPlate } from "@/lib/oil";
import type { LocalVehicle } from "@/components/VehiclePicker";

type Draft = { id?: string; vehicle_number: string; make: string; model_number: string; notes: string };
const blank: Draft = { vehicle_number: "", make: "", model_number: "", notes: "" };

interface LocalVisit {
  id: string;
  vehicle_id?: string | null;
  vehicle_key?: string | null;
  serviced_at: string;
  next_km?: number | string | null;
}

/**
 * The register of cars the shop knows. Local-first like the rest of the
 * terminal — the whole register is synced, so it lists, searches and registers
 * with no connection.
 */
export default function VehiclesTab({ onSearchVisits }: { onSearchVisits: (plate: string) => void }) {
  const { currentShop, role } = useShop();
  const { data: vehicles, save, remove } = useLocalStore<LocalVehicle>("vehicles", currentShop?.id);
  const { data: visits } = useLocalStore<LocalVisit>("oil_changes", currentShop?.id);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const canDelete = role === "owner" || role === "manager";

  // Visits per car, and the most recent one, straight off the local ledger.
  const stats = useMemo(() => {
    const m = new Map<string, { count: number; last: LocalVisit | null }>();
    for (const v of visits) {
      const id = v.vehicle_id;
      if (!id) continue;
      const cur = m.get(id) ?? { count: 0, last: null };
      cur.count++;
      if (!cur.last || (v.serviced_at ?? "") > (cur.last.serviced_at ?? "")) cur.last = v;
      m.set(id, cur);
    }
    return m;
  }, [visits]);

  const filtered = useMemo(() => {
    const sorted = [...vehicles].sort((a, b) => a.vehicle_number.localeCompare(b.vehicle_number));
    const q = search.trim();
    if (!q) return sorted;
    const key = normalizePlate(q);
    const lq = q.toLowerCase();
    return sorted.filter(
      (v) =>
        (key !== "" && normalizePlate(v.vehicle_number).includes(key)) ||
        (v.make ?? "").toLowerCase().includes(lq) ||
        (v.model_number ?? "").toLowerCase().includes(lq),
    );
  }, [vehicles, search]);

  const { page, pageSize, setPage, setPageSize, visible, totalItems } = usePagination(
    filtered,
    { key: "vehicles", defaultSize: 20, resetDeps: [search, vehicles.length] },
  );

  const num = (v: number | string | null | undefined) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const saveVehicle = async () => {
    if (!editing || !currentShop) return;
    const plate = editing.vehicle_number.trim();
    if (!plate) return toast.error("Vehicle number is required");
    const key = normalizePlate(plate);
    if (!key) return toast.error("That doesn't look like a registration number.");
    const clash = vehicles.find((v) => normalizePlate(v.vehicle_number) === key && v.id !== editing.id);
    if (clash) return toast.error(`${clash.vehicle_number} is already registered.`);

    setBusy(true);
    try {
      const now = new Date().toISOString();
      await save({
        ...(editing.id ? { id: editing.id } : { id: uuid(), created_at: now }),
        shop_id: currentShop.id,
        vehicle_number: tidyPlate(plate),
        vehicle_key: key,
        make: editing.make.trim() || null,
        model_number: editing.model_number.trim() || null,
        notes: editing.notes.trim() || null,
        updated_at: now,
      } as Partial<LocalVehicle> & { id: string });
      toast.success(editing.id ? "Vehicle updated" : "Vehicle registered");
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  const removeVehicle = async (v: LocalVehicle) => {
    const count = stats.get(v.id)?.count ?? 0;
    const ok = await confirm({
      title: `Remove ${v.vehicle_number}`,
      description:
        count > 0
          ? `This car has ${count} service record${count === 1 ? "" : "s"}. Those stay — they keep their own copy of the plate, make and model. Only the register entry is removed.`
          : "The car is removed from the register.",
      variant: "destructive",
    });
    if (!ok) return;
    await remove(v.id);
  };

  const exportCsv = () => {
    downloadCsv("vehicles", filtered, [
      { header: "Vehicle", value: (v) => v.vehicle_number },
      { header: "Make", value: (v) => v.make ?? "" },
      { header: "Model", value: (v) => v.model_number ?? "" },
      { header: "Visits", value: (v) => stats.get(v.id)?.count ?? 0 },
      { header: "Last serviced", value: (v) => { const l = stats.get(v.id)?.last; return l ? format(new Date(l.serviced_at), "yyyy-MM-dd") : ""; } },
      { header: "Due at KM", value: (v) => num(stats.get(v.id)?.last?.next_km) ?? "" },
      { header: "Notes", value: (v) => v.notes ?? "" },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {totalItems} vehicle{totalItems === 1 ? "" : "s"} registered — picked by name at the till.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>Export CSV</Button>
          <Button onClick={() => setEditing({ ...blank })} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
            <Plus className="size-4 me-1" /> Register vehicle
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by plate, make or model"
          className="ps-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          {search ? "No vehicle matches that." : "No vehicles registered yet."}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-start p-3 font-semibold">Vehicle</th>
                  <th className="text-start p-3 font-semibold">Make</th>
                  <th className="text-start p-3 font-semibold">Model</th>
                  <th className="text-end p-3 font-semibold">Visits</th>
                  <th className="text-start p-3 font-semibold">Last serviced</th>
                  <th className="text-end p-3 font-semibold">Due at</th>
                  <th className="text-end p-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {visible.map((v) => {
                  const st = stats.get(v.id);
                  const due = num(st?.last?.next_km);
                  return (
                    <tr key={v.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-semibold font-mono">{v.vehicle_number}</td>
                      <td className="p-3">{v.make || "—"}</td>
                      <td className="p-3">{v.model_number || "—"}</td>
                      <td className="p-3 text-end tabular-nums">
                        {st?.count ? (
                          <button
                            type="button"
                            className="underline underline-offset-2 hover:text-primary"
                            onClick={() => onSearchVisits(v.vehicle_number)}
                          >
                            {st.count}
                          </button>
                        ) : "—"}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {st?.last ? format(new Date(st.last.serviced_at), "d MMM yyyy") : "—"}
                      </td>
                      <td className="p-3 text-end tabular-nums">
                        {due == null ? "—" : `${due.toLocaleString()} km`}
                      </td>
                      <td className="p-3 text-end whitespace-nowrap">
                        <Button
                          size="icon" variant="ghost" aria-label="Edit"
                          onClick={() => setEditing({
                            id: v.id,
                            vehicle_number: v.vehicle_number,
                            make: v.make ?? "",
                            model_number: v.model_number ?? "",
                            notes: v.notes ?? "",
                          })}
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        {canDelete && (
                          <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => removeVehicle(v)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page} pageSize={pageSize} totalItems={totalItems}
            onPageChange={setPage} onPageSizeChange={setPageSize}
          />
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit vehicle" : "Register vehicle"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Vehicle number *</Label>
                <Input
                  autoFocus
                  value={editing.vehicle_number}
                  onChange={(e) => setEditing({ ...editing, vehicle_number: e.target.value })}
                  placeholder="LEA 07-1234"
                  className="uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Make</Label>
                  <Input
                    value={editing.make}
                    onChange={(e) => setEditing({ ...editing, make: e.target.value })}
                    placeholder="Vitz, Swift, Corolla"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Model</Label>
                  <Input
                    value={editing.model_number}
                    onChange={(e) => setEditing({ ...editing, model_number: e.target.value })}
                    placeholder="GLi 1.3 / 2018"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Anything worth remembering about this car"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveVehicle} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
