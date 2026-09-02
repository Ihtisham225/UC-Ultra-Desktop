import { describe, it, expect } from "vitest";
import { startOfDay, endOfDay } from "date-fns";

/**
 * Mirrors the guard in Reports.tsx. The reports page took the whole app down
 * mid-keystroke because `<input type="date">` reports intermediate values and
 * `new Date("").toISOString()` throws a RangeError.
 */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const usableDay = (value: string, fallback: string): string => {
  if (!ISO_DAY.test(value)) return fallback;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? fallback : value;
};

const buildRange = (from: string, to: string) => ({
  fromISO: startOfDay(new Date(`${usableDay(from, "2026-01-01")}T00:00:00`)).toISOString(),
  toISO: endOfDay(new Date(`${usableDay(to, "2026-12-31")}T00:00:00`)).toISOString(),
});

describe("report date range", () => {
  it("proves the original crash was real", () => {
    // This is what the page used to do with a half-typed date.
    expect(() => endOfDay(new Date("")).toISOString()).toThrow(RangeError);
    expect(() => endOfDay(new Date("2026-0")).toISOString()).toThrow(RangeError);
  });

  it("survives every value a date input emits while being typed", () => {
    for (const partial of ["", "2", "20", "202", "2026", "2026-", "2026-0", "2026-09-"]) {
      expect(() => buildRange("2026-01-01", partial)).not.toThrow();
      expect(() => buildRange(partial, "2026-12-31")).not.toThrow();
    }
  });

  // The range is a LOCAL day converted to an instant, so the ISO string can
  // sit on the previous calendar date in a positive-offset timezone. Compare
  // the local day, not the ISO prefix.
  const localDay = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  it("uses the typed date once it is a whole one", () => {
    const r = buildRange("2026-03-04", "2026-03-05");
    expect(localDay(r.fromISO)).toBe("2026-03-04");
    expect(localDay(r.toISO)).toBe("2026-03-05");
  });

  it("falls back rather than inventing a date from a nonsense value", () => {
    expect(localDay(buildRange("banana", "2026-12-31").fromISO)).toBe("2026-01-01");
  });

  it("keeps the whole local day, so a sale at 23:59 is still inside the range", () => {
    const r = buildRange("2026-03-04", "2026-03-04");
    const end = new Date(r.toISO);
    expect([end.getHours(), end.getMinutes(), end.getSeconds()]).toEqual([23, 59, 59]);
  });
});
