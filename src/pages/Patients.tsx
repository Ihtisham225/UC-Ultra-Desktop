import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useShop } from "@/contexts/ShopContext";
import { useLocalStore } from "@/hooks/useLocalStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, HeartPulse, Trash2, Search, Edit2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { usePagination } from "@/hooks/usePagination";
import { Pagination } from "@/components/Pagination";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { downloadCsv } from "@/lib/csv";
import { usePageMeta } from "@/hooks/usePageMeta";
import { isLabEnabled } from "@/lib/lab";

interface Patient {
  id: string;
  name: string;
  phone: string | null;
  age: string | null;
  gender: string | null;
  notes: string | null;
}

/**
 * The lab's own register, kept apart from Customers. Offline-first (local sync
 * store) because patients are created at the counter mid-sale, connection or
 * not — the same store the POS PatientPicker writes to.
 */
export default function Patients() {
  usePageMeta({
    title: "Patients — UCU",
    description: "The lab's patient register — name, age, sex and phone.",
    path: "/patients",
  });
  const { currentShop, role } = useShop();
  const [params, setParams] = useSearchParams();
  const { data: items, loading, save: saveLocal, remove: removeLocal } = useLocalStore<Patient>(
    "patients",
    currentShop?.id,
  );
  const [editing, setEditing] = useState<Partial<Patient> | null>(null);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const sel = useRowSelection();

  const canDelete = role === "owner" || role === "manager";

  useEffect(() => {
    const q = params.get("q") ?? "";
    if (q !== search) setSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const { page, pageSize, setPage, setPageSize, visible, totalItems } = usePagination(
    filtered,
    { key: "patients", defaultSize: 20, resetDeps: [search, items.length] },
  );

  const save = async () => {
    if (!editing || !currentShop) return;
    const name = editing.name?.trim() || "";
    if (!name) return toast.error("Name is required");
    try {
      await saveLocal({
        ...editing,
        name,
        phone: editing.phone || null,
        age: editing.age || null,
        gender: editing.gender || null,
        notes: editing.notes || null,
      });
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed to save");
    }
    toast.success("Saved");
    setEditing(null);
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: "Delete patient",
      description: "Past lab reports keep their patient details — only the register entry is removed.",
      variant: "destructive",
    });
    if (!ok) return;
    await removeLocal(id);
  };

  const visibleIds = visible.map((p) => p.id);

  const bulkDelete = async () => {
    if (sel.count === 0) return;
    const ok = await confirm({
      title: "Delete patients",
      description: `Delete ${sel.count} patient(s)? Past lab reports keep their details.`,
      variant: "destructive",
    });
    if (!ok) return;
    for (const id of sel.ids) await removeLocal(id);
    toast.success(`Deleted ${sel.count}`);
    sel.clear();
  };

  const bulkExport = () => {
    const rows = items.filter((p) => sel.has(p.id));
    if (rows.length === 0) return toast.error("Nothing to export");
    downloadCsv(`patients-${new Date().toISOString().slice(0, 10)}`, rows, [
      { header: "Name", value: (r) => r.name },
      { header: "Phone", value: (r) => r.phone ?? "" },
      { header: "Age", value: (r) => r.age ?? "" },
      { header: "Sex", value: (r) => r.gender ?? "" },
      { header: "Notes", value: (r) => r.notes ?? "" },
    ]);
    toast.success(`Exported ${rows.length}`);
  };

  if (!isLabEnabled(currentShop)) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Lab tests are turned off. Enable them in Settings → Shop.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HeartPulse className="size-7 text-primary" /> Patients
          </h1>
          <p className="text-muted-foreground mt-1">{items.length} patient(s) — the lab register, kept apart from customers.</p>
        </div>
        <Button onClick={() => setEditing({ name: "" })} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
          <Plus className="size-4 mr-2" /> Add patient
        </Button>
      </header>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone"
          aria-label="Search patients"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setParams(e.target.value ? { q: e.target.value } : {}, { replace: true }); }}
          className="ps-9"
        />
      </div>

      <BulkActionBar
        selectedCount={sel.count}
        onClear={sel.clear}
        onExport={bulkExport}
        onDelete={canDelete ? bulkDelete : undefined}
        canDelete={canDelete}
      />

      <Card className="shadow-card overflow-hidden">
        {loading ? <div className="p-12 text-center text-muted-foreground">Loading…</div>
        : items.length === 0 ? (
          <div className="p-16 text-center">
            <HeartPulse className="size-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No patients yet — they are added at POS when a lab test is sold.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No patient matches “{search}”.</div>
        ) : (
          <>
            <div className="px-4 py-2 border-b flex items-center gap-3 bg-muted/20">
              <Checkbox
                checked={sel.allChecked(visibleIds) ? true : sel.someChecked(visibleIds) ? "indeterminate" : false}
                onCheckedChange={(v) => sel.setAll(visibleIds, !!v)}
                aria-label="select all"
              />
              <span className="text-xs text-muted-foreground">Select</span>
            </div>
            <ul className="divide-y">
              {visible.map((p) => (
                <li key={p.id} className={`p-4 flex items-center justify-between gap-2 hover:bg-muted/30 ${sel.has(p.id) ? "bg-primary/5" : ""}`}>
                  <Checkbox
                    checked={sel.has(p.id)}
                    onCheckedChange={(v) => sel.toggle(p.id, !!v)}
                    aria-label={`select ${p.name}`}
                  />
                  <button className="flex-1 text-start min-w-0" onClick={() => setEditing(p)}>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[p.phone, [p.age, p.gender].filter(Boolean).join(" / ")].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </button>
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditing(p)}><Edit2 className="size-4" /></Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  )}
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit patient" : "New patient"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Name *</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Age</Label>
                  <Input value={editing.age ?? ""} onChange={(e) => setEditing({ ...editing, age: e.target.value })} placeholder="e.g. 32" /></div>
                <div className="space-y-1.5"><Label>Sex</Label>
                  <Select value={editing.gender || ""} onValueChange={(v) => setEditing({ ...editing, gender: v })}>
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
                <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="03XX-XXXXXXX" inputMode="tel" /></div>
              <div className="space-y-1.5"><Label>Notes</Label>
                <Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
