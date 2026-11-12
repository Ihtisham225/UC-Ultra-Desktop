import { describe, it, expect, vi } from "vitest";
import { GROUP_ORDER, matchPages, searchTarget } from "@/lib/global-search";

vi.mock("@/lib/localDb", () => ({ getById: vi.fn(async () => null) }));
import { visitsForVehicle } from "@/lib/vehicleHistory";
import { sortVisits } from "@/components/VehicleHistoryDialog";

const pages = [
  { to: "/expenses", label: "Expenses", section: "Money", keywords: ["spending"] },
  { to: "/oil-changes", label: "Oil Changes", section: "Selling", keywords: ["visits", "service"] },
  { to: "/vehicles", label: "Vehicles", section: "Selling", keywords: ["cars", "register"] },
  { to: "/debts", label: "Ledger", section: "Money", keywords: ["khata", "udhaar"] },
];

describe("global search pages", () => {
  it("matches a page by name, every word, case-insensitively", () => {
    expect(matchPages(pages, "expen").map((p) => p.id)).toEqual(["/expenses"]);
    expect(matchPages(pages, "OIL ch").map((p) => p.id)).toEqual(["/oil-changes"]);
  });
  it("matches by what people call it", () => {
    expect(matchPages(pages, "khata").map((p) => p.title)).toEqual(["Ledger"]);
    expect(matchPages(pages, "cars").map((p) => p.id)).toEqual(["/vehicles"]);
  });
  it("finds nothing for an empty box", () => {
    expect(matchPages(pages, "  ")).toEqual([]);
  });
  it("puts pages first", () => {
    expect(GROUP_ORDER[0]).toBe("page");
  });
});

describe("where a hit lands", () => {
  const hit = (type: Parameters<typeof searchTarget>[0]["type"], extra: object = {}) =>
    searchTarget({ type, id: "abc", title: "Ali & Sons", subtitle: "", ...extra });
  it("opens the record itself where the page can", () => {
    expect(hit("vehicle")).toBe("/vehicles?vehicle=abc");
    expect(hit("purchase")).toBe("/purchases?purchase=abc");
    expect(hit("return")).toBe("/returns?return=abc");
    expect(hit("sale")).toBe("/sales?sale=abc");
  });
  it("searches by name or plate otherwise, encoded", () => {
    expect(hit("supplier")).toBe("/suppliers?q=Ali%20%26%20Sons");
    expect(hit("ledger", { link: "Ali" })).toBe("/debts?q=Ali");
    expect(hit("oil_change", { link: "LB-3206" })).toBe("/oil-changes?q=LB-3206");
    expect(hit("expense", { link: "2026-11-12" })).toBe("/expenses?day=2026-11-12");
    expect(hit("page", { link: "/vehicles" })).toBe("/vehicles");
  });
});

describe("a car's history from the offline store", () => {
  const rows = [
    { id: "1", vehicle_id: "car", serviced_at: "2026-08-01T00:00:00Z" },
    { id: "2", vehicle_id: null, vehicle_number: "lb 3206", serviced_at: "2026-11-12T00:00:00Z" },
    { id: "3", vehicle_id: "other", vehicle_number: "LEA-1", serviced_at: "2026-10-01T00:00:00Z" },
  ];
  it("takes visits linked by id and older ones by the same plate, newest first", () => {
    expect(visitsForVehicle(rows, { id: "car", vehicle_number: "LB-3206" }).map((r) => r.id)).toEqual(["2", "1"]);
  });
  it("sorts the dialog's rows newest first", () => {
    expect(sortVisits(rows).map((r) => r.id)).toEqual(["2", "3", "1"]);
  });
});
