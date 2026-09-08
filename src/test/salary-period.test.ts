import { describe, it, expect } from "vitest";
import { periodFor, periodLabel, shiftPeriod, customDays, referenceDay } from "@/lib/salary-period";

/**
 * The terminal and the server both compute pay-period boundaries from this
 * file, and the server decides which payments fall inside one. If the two ever
 * disagree, the counter sees a balance the payslip contradicts — so these
 * expectations are the contract, not incidental behaviour.
 */
const P = (config: Parameters<typeof periodFor>[0], on: string) => {
  const p = periodFor(config, on);
  return [p.start, p.end, p.days] as const;
};

describe("pay periods", () => {
  it("covers the fixed-length cycles", () => {
    expect(P({ period: "daily" }, "2026-09-08")).toEqual(["2026-09-08", "2026-09-08", 1]);
    // 8 Sep 2026 is a Tuesday, so an unanchored week runs from the Monday.
    expect(P({ period: "weekly" }, "2026-09-08")).toEqual(["2026-09-07", "2026-09-13", 7]);
    expect(P({ period: "biweekly" }, "2026-09-08")).toEqual(["2026-08-31", "2026-09-13", 14]);
    expect(P({ period: "biweekly" }, "2026-09-14")).toEqual(["2026-09-14", "2026-09-27", 14]);
  });

  it("covers the calendar cycles", () => {
    expect(P({ period: "monthly" }, "2026-09-08")).toEqual(["2026-09-01", "2026-09-30", 30]);
    expect(P({ period: "quarterly" }, "2026-09-08")).toEqual(["2026-07-01", "2026-09-30", 92]);
    expect(P({ period: "half_yearly" }, "2026-09-08")).toEqual(["2026-07-01", "2026-12-31", 184]);
    expect(P({ period: "yearly" }, "2026-09-08")).toEqual(["2026-01-01", "2026-12-31", 365]);
    expect(P({ period: "monthly" }, "2028-02-10")).toEqual(["2028-02-01", "2028-02-29", 29]);
  });

  it("aligns a cycle to its anchor", () => {
    // Wages running the 5th to the 4th: before the 5th you are still in the
    // period that opened last month.
    expect(P({ period: "monthly", anchor: "2020-01-05" }, "2026-09-03")).toEqual(["2026-08-05", "2026-09-04", 31]);
    expect(P({ period: "monthly", anchor: "2020-01-05" }, "2026-09-05")).toEqual(["2026-09-05", "2026-10-04", 30]);
    // A quarterly cycle anchored to February runs Feb–Apr, May–Jul, Aug–Oct.
    expect(P({ period: "quarterly", anchor: "2020-02-01" }, "2026-09-08")).toEqual(["2026-08-01", "2026-10-31", 92]);
    // Weeks start on the anchor's weekday (3 Jan 2026 is a Saturday).
    expect(P({ period: "weekly", anchor: "2026-01-03" }, "2026-09-08")).toEqual(["2026-09-05", "2026-09-11", 7]);
  });

  it("clamps an anchor day past the end of a short month", () => {
    expect(P({ period: "monthly", anchor: "2020-01-31" }, "2026-02-15")).toEqual(["2026-01-31", "2026-02-27", 28]);
  });

  it("counts custom cycles forwards and backwards from the anchor", () => {
    const cfg = { period: "custom" as const, periodDays: 10, anchor: "2026-09-01" };
    expect(P(cfg, "2026-09-08")).toEqual(["2026-09-01", "2026-09-10", 10]);
    expect(P(cfg, "2026-08-30")).toEqual(["2026-08-22", "2026-08-31", 10]);
  });

  it("still accepts a bare month, the way older callers pass one", () => {
    expect(referenceDay("2026-03")).toBe("2026-03-15");
    expect(P({ period: "monthly" }, "2026-03")).toEqual(["2026-03-01", "2026-03-31", 31]);
  });

  it("names a period as short as it can", () => {
    expect(periodLabel("monthly", periodFor({ period: "monthly" }, "2026-09-08"))).toBe("Sep 2026");
    expect(periodLabel("quarterly", periodFor({ period: "quarterly" }, "2026-09-08"))).toBe("Q3 2026");
    expect(periodLabel("yearly", periodFor({ period: "yearly" }, "2026-09-08"))).toBe("2026");
    expect(periodLabel("daily", periodFor({ period: "daily" }, "2026-09-08"))).toBe("8 Sep 2026");
    expect(periodLabel("weekly", periodFor({ period: "weekly" }, "2026-09-08"))).toBe("7 Sep – 13 Sep 2026");
    // An anchored month is a range, not a month name, and can cross a year.
    expect(periodLabel("monthly", periodFor({ period: "monthly", anchor: "2020-01-05" }, "2026-12-20")))
      .toBe("5 Dec 2026 – 4 Jan 2027");
  });

  it("steps to the neighbouring period", () => {
    const s = (config: Parameters<typeof shiftPeriod>[0], on: string, d: -1 | 1) => {
      const p = shiftPeriod(config, on, d);
      return [p.start, p.end] as const;
    };
    expect(s({ period: "monthly" }, "2026-09-08", -1)).toEqual(["2026-08-01", "2026-08-31"]);
    expect(s({ period: "monthly" }, "2026-09-08", 1)).toEqual(["2026-10-01", "2026-10-31"]);
    expect(s({ period: "weekly" }, "2026-09-08", -1)).toEqual(["2026-08-31", "2026-09-06"]);
    expect(s({ period: "quarterly" }, "2026-09-08", 1)).toEqual(["2026-10-01", "2026-12-31"]);
  });

  it("keeps a custom length to something a person could mean", () => {
    // A half-typed or cleared box must not produce a zero-length period, which
    // would divide by zero when counting blocks.
    expect(customDays(NaN)).toBe(1);
    expect(customDays(0)).toBe(1);
    expect(customDays(null)).toBe(1);
    expect(customDays(10.9)).toBe(10);
    expect(customDays(99999)).toBe(3650);
  });
});
