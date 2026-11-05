import { describe, expect, it } from "vitest";
import { quickRange } from "@/components/DateRangeFilter";

describe("quickRange", () => {
  const now = new Date(2026, 10, 5, 15, 30); // 5 Nov 2026, local
  it("is open for All", () => expect(quickRange("all", now)).toEqual({ from: "", to: "" }));
  it("is one day for Today", () => expect(quickRange("today", now)).toEqual({ from: "2026-11-05", to: "2026-11-05" }));
  it("counts today in the 7 days", () => expect(quickRange("7d", now)).toEqual({ from: "2026-10-30", to: "2026-11-05" }));
  it("starts the month on the 1st", () => expect(quickRange("month", now)).toEqual({ from: "2026-11-01", to: "2026-11-05" }));
  it("starts the year on 1 January", () => expect(quickRange("year", now)).toEqual({ from: "2026-01-01", to: "2026-11-05" }));
});
