import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, FlaskConical } from "lucide-react";

export interface LabParameterDraft {
  name: string;
  unit?: string | null;
  normal_range?: string | null;
}

interface Props {
  value: LabParameterDraft[];
  onChange: (next: LabParameterDraft[]) => void;
}

/** A few common panels so a shop doesn't type every factor by hand. */
const PRESETS: { label: string; params: LabParameterDraft[] }[] = [
  {
    label: "CBC",
    params: [
      { name: "Haemoglobin", unit: "g/dL", normal_range: "13.5 – 17.5" },
      { name: "WBC", unit: "10³/µL", normal_range: "4.0 – 11.0" },
      { name: "RBC", unit: "10⁶/µL", normal_range: "4.5 – 5.9" },
      { name: "Platelets", unit: "10³/µL", normal_range: "150 – 450" },
      { name: "Haematocrit", unit: "%", normal_range: "38 – 50" },
    ],
  },
  {
    label: "Urine R/E",
    params: [
      { name: "Colour", unit: null, normal_range: "Pale yellow" },
      { name: "Appearance", unit: null, normal_range: "Clear" },
      { name: "pH", unit: null, normal_range: "4.6 – 8.0" },
      { name: "Protein", unit: null, normal_range: "Nil" },
      { name: "Glucose", unit: null, normal_range: "Nil" },
      { name: "Pus cells", unit: "/HPF", normal_range: "0 – 5" },
    ],
  },
  {
    label: "Lipid profile",
    params: [
      { name: "Total cholesterol", unit: "mg/dL", normal_range: "< 200" },
      { name: "Triglycerides", unit: "mg/dL", normal_range: "< 150" },
      { name: "HDL", unit: "mg/dL", normal_range: "> 40" },
      { name: "LDL", unit: "mg/dL", normal_range: "< 100" },
    ],
  },
  {
    label: "Blood sugar",
    params: [
      { name: "Fasting glucose", unit: "mg/dL", normal_range: "70 – 100" },
      { name: "Random glucose", unit: "mg/dL", normal_range: "< 140" },
    ],
  },
];

/**
 * Defines the factors a lab test measures. These are copied onto every order
 * of the test, so the lab staff only types the values.
 */
export function LabParametersBuilder({ value, onChange }: Props) {
  const add = () => onChange([...value, { name: "", unit: "", normal_range: "" }]);
  const update = (i: number, patch: Partial<LabParameterDraft>) =>
    onChange(value.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FlaskConical className="size-4 text-primary" /> Test factors
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange([...value, ...p.params])}
            >
              + {p.label}
            </Button>
          ))}
        </div>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add the factors this test measures (e.g. Haemoglobin, WBC). The lab staff will only fill in the values.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1fr_7rem_9rem_2.25rem] gap-2 text-xs text-muted-foreground px-1">
            <span>Factor</span><span>Unit</span><span>Normal range</span><span />
          </div>
          {value.map((p, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_7rem_9rem_2.25rem] gap-2">
              <div className="space-y-1">
                <Label className="sm:hidden text-xs">Factor</Label>
                <Input value={p.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="e.g. Haemoglobin" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs">Unit</Label>
                <Input value={p.unit ?? ""} onChange={(e) => update(i, { unit: e.target.value })} placeholder="g/dL" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs">Normal range</Label>
                <Input value={p.normal_range ?? ""} onChange={(e) => update(i, { normal_range: e.target.value })} placeholder="13.5 – 17.5" className="h-9 text-sm" />
              </div>
              <Button type="button" variant="ghost" size="icon" className="size-9 text-destructive self-end" onClick={() => remove(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-4 mr-1" /> Add factor
      </Button>
    </div>
  );
}
