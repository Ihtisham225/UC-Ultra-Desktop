import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface AccountOption { id: string; name: string; type: string }

/** Loader is injected so the same picker works on web (action) and desktop (rpc). */
let loader: (() => Promise<AccountOption[]>) | null = null;
export function setAccountOptionsLoader(fn: () => Promise<AccountOption[]>) {
  loader = fn;
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
  value, onChange, label = "Paid from", allowNone = true,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  allowNone?: boolean;
}) {
  const [options, setOptions] = useState<AccountOption[]>([]);

  useEffect(() => {
    if (!loader) return;
    loader()
      .then((list) => {
        setOptions(list);
        // Default to the drawer so the common case needs no thought.
        if (!value && list.length > 0) {
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
        onValueChange={(v) => onChange(v === NONE ? null : v)}
      >
        <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
        <SelectContent>
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
