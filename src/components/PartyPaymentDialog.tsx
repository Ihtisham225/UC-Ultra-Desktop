import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AttachmentsField, uploadPendingAttachments } from "@/components/AttachmentsField";
import { rpc } from "@/lib/apiClient";
import type { PartyOption, PartyPaymentDto, PartyPaymentKindValue } from "@/lib/handicraftTypes";

export type PaymentDraft = {
  id: string | null;
  supplier_id: string;
  date: string;
  amount: string;
  method: string;
  reference: string;
  note: string;
};

export const emptyPaymentDraft = (date: string, supplierId = ""): PaymentDraft => ({
  id: null, supplier_id: supplierId, date, amount: "", method: "Cash", reference: "", note: "",
});

export const paymentToDraft = (p: PartyPaymentDto): PaymentDraft => ({
  id: p.id,
  supplier_id: p.supplier_id,
  date: p.date,
  amount: String(p.amount),
  method: p.method,
  reference: p.reference ?? "",
  note: p.note ?? "",
});

const num = (s: string) => (s.trim() === "" ? 0 : Number(s)) || 0;

/**
 * Recording money paid to a party. Shared by the purchase register, making and
 * job work, each passing its own `kind` so the three pages list their own
 * payments — the party's khata still totals all of them.
 */
export function PartyPaymentDialog({
  draft,
  setDraft,
  kind,
  parties,
  partyLabel = "Party",
  methods,
  canEdit,
  onSaved,
}: {
  draft: PaymentDraft | null;
  setDraft: (d: PaymentDraft | null) => void;
  kind: PartyPaymentKindValue;
  parties: PartyOption[];
  partyLabel?: string;
  /** Methods already used, for the autocomplete. */
  methods: string[];
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

  const save = async () => {
    if (!draft) return;
    if (!draft.supplier_id) return toast.error(`Choose the ${partyLabel.toLowerCase()} you paid.`);
    if (num(draft.amount) <= 0) return toast.error("Enter the amount paid.");

    setBusy(true);
    const result = await rpc<{ ok: boolean; error?: string; id?: string }>(
      "savePartyPaymentAction",
      draft.id,
      {
      supplier_id: draft.supplier_id,
      kind,
      date: draft.date,
      amount: num(draft.amount),
      method: draft.method.trim() || "Cash",
      reference: draft.reference || null,
      note: draft.note || null,
      },
    );
    if (result.ok && pendingPhotos.length > 0) {
      try {
        await uploadPendingAttachments("party_payment", result.id, pendingPhotos);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Photos could not be attached");
      }
    }
    setBusy(false);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    toast.success(draft.id ? "Payment updated" : "Payment recorded");
    setPendingPhotos([]);
    setDraft(null);
    onSaved();
  };

  return (
    <Dialog open={!!draft} onOpenChange={(o) => { if (!o) { setPendingPhotos([]); setDraft(null); } }}>
      <DialogContent className="w-[96vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft?.id ? "Edit payment" : "Record payment"}</DialogTitle>
        </DialogHeader>
        {draft && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{partyLabel} *</Label>
              <Select value={draft.supplier_id} onValueChange={(v) => setDraft({ ...draft, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder={`Choose a ${partyLabel.toLowerCase()}`} /></SelectTrigger>
                <SelectContent>
                  {parties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}{p.city ? ` — ${p.city}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input type="number" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Input
                  value={draft.method}
                  onChange={(e) => setDraft({ ...draft, method: e.target.value })}
                  placeholder="Cash / Meezan Bank"
                  list={`payment-methods-${kind}`}
                />
                <datalist id={`payment-methods-${kind}`}>
                  {Array.from(new Set(methods)).map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Reference</Label>
                <Input value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} placeholder="TID 922452" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Account it went to, e.g. Imran Traders A/C" />
            </div>
            <div className="border-t pt-3">
              <AttachmentsField
                entityType="party_payment"
                entityId={draft.id}
                canEdit={canEdit}
                pending={pendingPhotos}
                onPendingChange={setPendingPhotos}
                compact
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { setPendingPhotos([]); setDraft(null); }}>Cancel</Button>
          <Button disabled={busy} onClick={save} className="bg-gradient-primary text-primary-foreground hover:opacity-90">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
