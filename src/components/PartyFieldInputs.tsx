/**
 * The shop's own fields on a customer / supplier form (lib/party-fields), and
 * the rows that show their answers in a details dialog.
 *
 * ⚠️ COPIED verbatim to the desktop app.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizePartyValues, type PartyField, type PartyFieldValues } from "@/lib/party-fields";

export function PartyFieldInputs({
  fields, values, onChange,
}: {
  /** Already filtered to this form (fieldsFor). */
  fields: PartyField[];
  values: PartyFieldValues | null | undefined;
  onChange: (next: PartyFieldValues) => void;
}) {
  if (fields.length === 0) return null;
  const v = values ?? {};
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.id} className="space-y-1.5">
          <Label htmlFor={`pf-${f.id}`}>{f.label}</Label>
          <Input
            id={`pf-${f.id}`}
            value={v[f.id] ?? ""}
            maxLength={200}
            onChange={(e) => onChange({ ...v, [f.id]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

/** Details-dialog rows for the answers this party has. */
export function partyFieldRows(fields: PartyField[], values: unknown): { label: string; value: string }[] {
  const v = normalizePartyValues(values);
  return fields.filter((f) => v[f.id]).map((f) => ({ label: f.label, value: v[f.id] }));
}
