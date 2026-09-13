import { useEffect, useState } from "react";
import { toast } from "sonner";
import { rpc } from "@/lib/apiClient";
import { AdminPageHeader } from "@/components/admin/AdminUi";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function AdminPlans() {
  return (
    <>
      <AdminPageHeader
        title="Plans"
        description="What a subscription costs and how long it lasts. Changes apply to every shop at once."
      />
      <PlansEditor />
    </>
  );
}

function PlansEditor() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const data = await rpc<any[]>("adminListPlansAction");
      setRows(data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const updateField = (id: string, field: string, value: any) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const save = async (row: any) => {
    setSaving(row.id);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("adminUpdatePlanAction", {
        id: row.id,
        name: row.name,
        price: Number(row.price),
        currency: row.currency,
        duration_days: Number(row.duration_days),
        savings_label: row.savings_label,
        is_active: row.is_active,
        sort_order: Number(row.sort_order),
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(null);
    }
    toast.success("Plan updated");
    load();
  };

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Edit subscription plan prices, durations and labels. Changes take effect immediately for all shops.</p>
      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.id} className="border rounded-lg p-4 bg-card grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <Label className="text-xs">Name</Label>
              <Input value={r.name ?? ""} onChange={(e) => updateField(r.id, "name", e.target.value)} />
              <div className="text-[10px] text-muted-foreground mt-1">Code: {r.code}</div>
            </div>
            <div>
              <Label className="text-xs">Price</Label>
              <Input type="number" value={r.price ?? 0} onChange={(e) => updateField(r.id, "price", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Input value={r.currency ?? "PKR"} onChange={(e) => updateField(r.id, "currency", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Days</Label>
              <Input type="number" value={r.duration_days ?? 30} onChange={(e) => updateField(r.id, "duration_days", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Savings label</Label>
              <Input value={r.savings_label ?? ""} onChange={(e) => updateField(r.id, "savings_label", e.target.value)} placeholder="e.g. SAVE 16%" />
            </div>
            <div className="sm:col-span-6 flex items-center justify-between gap-3 pt-2 border-t">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!r.is_active} onChange={(e) => updateField(r.id, "is_active", e.target.checked)} />
                Active
              </label>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Sort</Label>
                <Input type="number" className="w-20" value={r.sort_order ?? 0} onChange={(e) => updateField(r.id, "sort_order", e.target.value)} />
                <Button size="sm" disabled={saving === r.id} onClick={() => save(r)}>
                  {saving === r.id ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
