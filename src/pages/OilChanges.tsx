import { useEffect, useMemo, useState } from "react";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Car, Trash2, Search, Eye, Edit2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { usePagination } from "@/hooks/usePagination";
import { Pagination } from "@/components/Pagination";
import { useLocalStore } from "@/hooks/useLocalStore";
import { downloadCsv } from "@/lib/csv";
import { format } from "date-fns";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  VehicleFields, blankVehicle, vehicleDraftToInput, type VehicleDraft,
} from "@/components/VehicleFields";
import { isOil, normalizePlate, tidyPlate } from "@/lib/oil";

/** A synced `oil_changes` row as it sits in the local store. */
interface OilChange {
  id: string;
  shop_id: string;
  sale_id: string | null;
  vehicle_number: string;
  vehicle_key?: string;
  make: string | null;
  model_number: string | null;
  current_km: number | string | null;
  next_km: number | string | null;
  oil_changer: string | null;
  visitor_name: string | null;
  phone: string | null;
  notes: string | null;
  serviced_at: string;
  created_at: string;
}

const n = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

const km = (v: number | string | null | undefined) => {
  const x = n(v);
  return x == null ? "—" : `${x.toLocaleString()} km`;
};

const toDraft = (r: OilChange): VehicleDraft => ({
  vehicle_number: r.vehicle_number,
  make: r.make ?? "",
  model_number: r.model_number ?? "",
  current_km: n(r.current_km) == null ? "" : String(n(r.current_km)),
  next_km: n(r.next_km) == null ? "" : String(n(r.next_km)),
  oil_changer: r.oil_changer ?? "",
  visitor_name: r.visitor_name ?? "",
  phone: r.phone ?? "",
  notes: r.notes ?? "",
});

/**
 * The service register, offline-first like the rest of the terminal: rows come
 * from the local store and writes queue for the next sync, so a counter with no
 * connection still takes the car's details.
 *
 * Most rows arrive from the till alongside an oil sale; a change with nothing
 * sold is entered straight here — which is the whole point for a shop whose oil
 * change is free.
 */
