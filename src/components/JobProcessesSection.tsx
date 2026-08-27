import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Archive, ArrowUp, ArrowDown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { useShop } from "@/contexts/ShopContext";
import { rpc } from "@/lib/apiClient";
import type { JobProcessDto } from "@/lib/handicraftTypes";

type Draft = { id: string | null; name: string; name_local: string; default_rate: string; is_archived: boolean };

const emptyDraft = (): Draft => ({ id: null, name: "", name_local: "", default_rate: "0", is_archived: false });

/**
 * The work a processing factory does — bumbul, rangai, dhulai, press. The list
 * drives the tick columns on a sent challan and the charge lines on a received
 * bill, so it has to be the shop's own: they rename them, add their own, and
 * set the per-piece rate they normally pay.
 */
export function JobProcessesSection({ canEdit }: { canEdit: boolean }) {
  const { currentShop } = useShop();
  const [items, setItems] = useState<JobProcessDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      setItems(await rpc<JobProcessDto[]>("listJobProcessesAction", { includeArchived: true }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load processes");
    }
    setLoading(false);
  }, [currentShop]);

  useEffect(() => { load(); }, [load]);

  const visible = showArchived ? items : items.filter((p) => !p.is_archived);

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return toast.error("Name is required.");
    setBusy(true);
    const result = await rpc<{ ok: boolean; error?: string }>("saveJobProcessAction", editing.id, {
      name,
      name_local: editing.name_local.trim() || null,
      default_rate: parseFloat(editing.default_rate) || 0,
      is_archived: editing.is_archived,
    });
    setBusy(false);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    toast.success("Saved");
    setEditing(null);
    load();
  };

  const remove = async (p: JobProcessDto) => {
    const ok = await confirm({
      title: `Remove “${p.name}”?`,
      description:
        "It disappears from new challans. If it has already been used on one, it's kept as archived so old bills still print correctly.",
      variant: "destructive",
    });
    if (!ok) return;
    const result = await rpc<{ ok: boolean; error?: string; archived?: boolean }>("deleteJobProcessAction", p.id);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    toast.success(result.archived ? `“${p.name}” archived — it's used on existing bills.` : "Removed");
    load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    const result = await rpc<{ ok: boolean; error?: string }>("reorderJobProcessesAction", next.map((p) => p.id));
    if (!result.ok) { toast.error(result.error ?? "Failed"); load(); }
  };

  return (
    <Card className="shadow-card p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label className="text-base flex items-center gap-2"><Layers className="size-4 text-primary" /> Processing work</Label>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            The work you send goods out for. Each one becomes a tick column on the sent challan and a
            charge line on the received bill. The Urdu name is what prints on the challan, and the rate
            is per piece — you can still change it on any bill.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setEditing(emptyDraft())} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Plus className="size-4 mr-1.5" /> Add process
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No processes yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {visible.map((p) => {
            const index = items.findIndex((i) => i.id === p.id);
            return (
              <li key={p.id} className={`flex items-center gap-2 p-3 ${p.is_archived ? "opacity-60" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {p.name}
                    {p.name_local && <span className="text-muted-foreground font-normal" dir="rtl">{p.name_local}</span>}
                    {p.is_archived && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold">Archived</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.default_rate > 0 ? `${p.default_rate} per piece` : "No default rate"}
                  </div>
                </div>
                {canEdit && (
                  <>
                    <Button variant="ghost" size="icon" title="Move up" disabled={index <= 0} onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
                    <Button variant="ghost" size="icon" title="Move down" disabled={index >= items.length - 1} onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditing({
                      id: p.id, name: p.name, name_local: p.name_local ?? "",
                      default_rate: String(p.default_rate), is_archived: p.is_archived,
                    })}><Edit2 className="size-4" /></Button>
                    <Button variant="ghost" size="icon" title="Remove" onClick={() => remove(p)}>
                      {p.is_archived ? <Archive className="size-4 text-muted-foreground" /> : <Trash2 className="size-4 text-destructive" />}
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items.some((p) => p.is_archived) && (
        <div className="flex items-center justify-between gap-4 pt-1">
          <div>
            <Label className="text-sm">Show archived</Label>
            <p className="text-xs text-muted-foreground">Processes kept only so old bills print correctly.</p>
          </div>
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit process" : "New process"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Rangai (dyeing)" />
              </div>
              <div className="space-y-1.5">
                <Label>Name on the printed challan</Label>
                <Input dir="rtl" value={editing.name_local} onChange={(e) => setEditing({ ...editing, name_local: e.target.value })} placeholder="رنگائی" />
                <p className="text-[11px] text-muted-foreground">Leave empty to print the name above.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Default rate per piece</Label>
                <Input type="number" step="0.01" min="0" value={editing.default_rate} onChange={(e) => setEditing({ ...editing, default_rate: e.target.value })} />
                <p className="text-[11px] text-muted-foreground">Used when a company has no rate of its own.</p>
              </div>
              {editing.id && (
                <div className="flex items-center justify-between gap-4 border-t pt-3">
                  <div><Label>Archived</Label><p className="text-xs text-muted-foreground">Hidden from new challans.</p></div>
                  <Switch checked={editing.is_archived} onCheckedChange={(v) => setEditing({ ...editing, is_archived: v })} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={busy} onClick={save} className="bg-gradient-primary text-primary-foreground hover:opacity-90">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </Card>
  );
}
