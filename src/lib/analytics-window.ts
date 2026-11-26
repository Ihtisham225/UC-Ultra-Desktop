/**
 * The Analytics page's date window: quick presets (Today, 7/30/90 days, this
 * month) or any From–To the shop types. Days are LOCAL — "today" is the
 * shop's today, not the server's. Pure, so the desktop can copy it verbatim.
 */

export type AnalyticsPreset = "today" | "7d" | "30d" | "90d" | "month";

export const ANALYTICS_PRESETS: { value: AnalyticsPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "month", label: "This month" },
];

/** A local day as yyyy-MM-dd. */
export const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** yyyy-MM-dd → that day's local midnight. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The from/to days a preset stands for, read from the clock now. */
export function presetRange(p: AnalyticsPreset, now = new Date()): { from: string; to: string } {
  const to = localDay(now);
  const back = (n: number) => localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  switch (p) {
    case "today": return { from: to, to };
    case "7d": return { from: back(6), to };
    case "30d": return { from: back(29), to };
    case "90d": return { from: back(89), to };
    case "month": return { from: localDay(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  }
}

/** Which preset (if any) a from/to matches, so typing a range by hand highlights none. */
export function matchingPreset(from: string, to: string, now = new Date()): AnalyticsPreset | null {
  return ANALYTICS_PRESETS.find((p) => {
    const r = presetRange(p.value, now);
    return r.from === from && r.to === to;
  })?.value ?? null;
}

/** Whole days in the window, counting both ends (at least 1). */
export function daysIn(from: string, to: string): number {
  // Round, not floor: a DST change makes one day 23 or 25 hours long.
  return Math.max(1, Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000) + 1);
}

/** What loadAnalyticsAction takes: the days, and the instants they begin and end at. */
export function analyticsWindow(from: string, to: string) {
  // A From after the To is read the way it was meant.
  const [a, b] = from <= to ? [from, to] : [to, from];
  const start = parseDay(a);
  const end = parseDay(b);
  end.setDate(end.getDate() + 1);
  return { from: a, to: b, fromIso: start.toISOString(), toIso: end.toISOString() };
}