export default function OilChanges() {
  usePageMeta({
    title: "Oil Changes — UCU",
    description: "Every vehicle serviced — plate, make, odometer and when it's due back.",
  });
  const { currentShop, role } = useShop();
  const { data: items, loading, save: saveLocal, remove: removeLocal } =
    useLocalStore<OilChange>("oil_changes", currentShop?.id);
  const { data: sales } = useLocalStore<{ id: string; receipt_number: string | null; total: number | string }>(
    "sales", currentShop?.id,
  );
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id?: string; draft: VehicleDraft; date: string } | null>(null);
  const [details, setDetails] = useState<OilChange | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const canDelete = role === "owner" || role === "manager";

  useEffect(() => { document.title = "Oil Changes — UCU"; }, []);

  const saleByIdle = useMemo(() => {
    const m = new Map<string, { receipt_number: string | null; total: number }>();
    for (const s of sales) m.set(s.id, { receipt_number: s.receipt_number, total: Number(s.total) || 0 });
    return m;
  }, [sales]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => (b.serviced_at ?? "").localeCompare(a.serviced_at ?? "")),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    // Plates get typed with and without spaces, so match on both forms.
    const nq = normalizePlate(search);
    return sorted.filter((r) =>
      (nq !== "" && normalizePlate(r.vehicle_number).includes(nq)) ||
      (r.visitor_name ?? "").toLowerCase().includes(q) ||
      (r.phone ?? "").toLowerCase().includes(q) ||
      (r.make ?? "").toLowerCase().includes(q) ||
      (r.model_number ?? "").toLowerCase().includes(q),
    );
  }, [sorted, search]);

  const { page, pageSize, setPage, setPageSize, visible, totalItems } = usePagination(
    filtered,
    { key: "oil-changes", defaultSize: 20, resetDeps: [search, items.length] },
  );

  /** Every previous visit for one plate, newest first. */
  const historyFor = (plate: string) => {
    const nq = normalizePlate(plate);
    return sorted.filter((r) => normalizePlate(r.vehicle_number) === nq);
  };

  const startNew = () => setEditing({
    draft: { ...blankVehicle },
    date: format(new Date(), "yyyy-MM-dd"),
  });

  const startEdit = (r: OilChange) => setEditing({
    id: r.id,
    draft: toDraft(r),
    date: format(new Date(r.serviced_at), "yyyy-MM-dd"),
  });

  /**
   * A returning car fills its own form from the local register — only blank
   * fields, never over something just typed — and last visit's target reading
   * becomes this visit's likely odometer.
   */
  const prefillFromHistory = (plate: string) => {
    if (!editing || editing.id || !plate.trim()) return;
    const prior = historyFor(plate)[0];
    if (!prior) return;
    setEditing((e) => {
      if (!e) return e;
      const d = e.draft;
      const priorNext = n(prior.next_km);
      return {
        ...e,
        draft: {
          ...d,
          make: d.make || (prior.make ?? ""),
          model_number: d.model_number || (prior.model_number ?? ""),
          visitor_name: d.visitor_name || (prior.visitor_name ?? ""),
          phone: d.phone || (prior.phone ?? ""),
          current_km: d.current_km || (priorNext == null ? "" : String(priorNext)),
        },
      };
    });
    toast.info(`Filled from this vehicle's last visit (${format(new Date(prior.serviced_at), "d MMM yyyy")})`);
  };

  const save = async () => {
    if (!editing || !currentShop) return;
    const input = vehicleDraftToInput(editing.draft);
    if (!input.vehicle_number) return toast.error("Vehicle number is required");
    // A next reading below the current one is a typo — usually the odometer
    // typed into the wrong box — and it would make the vehicle look overdue.
    if (input.current_km != null && input.next_km != null && input.next_km < input.current_km) {
      return toast.error("Next KM is lower than the current reading — check the two figures.");
    }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await saveLocal({
        ...(editing.id ? { id: editing.id } : {}),
        shop_id: currentShop.id,
        ...input,
        vehicle_number: tidyPlate(input.vehicle_number),
        // The server's indexed lookup key; NOT NULL, so the push needs it.
        vehicle_key: normalizePlate(input.vehicle_number),
        serviced_at: editing.date ? new Date(`${editing.date}T12:00:00`).toISOString() : now,
        updated_at: now,
        ...(editing.id ? {} : { sale_id: null, created_at: now }),
      } as Partial<OilChange> & { id?: string });
      toast.success(editing.id ? "Oil change updated" : "Oil change recorded");
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: OilChange) => {
    const ok = await confirm({
      title: "Delete this record",
      description: `The service record for ${r.vehicle_number} will be removed. Any sale it was recorded against is not affected.`,
      variant: "destructive",
    });
    if (!ok) return;
    await removeLocal(r.id);
    setDetails(null);
  };

  const exportCsv = () => {
    downloadCsv("oil-changes", filtered, [
      { header: "Date", value: (r) => format(new Date(r.serviced_at), "yyyy-MM-dd") },
      { header: "Vehicle", value: (r) => r.vehicle_number },
      { header: "Make", value: (r) => r.make ?? "" },
      { header: "Model", value: (r) => r.model_number ?? "" },
      { header: "Current KM", value: (r) => n(r.current_km) ?? "" },
      { header: "Next KM", value: (r) => n(r.next_km) ?? "" },
      { header: "Oil changer", value: (r) => r.oil_changer ?? "" },
      { header: "Name", value: (r) => r.visitor_name ?? "" },
      { header: "Phone", value: (r) => r.phone ?? "" },
      { header: "Receipt", value: (r) => (r.sale_id ? saleByIdle.get(r.sale_id)?.receipt_number ?? "" : "") },
      { header: "Notes", value: (r) => r.notes ?? "" },
    ]);
  };

  if (currentShop && !isOil(currentShop)) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        Oil changes are for oil shops. Set the store type to{" "}
        <b>Oil Change / Lubricants</b> in Settings → Shop to use this page.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Car className="size-6 text-primary" /> Oil Changes
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalItems} record{totalItems === 1 ? "" : "s"}{" "}
            — every vehicle serviced, and when it&apos;s due back.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>Export CSV</Button>
          <Button onClick={startNew} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
            <Plus className="size-4 me-1" /> Record oil change
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by plate, name, phone or make"
          className="ps-9"
        />
      </div>

      {loading ? (
        <Card className="p-12 text-center text-muted-foreground">Loading…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          {search
            ? "No vehicle matches that."
            : "No oil changes recorded yet. They're added here, or from the till when oil is sold."}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-start p-3 font-semibold">Vehicle</th>
                  <th className="text-start p-3 font-semibold">Make / model</th>
                  <th className="text-end p-3 font-semibold">Current KM</th>
                  <th className="text-end p-3 font-semibold">Next KM</th>
                  <th className="text-start p-3 font-semibold">Name</th>
                  <th className="text-start p-3 font-semibold">Date</th>
                  <th className="text-end p-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const receipt = r.sale_id ? saleByIdle.get(r.sale_id)?.receipt_number : null;
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-semibold font-mono">{r.vehicle_number}</div>
                        {receipt && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Receipt className="size-3" />{receipt}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {r.make || "—"}
                        {r.model_number && <span className="text-muted-foreground"> · {r.model_number}</span>}
                      </td>
                      <td className="p-3 text-end tabular-nums">{km(r.current_km)}</td>
                      <td className="p-3 text-end tabular-nums">{km(r.next_km)}</td>
                      <td className="p-3">
                        {r.visitor_name || "—"}
                        {r.phone && <div className="text-[11px] text-muted-foreground">{r.phone}</div>}
                      </td>
                      <td className="p-3 whitespace-nowrap">{format(new Date(r.serviced_at), "d MMM yyyy")}</td>
                      <td className="p-3 text-end whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => setDetails(r)} aria-label="View">
                          <Eye className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => startEdit(r)} aria-label="Edit">
                          <Edit2 className="size-4" />
                        </Button>
                        {canDelete && (
                          <Button size="icon" variant="ghost" onClick={() => remove(r)} aria-label="Delete">
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

      {/* Add / edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit oil change" : "Record oil change"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5 max-w-[12rem]">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
              </div>
              <VehicleFields
                value={editing.draft}
                onChange={(draft) => setEditing({ ...editing, draft })}
                onPlateBlur={prefillFromHistory}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details + this vehicle's history */}
      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">{details?.vehicle_number}</DialogTitle>
          </DialogHeader>
          {details && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  { label: "Make", value: details.make || "—" },
                  { label: "Model number", value: details.model_number || "—" },
                  { label: "Current KM", value: km(details.current_km) },
                  { label: "Next KM", value: km(details.next_km) },
                  { label: "Oil changer", value: details.oil_changer || "—" },
                  { label: "Name", value: details.visitor_name || "—" },
                  { label: "Phone", value: details.phone || "—" },
                  { label: "Date", value: format(new Date(details.serviced_at), "PP") },
                ].map((f) => (
                  <div key={f.label}>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{f.label}</div>
                    <div>{f.value}</div>
                  </div>
                ))}
              </div>
              {details.notes && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Notes</div>
                  <p className="text-sm whitespace-pre-wrap">{details.notes}</p>
                </div>
              )}
              <div>
                <div className="text-sm font-semibold mb-2">
                  This vehicle&apos;s visits
                  <Badge variant="secondary" className="ms-2">{historyFor(details.vehicle_number).length}</Badge>
                </div>
                <ul className="space-y-1">
                  {historyFor(details.vehicle_number).map((h) => (
                    <li
                      key={h.id}
                      className={`flex items-center justify-between text-sm rounded-md px-2 py-1.5 ${
                        h.id === details.id ? "bg-muted" : ""
                      }`}
                    >
                      <span>{format(new Date(h.serviced_at), "d MMM yyyy")}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {km(h.current_km)} → {km(h.next_km)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetails(null)}>Close</Button>
            {details && <Button onClick={() => { const d = details; setDetails(null); startEdit(d); }}>Edit</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
