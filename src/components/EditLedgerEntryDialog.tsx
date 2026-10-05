import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountPicker } from "@/components/AccountPicker";
import { DateInput } from "@/components/DateInput";

/**
 * Correct a khata entry typed with the wrong amount, date, account or note.
 *
 * The server replaces the whole payment (every bill it was spread over) and
 * rebuilds its money line and receipt, so this form only collects the new
 * figures. A copy lives in the desktop app — keep them in step.
 */
export interface EditableLedgerEntry {
  /** Any one settlement of the payment. */
  id: string;
  kind: string;
  amount: number;
  discount: number;
  payment_date: string;
  account_id: string | null;
  notes: string | null;
  /** How many bills the payment was spread over. */
  spread: number;
}

export interface LedgerEntryEdit {
  amount: number;
  discount: number;
  payment_date: string;
  account_id: string | null;
  notes: string | null;
}

type Props = {
  entry: EditableLedgerEntry | null;
  onClose: () => void;
  /** Resolves to an error message, or null when it saved. */
  onSave: (values: LedgerEntryEdit) => Promise<string | null>;
};

export function EditLedgerEntryDialog({ entry, onClose, onSave }: Props) {
  // Keyed by entry, so each opening starts from that entry's own figures.
  return entry ? <EditForm key={entry.id} entry={entry} onClose={onClose} onSave={onSave} /> : null;
}

function EditForm({ entry, onClose, onSave }: Props & { entry: EditableLedgerEntry }) {
  const [amount, setAmount] = useState(String(entry.amount));
  const [discount, setDiscount] = useState(entry.discount > 0 ? String(entry.discount) : "");
  const [date, setDate] = useState(entry.payment_date);
  const [accountId, setAccountId] = useState<string | null>(entry.account_id);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isIncrease = entry.kind === "increase";

  const save = async () => {
    const a = Number(amount || 0);
    const d = isIncrease ? 0 : Number(discount || 0);
    if (!Number.isFinite(a) || a < 0 || !Number.isFinite(d) || d < 0) return setError("Amounts can't be negative.");
    if (isIncrease && a <= 0) return setError("Amount must be greater than 0.");
    if (!isIncrease && a + d <= 0) return setError("Enter an amount, a discount, or both.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Enter a date.");
    setSaving(true);
    setError(null);
    const err = await onSave({
      amount: a,
      discount: d,
      payment_date: date,
      account_id: isIncrease ? null : accountId,
      notes: notes.trim() || null,
    }).catch((e: unknown) => (e instanceof Error ? e.message : "Failed to save"));
    setSaving(false);
    if (err) setError(err);
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isIncrease ? "Edit added debt" : "Edit payment"}</DialogTitle>
          <DialogDescription>
            {isIncrease
              ? "The bill's balance is recalculated from the new amount."
              : "The balance, the money account and the receipt all move to the new figures." +
                (entry.spread > 1 ? ` It is spread over the bills again, oldest first (it covered ${entry.spread}).` : "")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          {!isIncrease && (
            <div className="space-y-1.5">
              <Label>Discount given</Label>
              <Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {!isIncrease && (
          <AccountPicker value={accountId} onChange={setAccountId} label="Money in / out of" autoDefault={false} />
        )}
        <div className="space-y-1.5">
          <Label>Notes (optional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
