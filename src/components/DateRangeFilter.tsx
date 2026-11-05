import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/DateInput";

/** A local day as yyyy-MM-dd. */
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export type QuickRange = "all" | "today" | "7d" | "month" | "year";

/** The from/to days a quick range stands for, read from the clock now. Empty = open. */
export function quickRange(q: QuickRange, now = new Date()): { from: string; to: string } {
  const today = localDay(now);
  if (q === "all") return { from: "", to: "" };
  if (q === "today") return { from: today, to: today };
  if (q === "7d") return { from: localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to: today };
  if (q === "month") return { from: localDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  return { from: localDay(new Date(now.getFullYear(), 0, 1)), to: today };
}

const QUICK: { value: QuickRange; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

/**
 * From / To boxes with quick ranges. Both empty means everything. The quick
 * button that matches the boxes is highlighted, so typing a range by hand
 * shows none. ⚠️ COPIED verbatim to the desktop.
 */
export function DateRangeFilter({ from, to, onChange }: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const active = QUICK.find((q) => {
    const r = quickRange(q.value);
    return r.from === from && r.to === to;
  })?.value;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {QUICK.map((q) => (
          <Button
            key={q.value}
            type="button"
            size="sm"
            variant={active === q.value ? "default" : "outline"}
            className="h-8"
            onClick={() => onChange(quickRange(q.value))}
          >
            {q.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <DateInput className="h-8 w-36" value={from} onChange={(e) => onChange({ from: e.target.value, to })} aria-label="From" />
        <span className="text-xs text-muted-foreground">to</span>
        <DateInput className="h-8 w-36" value={to} onChange={(e) => onChange({ from, to: e.target.value })} aria-label="To" />
      </div>
    </div>
  );
}
