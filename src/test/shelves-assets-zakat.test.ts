import { describe, it, expect } from "vitest";
import { buildLocationTree, flattenLocations, locationAndDescendants, locationPath, whereKept } from "@/lib/storage-locations";
import {
  accumulatedDepreciation, assetEffectsBetween, bookValue, depreciationBetween, disposalGain, endOfLife, monthlyDepreciation,
  type AssetLike,
} from "@/lib/assets";
import { computeZakat, nisabValue, type ZakatLine } from "@/lib/zakat";
import { matchAppShortcut } from "@/lib/shortcuts";

const key = (over: Partial<Parameters<typeof matchAppShortcut>[0]>) => ({
  key: "", code: "", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...over,
});

describe("calculator and theme keys", () => {
  it("opens the calculator on Ctrl/Cmd+J and flips the theme on Ctrl/Cmd+Shift+L", () => {
    expect(matchAppShortcut(key({ key: "j", code: "KeyJ", ctrlKey: true }))).toBe("calculator");
    expect(matchAppShortcut(key({ key: "j", code: "KeyJ", metaKey: true }))).toBe("calculator");
    expect(matchAppShortcut(key({ key: "L", code: "KeyL", ctrlKey: true, shiftKey: true }))).toBe("theme");
  });

  it("leaves Ctrl+L (the address bar) and shifted versions of the other keys alone", () => {
    expect(matchAppShortcut(key({ key: "l", code: "KeyL", ctrlKey: true }))).toBeNull();
    expect(matchAppShortcut(key({ key: "J", code: "KeyJ", ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(matchAppShortcut(key({ key: "G", code: "KeyG", ctrlKey: true, shiftKey: true }))).toBeNull();
  });
});

const places = [
  { id: "g", parent_id: null, name: "Godown", kind: "area" },
  { id: "a", parent_id: "g", name: "Rack A", kind: "rack" },
  { id: "a3", parent_id: "a", name: "Shelf 3", kind: "shelf" },
  { id: "a10", parent_id: "a", name: "Shelf 10", kind: "shelf" },
  { id: "b", parent_id: null, name: "Rack B", kind: "rack" },
];

describe("shelves and racks", () => {
  it("names a place by its whole path", () => {
    expect(locationPath("a3", places)).toBe("Godown › Rack A › Shelf 3");
    expect(locationPath(null, places)).toBeNull();
    expect(locationPath("gone", places)).toBeNull();
  });

  it("sorts shelves by number, not text — Shelf 3 before Shelf 10", () => {
    expect(flattenLocations(places).map((p) => p.row.id)).toEqual(["g", "a", "a3", "a10", "b"]);
    expect(flattenLocations(places).map((p) => p.depth)).toEqual([0, 1, 2, 2, 0]);
  });

  it("counts a rack's shelves as inside it", () => {
    expect([...locationAndDescendants("a", places)].sort()).toEqual(["a", "a10", "a3"]);
    expect([...locationAndDescendants("g", places)].length).toBe(4);
  });

  it("shows a place whose parent was deleted at the top rather than losing it", () => {
    const tree = buildLocationTree([{ id: "x", parent_id: "missing", name: "Shelf X", kind: "shelf" }]);
    expect(tree.map((n) => n.row.id)).toEqual(["x"]);
  });

  it("survives a loop in bad data", () => {
    const loop = [
      { id: "p", parent_id: "q", name: "P", kind: "rack" },
      { id: "q", parent_id: "p", name: "Q", kind: "rack" },
    ];
    expect(() => buildLocationTree(loop)).not.toThrow();
    expect(locationPath("p", loop)).toBe("Q › P");
  });

  it("says where a sellable thing is: the variant's own place, then the product's, then the old typed label", () => {
    expect(whereKept({ location_id: "a3" }, { location_id: "b" }, places)).toBe("Rack B");
    expect(whereKept({ location_id: "a3" }, { location_id: null }, places)).toBe("Godown › Rack A › Shelf 3");
    expect(whereKept({ location_id: null, shelf_location: " B-4 " }, null, places)).toBe("B-4");
    expect(whereKept({}, null, places)).toBeNull();
  });
});

// The worked example given to the shop: Rs 300,000 generator, 5 years, Rs 30,000 at the end.
const generator: AssetLike = {
  purchase_date: "2026-01-01",
  cost: 300_000,
  salvage_value: 30_000,
  useful_life_months: 60,
};

describe("asset depreciation", () => {
  it("charges (cost − salvage) ÷ months each month", () => {
    expect(monthlyDepreciation(generator)).toBe(4500);
  });

  it("ends its life N months after purchase, clamped to the month's end", () => {
    expect(endOfLife(generator)).toBe("2031-01-01");
    expect(endOfLife({ purchase_date: "2026-01-31", useful_life_months: 1 })).toBe("2026-02-28");
  });

  it("charges exactly the depreciable amount over the whole life, and no more after", () => {
    expect(depreciationBetween(generator, "2026-01-01", "2030-12-31")).toBe(270_000);
    expect(depreciationBetween(generator, "2020-01-01", "2040-01-01")).toBe(270_000);
    expect(bookValue(generator, "2035-01-01")).toBe(30_000);
  });

  it("charges nothing before it was bought", () => {
    expect(depreciationBetween(generator, "2025-01-01", "2025-12-31")).toBe(0);
    expect(bookValue(generator, "2025-06-01")).toBe(300_000);
  });

  it("splits a year into its days' share, so the pieces add back up", () => {
    const y1 = depreciationBetween(generator, "2026-01-01", "2026-12-31");
    const h1 = depreciationBetween(generator, "2026-01-01", "2026-06-30");
    const h2 = depreciationBetween(generator, "2026-07-01", "2026-12-31");
    expect(Math.abs(h1 + h2 - y1)).toBeLessThan(0.02);
    // About a fifth of the depreciable amount in the first of five years.
    expect(Math.abs(y1 - 54_000)).toBeLessThan(100);
  });

  it("stops charging once it's sold, and books the gain or loss against its value that day", () => {
    const sold: AssetLike = { ...generator, status: "sold", disposed_at: "2028-01-01", disposal_amount: 200_000 };
    const before = accumulatedDepreciation(sold, "2027-12-31");
    expect(depreciationBetween(sold, "2028-01-01", "2030-01-01")).toBe(0);
    const book = 300_000 - before;
    expect(disposalGain(sold)).toBeCloseTo(200_000 - book, 1);
  });

  it("treats a write-off as a loss of the whole book value", () => {
    const binned: AssetLike = { ...generator, status: "written_off", disposed_at: "2026-01-01", disposal_amount: 0 };
    expect(disposalGain(binned)).toBe(-300_000);
  });

  it("totals a range across assets for the reports", () => {
    const other: AssetLike = { purchase_date: "2026-07-01", cost: 12_000, salvage_value: 0, useful_life_months: 12 };
    const r = assetEffectsBetween([generator, other], "2026-07-01", "2027-06-30");
    expect(Math.abs(r.depreciation - (54_000 + 12_000))).toBeLessThan(200);
    expect(r.disposalGain).toBe(0);
  });
});

const line = (over: Partial<ZakatLine>): ZakatLine => ({
  key: Math.random().toString(), label: "x", amount: 0, kind: "asset", source: "auto", included: true, ...over,
});

describe("zakat", () => {
  it("is 2.5% of net zakatable wealth once it reaches the nisab", () => {
    const r = computeZakat(
      [line({ amount: 1_000_000 }), line({ amount: 200_000, kind: "liability" })],
      "silver",
      280,
    );
    expect(r.nisab).toBe(nisabValue("silver", 280));
    expect(r.nisab).toBeCloseTo(171_460.8, 1);
    expect(r.net).toBe(800_000);
    expect(r.due).toBe(20_000);
  });

  it("is nothing below the nisab, or before a metal price is given", () => {
    expect(computeZakat([line({ amount: 100_000 })], "silver", 280).due).toBe(0);
    expect(computeZakat([line({ amount: 5_000_000 })], "gold", 0).due).toBe(0);
  });

  it("ignores lines ticked off and never lets a negative amount count", () => {
    const r = computeZakat(
      [line({ amount: 1_000_000 }), line({ amount: 900_000, included: false }), line({ amount: -50_000 })],
      "silver",
      280,
    );
    expect(r.assets).toBe(1_000_000);
    expect(r.due).toBe(25_000);
  });
});
