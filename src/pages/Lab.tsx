import { useCallback, useEffect, useState } from "react";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FlaskConical, Printer, RefreshCw, ClipboardList, Ticket, Pencil } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { LabReportDialog } from "@/components/LabReportDialog";
import { LabTokenDialog } from "@/components/LabTokenDialog";
import { rpc } from "@/lib/apiClient";
import type { LabOrderDto } from "@/lib/labTypes";
import { usePageMeta } from "@/hooks/usePageMeta";
import { isLabEnabled } from "@/lib/lab";

export default function LabClient() {
  usePageMeta({ title: "Lab — UCU", description: "Lab tests waiting for results.", path: "/lab" });
  const { currentShop } = useShop();
  const [orders, setOrders] = useState<LabOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  const [editing, setEditing] = useState<LabOrderDto | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [patient, setPatient] = useState({ name: "", phone: "", age: "", gender: "" });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<LabOrderDto | null>(null);
  const [token, setToken] = useState<LabOrderDto | null>(null);
  // Patient details are captured at the counter when the test is sold; the lab
  // only corrects them if the counter got something wrong.
  const [editPatient, setEditPatient] = useState(false);

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      setOrders(await rpc<LabOrderDto[]>("listLabOrdersAction", tab));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load lab orders");
    }
    setLoading(false);
  }, [currentShop, tab]);

  useEffect(() => { load(); }, [load]);

  const openOrder = (o: LabOrderDto) => {
    setEditing(o);
    setValues(Object.fromEntries(o.results.map((r) => [r.id, r.value ?? ""])));
    setPatient({
      name: o.patient_name ?? "", phone: o.patient_phone ?? "",
      age: o.patient_age ?? "", gender: o.patient_gender ?? "",
    });
    setNotes(o.notes ?? "");
    setEditPatient(false);
  };

  const save = async (thenPrint: boolean) => {
    if (!editing) return;
    setSaving(true);
    try {
      await rpc("updateLabPatientAction", editing.id, {
        patient_name: patient.name, patient_phone: patient.phone,
        patient_age: patient.age, patient_gender: patient.gender,
      });
      const res = await rpc<{ ok: boolean; error?: string }>(
        "saveLabResultsAction",
        editing.id,
        editing.results.map((r) => ({ id: r.id, value: values[r.id] ?? "" })),
        notes,
      );
      if (!res.ok) return toast.error(res.error ?? "Failed to save");
      toast.success("Result saved");
      const updated: LabOrderDto = {
        ...editing,
        patient_name: patient.name || null,
        patient_phone: patient.phone || null,
        patient_age: patient.age || null,
        patient_gender: patient.gender || null,
        notes: notes || null,
        completed_at: new Date().toISOString(),
        results: editing.results.map((r) => ({ ...r, value: values[r.id] ?? null })),
      };
      setEditing(null);
      await load();
      if (thenPrint) setReport(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!isLabEnabled(currentShop)) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Lab tests are turned off. Enable them in Settings → Shop.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FlaskConical className="size-7 text-primary" /> Lab
          </h1>
          <p className="text-muted-foreground mt-1">Tests sold at the counter, waiting for results.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="size-4 me-1" /> Refresh</Button>
      </header>

      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        {(["pending", "completed"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${tab === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {k}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token</TableHead>
              <TableHead>Test</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Ordered</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {tab === "pending" ? "No tests waiting — sell a lab test at POS to see it here." : "No completed tests yet."}
                </TableCell>
              </TableRow>
            ) : orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono font-semibold">{o.token_number}</TableCell>
                <TableCell>{o.test_name}</TableCell>
                <TableCell>
                  {o.patient_name || <span className="text-muted-foreground">Walk-in</span>}
                  {(o.patient_age || o.patient_gender || o.patient_phone) && (
                    <div className="text-xs text-muted-foreground">
                      {[o.patient_age, o.patient_gender, o.patient_phone].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{format(new Date(o.created_at), "MMM d, HH:mm")}</TableCell>
                <TableCell>
                  {o.status === "pending"
                    ? <Badge variant="secondary">Pending</Badge>
                    : <Badge>Completed</Badge>}
                </TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setToken(o)} title="Print token slip">
                      <Ticket className="size-4" />
                    </Button>
                    <Button size="sm" variant={o.status === "pending" ? "default" : "outline"} onClick={() => openOrder(o)}>
                      <ClipboardList className="size-4 me-1" />
                      {o.status === "pending" ? "Enter result" : "Edit"}
                    </Button>
                    {o.status === "completed" && (
                      <Button size="sm" variant="outline" onClick={() => setReport(o)}>
                        <Printer className="size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Result entry — factors are pre-filled, staff only types values. */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.test_name} · <span className="font-mono">{editing?.token_number}</span>
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              {editPatient ? (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Patient name</Label>
                      <Input value={patient.name} onChange={(e) => setPatient({ ...patient, name: e.target.value })} placeholder="Full name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Age</Label>
                      <Input value={patient.age} onChange={(e) => setPatient({ ...patient, age: e.target.value })} placeholder="e.g. 32" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Sex</Label>
                      <Input value={patient.gender} onChange={(e) => setPatient({ ...patient, gender: e.target.value })} placeholder="M / F" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={patient.phone} onChange={(e) => setPatient({ ...patient, phone: e.target.value })} placeholder="03XX-XXXXXXX" inputMode="tel" />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/30 p-3 flex items-start justify-between gap-3">
                  <div className="text-sm space-y-0.5 min-w-0">
                    <div className="font-semibold">{patient.name || "Walk-in patient"}</div>
                    <div className="text-muted-foreground text-xs">
                      {[patient.age && `Age ${patient.age}`, patient.gender, patient.phone].filter(Boolean).join(" · ") || "No details taken at the counter"}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditPatient(true)}>
                    <Pencil className="size-3.5 me-1" /> Correct
                  </Button>
                </div>
              )}

              {editing.results.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  This test has no factors defined, so there is nothing to fill in. Add them on the
                  product (Products → this test → Lab test factors) and future orders will carry them;
                  this one can still be closed with a note.
                </div>
              )}

              <div className={`border rounded-lg divide-y ${editing.results.length === 0 ? "hidden" : ""}`}>
                <div className="hidden sm:grid grid-cols-[1fr_9rem_6rem_9rem] gap-2 px-3 py-2 text-xs text-muted-foreground bg-muted/40">
                  <span>Factor</span><span>Result</span><span>Unit</span><span>Normal range</span>
                </div>
                {editing.results.map((r) => (
                  <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_6rem_9rem] gap-2 items-center px-3 py-2">
                    <div className="font-medium text-sm">{r.name}</div>
                    <Input
                      value={values[r.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
                      placeholder="Value"
                      className="h-9"
                    />
                    <div className="text-xs text-muted-foreground">{r.unit || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.normal_range || "—"}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any remarks printed on the report" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button onClick={() => save(true)} disabled={saving}>
              <Printer className="size-4 me-1" /> Save &amp; print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LabReportDialog order={report} onClose={() => setReport(null)} />
      <LabTokenDialog orders={token ? [token] : null} onClose={() => setToken(null)} />
    </div>
  );
}
