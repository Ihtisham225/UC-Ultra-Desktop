import { afterEach, describe, expect, it } from "vitest";
import {
  autoSeparate,
  fmtDate,
  fmtDateTime,
  fmtTime,
  getDatePrefs,
  inputToIso,
  isoToInput,
  setDatePrefs,
} from "@/lib/date-format";

afterEach(() => setDatePrefs(null, null));

describe("showing a date", () => {
  it("renders a calendar day in every format", () => {
    expect(fmtDate("2026-09-30", "dd/MM/yyyy")).toBe("30/09/2026");
    expect(fmtDate("2026-09-30", "MM/dd/yyyy")).toBe("09/30/2026");
    expect(fmtDate("2026-09-30", "yyyy/MM/dd")).toBe("2026/09/30");
    expect(fmtDate("2026-09-30", "dd.MM.yyyy")).toBe("30.09.2026");
    expect(fmtDate("2026-09-30", "dd MMM yyyy")).toBe("30 Sep 2026");
    expect(fmtDate("2026-09-30", "MMM dd, yyyy")).toBe("Sep 30, 2026");
  });

  it("never moves a bare day across midnight", () => {
    // new Date("2026-09-01") is UTC midnight — the 31st anywhere west of UTC.
    expect(fmtDate("2026-09-01", "dd/MM/yyyy")).toBe("01/09/2026");
    expect(fmtDateTime("2026-09-01")).toBe("01/09/2026");
  });

  it("follows the shop's choice once set, and falls back on nonsense", () => {
    const at = new Date(2026, 8, 30, 14, 5);
    expect(fmtDateTime(at)).toBe("30/09/2026 2:05 PM");
    setDatePrefs("yyyy-MM-dd", "24h");
    expect(fmtDateTime(at)).toBe("2026-09-30 14:05");
    expect(fmtTime(new Date(2026, 8, 30, 0, 7))).toBe("00:07");
    setDatePrefs("not-a-format", "25h");
    expect(getDatePrefs()).toEqual({ date: "dd/MM/yyyy", time: "12h" });
  });

  it("shows nothing for nothing", () => {
    expect(fmtDate(null)).toBe("");
    expect(fmtDate("")).toBe("");
    expect(fmtDateTime("not a date")).toBe("");
  });

  it("reads 12 o'clock correctly", () => {
    expect(fmtTime(new Date(2026, 0, 1, 0, 0), "12h")).toBe("12:00 AM");
    expect(fmtTime(new Date(2026, 0, 1, 12, 0), "12h")).toBe("12:00 PM");
  });
});

describe("typing a date", () => {
  it("reads the parts in the shop's order", () => {
    expect(inputToIso("30/09/2026", "dd/MM/yyyy")).toBe("2026-09-30");
    expect(inputToIso("09/30/2026", "MM/dd/yyyy")).toBe("2026-09-30");
    expect(inputToIso("2026-09-30", "yyyy-MM-dd")).toBe("2026-09-30");
    // Named-month formats are typed with numbers, in the same order.
    expect(inputToIso("09/30/2026", "MMM dd, yyyy")).toBe("2026-09-30");
  });

  it("accepts short parts and any separator", () => {
    expect(inputToIso("3/9/26", "dd/MM/yyyy")).toBe("2026-09-03");
    expect(inputToIso("3-9-2026", "dd/MM/yyyy")).toBe("2026-09-03");
  });

  it("refuses dates that don't exist or aren't finished", () => {
    expect(inputToIso("31/02/2026", "dd/MM/yyyy")).toBeNull();
    expect(inputToIso("13/13/2026", "dd/MM/yyyy")).toBeNull();
    expect(inputToIso("30/09/202", "dd/MM/yyyy")).toBeNull();
    expect(inputToIso("30/09", "dd/MM/yyyy")).toBeNull();
  });

  it("puts separators in as the digits arrive", () => {
    expect(autoSeparate("30", "dd/MM/yyyy")).toBe("30/");
    expect(autoSeparate("3009", "dd/MM/yyyy")).toBe("30/09/");
    expect(autoSeparate("30092026", "dd/MM/yyyy")).toBe("30/09/2026");
    expect(autoSeparate("2026", "yyyy-MM-dd")).toBe("2026-");
  });

  it("round-trips a stored day through the box", () => {
    for (const fmt of ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy/MM/dd", "dd.MM.yyyy", "dd MMM yyyy"] as const) {
      expect(inputToIso(isoToInput("2026-09-30", fmt), fmt)).toBe("2026-09-30");
    }
  });
});
