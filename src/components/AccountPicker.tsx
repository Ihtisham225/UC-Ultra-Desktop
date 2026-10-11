import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface AccountOption { id: string; name: string; type: string }

/** Loader is injected so the same picker works on web (action) and desktop (rpc). */
let loader: (() => Promise<AccountOption[]>) | null = null;
export function setAccountOptionsLoader(fn: () => Promise<AccountOption[]>) {
  loader = fn;
}

/**
 * The same list, for screens that lay the accounts out themselves — the till's
 * split tenders and the sale edit's. Goes through the injected loader so those
 * screens work on web and on the terminal without knowing which they are on.
 */
export async function loadAccountOptions(): Promise<AccountOption[]> {
  if (!loader) return [];
  try {
    return await loader();
  } catch {
    return [];
  }
}

const ICON: Record<string, string> = { cash: "💵", wallet: "📱", bank: "🏦" };
const NONE = "__none__";

/**
 * "Which account did this money move through?" — shown on every form that
 * takes or pays out money, so balances stay in step with the books.
 *
 * Leaving it unset is allowed: shops that don't want to track balances yet,
 * and older records, simply have no account attached.
 */
export function AccountPicker({
  value, onChange, label = "Paid from", allowNone = true, autoDefault = true, step, onAdvance,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  allowNone?: boolean;
  /** Pick the cash drawer when nothing is chosen. Off when editing a record
   *  that deliberately has no account — defaulting would invent a money move. */
  autoDefault?: boolean;
  /** Place in a screen's Enter chain (lib/checkout-keys). */
  step?: number;
  /**
   * Move on. Enter on the closed box keeps the account shown and calls this
   * (arrows or Space open the list to change it); a choice made from the list
   * calls it once the list has closed — ONE Enter either way.
   */
  onAdvance?: () => void;
}) {
  const [options, setOptions] = useState<AccountOption[]>([]);
  /** A choice was made from the open list — advance when it finishes closing. */
  const pickedRef = useRef(false);

  useEffect(() => {
    if (!loader) return;
    loader()
      .then((list) => {
        setOptions(list);
        // Default to the drawer so the common case needs no thought.
        if (autoDefault && !value && list.length > 0) {
          onChange((list.find((a) => a.type === "cash") ?? list[0]).id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (options.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value ?? NONE}
        onValueChange={(v) => { pickedRef.current = true; onChange(v === NONE ? null : v); }}
      >
        <SelectTrigger
          data-checkout-step={step}
          onKeyDown={onAdvance ? (e) => {
            if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return;
            e.preventDefault();
            onAdvance();
          } : undefined}
        >
          <SelectValue placeholder="Account" />
        </SelectTrigger>
        <SelectContent
          // Enter on the account already chosen changes nothing, so
          // onValueChange never fires — count the key itself as the choice.
          onKeyDown={(e) => { if (e.key === "Enter") pickedRef.current = true; }}
          onCloseAutoFocus={(e) => {
            if (!onAdvance || !pickedRef.current) return;
            pickedRef.current = false;
            e.preventDefault();
            onAdvance();
          }}
        >
          {allowNone && <SelectItem value={NONE}>Don&apos;t track</SelectItem>}
          {options.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {ICON[a.type] ?? "🏦"} {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
