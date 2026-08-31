import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * The vehicle details an oil shop writes down at every visit. Held as strings
 * because that's what the counter types — a half-entered "12" on its way to
 * "125400" is a normal state, and coercing mid-keystroke fights the user. The
 * caller parses on save.
 */
export interface VehicleDraft {
  vehicle_number: string;
  make: string;
  model_number: string;
  current_km: string;
  next_km: string;
  oil_changer: string;
  visitor_name: string;
  phone: string;
  notes: string;
}

export const blankVehicle: VehicleDraft = {
  vehicle_number: "",
  make: "",
  model_number: "",
  current_km: "",
  next_km: "",
  oil_changer: "",
  visitor_name: "",
  phone: "",
  notes: "",
};

interface Props {
  value: VehicleDraft;
  onChange: (next: VehicleDraft) => void;
  /** Fired when the plate field is left, so the caller can pull up its history. */
  onPlateBlur?: (plate: string) => void;
  /** Tightens the layout for the POS side panel. */
  compact?: boolean;
  disabled?: boolean;
}

export function VehicleFields({ value, onChange, onPlateBlur, compact = false, disabled }: Props) {
  const set = (patch: Partial<VehicleDraft>) => onChange({ ...value, ...patch });
  const cols = compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2";

  // The reading the oil is good until has to be ahead of today's. Shown as a
  // hint rather than blocked while typing — "12" on the way to "125400" is
  // briefly below, and an error flashing on every keystroke is noise.
  const cur = parseFloat(value.current_km);
  const nxt = parseFloat(value.next_km);
  const kmBackwards = Number.isFinite(cur) && Number.isFinite(nxt) && nxt < cur;

  return (
    <div className="space-y-3">
      <div className={`grid ${cols} gap-3`}>
        <div className="space-y-1.5">
          <Label>Vehicle number *</Label>
          <Input
            value={value.vehicle_number}
            onChange={(e) => set({ vehicle_number: e.target.value })}
            onBlur={() => onPlateBlur?.(value.vehicle_number)}
            placeholder="LEA 07-1234"
            className="uppercase"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Make</Label>
          <Input
            value={value.make}
            onChange={(e) => set({ make: e.target.value })}
            placeholder="Vitz, Swift, Corolla"
            disabled={disabled}
          />
        </div>
      </div>

      <div className={`grid ${cols} gap-3`}>
        <div className="space-y-1.5">
          <Label>Model number</Label>
          <Input
            value={value.model_number}
            onChange={(e) => set({ model_number: e.target.value })}
            placeholder="GLi 1.3 / 2018"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Oil changer</Label>
          <Input
            value={value.oil_changer}
            onChange={(e) => set({ oil_changer: e.target.value })}
            placeholder="Which oil went in"
            disabled={disabled}
          />
        </div>
      </div>

      <div className={`grid ${cols} gap-3`}>
        <div className="space-y-1.5">
          <Label>Current KM</Label>
          <Input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={value.current_km}
            onChange={(e) => set({ current_km: e.target.value })}
            placeholder="125400"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Next KM</Label>
          <Input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={value.next_km}
            onChange={(e) => set({ next_km: e.target.value })}
            placeholder="130400"
            disabled={disabled}
          />
          {kmBackwards && (
            <p className="text-[11px] text-destructive">
              Next KM is below the current reading — check the two figures.
            </p>
          )}
        </div>
      </div>

      <div className={`grid ${cols} gap-3`}>
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            value={value.visitor_name}
            onChange={(e) => set({ visitor_name: e.target.value })}
            placeholder="Who brought the vehicle in"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Phone number</Label>
          <Input
            value={value.phone}
            onChange={(e) => set({ phone: e.target.value })}
            placeholder="03xx xxxxxxx"
            inputMode="tel"
            disabled={disabled}
          />
        </div>
      </div>

      {!compact && (
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea
            rows={2}
            value={value.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Anything worth remembering about this visit"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

/** Turns the typed draft into the shape the save action expects. */
export function vehicleDraftToInput(v: VehicleDraft) {
  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };
  return {
    vehicle_number: v.vehicle_number.trim(),
    make: v.make.trim() || null,
    model_number: v.model_number.trim() || null,
    current_km: num(v.current_km),
    next_km: num(v.next_km),
    oil_changer: v.oil_changer.trim() || null,
    visitor_name: v.visitor_name.trim() || null,
    phone: v.phone.trim() || null,
    notes: v.notes.trim() || null,
  };
}
