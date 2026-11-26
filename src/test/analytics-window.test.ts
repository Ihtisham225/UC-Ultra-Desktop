import { describe, expect, it } from "vitest";
import { analyticsWindow, daysIn, matchingPreset, presetRange } from "@/lib/analytics-window";

const now = new Date(2026, 10, 26, 15, 30); // 26 Nov 2026, local afternoon

describe("analytics window", () => {
  it("presets are local days counted back from today", () => {
    expect(presetRange("today", now)).toEqual({ from: "2026-11-26", to: "2026-11-26" });
    expect(presetRange("7d", now)).toEqual({ from: "2026-11-20", to: "2026-11-26" });
    expect(presetRange("month", now)).toEqual({ from: "2026-11-01", to: "2026-11-26" });
  });

  it("counts both ends of the window", () => {
    expect(daysIn("2026-11-26", "2026-11-26")).toBe(1);
    expect(daysIn("2026-11-01", "2026-11-30")).toBe(30);
  });

  it("highlights a preset only when the boxes match it", () => {
    expect(matchingPreset("2026-11-20", "2026-11-26", now)).toBe("7d");
    expect(matchingPreset("2026-11-19", "2026-11-26", now)).toBeNull();
  });

  it("ends the window at the local midnight after the last day, and swaps a reversed range", () => {
    const w = analyticsWindow("2026-11-26", "2026-11-25");
    expect(w.from).toBe("2026-11-25");
    expect(w.to).toBe("2026-11-26");
    expect(new Date(w.fromIso).getTime()).toBe(new Date(2026, 10, 25).getTime());
    expect(new Date(w.toIso).getTime()).toBe(new Date(2026, 10, 27).getTime());
  });
});
