/**
 * Settings: the shop's own fields on customers and suppliers (lib/party-fields).
 *
 * `PartyFieldsEditor` (Shop tab) adds, renames, scopes and removes them;
 * `PartyFieldsReceiptSwitches` (Receipt tab) decides which customer fields
 * print on the sale receipt. Both edit the same list the page holds.
 *
 * ⚠️ COPIED verbatim to the desktop app.
 */
import { Plus, Trash2, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAX_PARTY_FIELDS, blankPartyField, type PartyField, type PartyFieldScope } from "@/lib/party-fields";

const SCOPE_LABEL: Record<PartyFieldScope, string> = {
  customer: "Customers",
  supplier: "Suppliers",
  both: "Both",
};

export function PartyFieldsEditor({
  fields, onChange, onSave, busy = false, disabled = false,
}: {
  fields: PartyField[];
  onChange: (next: PartyField[]) => void;
  onSave: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const set = (id: string, patch: Partial<PartyField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  return (
    <Card className="shadow-card p-6 space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2"><ListPlus className="size-4 text-primary" /> Customer &amp; supplier fields</h3>
        <p className="text-sm text-muted-foreground">
          Extra boxes on the customer and supplier forms — CNIC, area, account number, anything you keep.
          A customer field can also print on the receipt (Receipt tab).
        </p>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">No extra fields yet.</p>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_9rem_auto] gap-2 items-center">
              <Input
                value={f.label}
                maxLength={40}
                placeholder="Field name, e.g. CNIC"
                onChange={(e) => set(f.id, { label: e.target.value })}
                disabled={disabled}
                aria-label="Field name"
              />
              <Select
                value={f.applies}
                onValueChange={(v) => set(f.id, { applies: v as PartyFieldScope, on_receipt: v === "supplier" ? false : f.on_receipt })}
                disabled={disabled}
              >
                <SelectTrigger aria-label="Shown on"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCOPE_LABEL) as PartyFieldScope[]).map((s) => (
                    <SelectItem key={s} value={s}>{SCOPE_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button" variant="ghost" size="icon"
                onClick={() => onChange(fields.filter((x) => x.id !== f.id))}
                disabled={disabled}
                title="Remove field"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => onChange([...fields, blankPartyField()])}
            disabled={fields.length >= MAX_PARTY_FIELDS}
          >
            <Plus className="size-4 me-1" /> Add field
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={busy} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            {busy ? "Saving…" : "Save fields"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Removing a field hides it; answers already typed are kept if you add it back.
          </span>
        </div>
      )}
    </Card>
  );
}

export function PartyFieldsReceiptSwitches({
  fields, onChange, disabled = false,
}: {
  fields: PartyField[];
  onChange: (next: PartyField[]) => void;
  disabled?: boolean;
}) {
  const customerFields = fields.filter((f) => f.applies !== "supplier" && f.label.trim());
  return (
    <div className="space-y-2 border-t pt-4">
      <div>
        <Label>Your customer fields</Label>
        <p className="text-xs text-muted-foreground">
          {customerFields.length === 0
            ? "Add your own customer fields under Settings → Shop, then choose here which ones print."
            : "Print these on the receipt when the bill's customer has filled them in."}
        </p>
      </div>
      {customerFields.map((f) => (
        <div key={f.id} className="flex items-center justify-between gap-4 py-1">
          <span className="text-sm">{f.label}</span>
          <Switch
            checked={f.on_receipt}
            onCheckedChange={(v) => onChange(fields.map((x) => (x.id === f.id ? { ...x, on_receipt: v } : x)))}
            disabled={disabled}
            aria-label={`Print ${f.label} on the receipt`}
          />
        </div>
      ))}
    </div>
  );
}
