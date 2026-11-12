import { describe, it, expect } from "vitest";
import {
  defaultTillOrderType,
  effectiveTillOrderType,
  filterValue,
  oilChangeEnabled,
  oilChangeLabel,
  orderTypeLabel,
  orderTypeSettings,
  parseFilter,
  paymentStatus,
  regularSaleEnabled,
  saleFilterOptions,
  saleMatchesFilter,
  serializeOrderTypes,
  tillOrderTypes,
} from "@/lib/order-types";
import { orderBanner, orderLine } from "@/lib/cafe-order";

const keys = (list: { key: string }[]) => list.map((t) => t.key);

describe("defaults keep every till as it was", () => {
  it("a cafe offers Dine-in / Take away / Delivery and starts on Dine-in", () => {
    const shop = { store_type: "cafe", order_types: null };
    expect(keys(tillOrderTypes(shop))).toEqual(["dine_in", "takeaway", "delivery"]);
    expect(defaultTillOrderType(shop)).toBe("dine_in");
  });

  it("an oil shop offers Oil change as a till type and starts on it (the vehicle form open, as before)", () => {
    const shop = { store_type: "oil" };
    expect(oilChangeEnabled(shop)).toBe(true);
    expect(keys(tillOrderTypes(shop))).toEqual(["oil_change"]);
    expect(defaultTillOrderType(shop)).toBe("oil_change");
  });

  it("puts Oil change right after Take away", () => {
    const shop = { store_type: "oil", order_types: [{ key: "takeaway", label: "Take away", enabled: true }] };
    expect(keys(tillOrderTypes(shop))).toEqual(["takeaway", "oil_change"]);
  });

  it("offers Dine-in only to a cafe — not even when another store had it saved", () => {
    expect(keys(orderTypeSettings({ store_type: "other" }))).not.toContain("dine_in");
    expect(keys(orderTypeSettings({ store_type: "oil" }))).not.toContain("dine_in");
    expect(keys(tillOrderTypes({ store_type: "other", order_types: [{ key: "dine_in", label: "Dine-in", enabled: true }] }))).toEqual([]);
    expect(keys(orderTypeSettings({ store_type: "cafe" }))).toContain("dine_in");
    // An old bill still reads sensibly.
    expect(orderTypeLabel({ store_type: "other" }, "dine_in")).toBe("Dine-in");
  });

  it("any other store asks nothing", () => {
    expect(tillOrderTypes({ store_type: "other" })).toEqual([]);
    expect(oilChangeEnabled({ store_type: "other" })).toBe(false);
  });

  it("Regular sale is on for every store, first in Settings, and never a till type", () => {
    for (const store_type of ["other", "cafe", "oil"]) {
      expect(keys(orderTypeSettings({ store_type }))[0]).toBe("regular");
      expect(regularSaleEnabled({ store_type })).toBe(true);
      expect(keys(tillOrderTypes({ store_type }))).not.toContain("regular");
    }
  });

  it("only an oil shop has an oil change row", () => {
    expect(keys(orderTypeSettings({ store_type: "other" }))).not.toContain("oil_change");
    expect(keys(orderTypeSettings({ store_type: "oil" }))).toContain("oil_change");
  });
});

describe("the shop's own choices", () => {
  const shop = {
    store_type: "other",
    order_types: [
      { key: "takeaway", label: "Parcel", enabled: true },
      { key: "delivery", label: "  ", enabled: true },
      { key: "c_1", label: "Online order", enabled: true },
      { key: "c_2", label: "", enabled: true },
      { key: "BAD KEY", label: "x", enabled: true },
    ],
  };

  it("uses the saved labels, falls back on a blank one, drops a blank custom and bad keys", () => {
    expect(tillOrderTypes(shop).map((t) => t.label)).toEqual(["Parcel", "Delivery", "Online order"]);
  });

  it("names old bills with the CURRENT label", () => {
    expect(orderTypeLabel(shop, "takeaway")).toBe("Parcel");
    expect(orderLine({ order_type: "takeaway", shop })).toBe("Parcel");
    // A type since removed still reads as something.
    expect(orderTypeLabel(shop, "c_9")).toBe("Other");
    expect(orderTypeLabel(shop, null)).toBe("");
  });

  it("the oil change can be switched off and renamed", () => {
    const oil = { store_type: "oil", order_types: [{ key: "oil_change", label: "Free service", enabled: false }] };
    expect(oilChangeEnabled(oil)).toBe(false);
    expect(oilChangeLabel(oil)).toBe("Free service");
  });

  it("keeps a just-added blank row only in the form, and never saves it", () => {
    const form = orderTypeSettings(shop, { keepBlank: true });
    expect(keys(form)).toContain("c_2");
    expect(keys(serializeOrderTypes(form))).not.toContain("c_2");
  });
});

describe("how a bill was paid", () => {
  it("tells paid, on ledger and part ledger apart", () => {
    expect(paymentStatus(1000, 1000)).toBe("paid");
    expect(paymentStatus(1000, 1500)).toBe("paid"); // change handed back is stored too
    expect(paymentStatus(1000, 0)).toBe("ledger");
    expect(paymentStatus(1000, 400)).toBe("part");
    expect(paymentStatus(0, 0)).toBe("paid");
    expect(paymentStatus("5200.00", "2000.00")).toBe("part");
  });
});

describe("Regular sale switched off", () => {
  const shop = {
    store_type: "oil",
    order_types: [
      { key: "regular", label: "Regular sale", enabled: false },
      { key: "takeaway", label: "Take away", enabled: true },
    ],
  };

  it("makes every bill carry a type — the chosen one, else the first", () => {
    expect(regularSaleEnabled(shop)).toBe(false);
    expect(effectiveTillOrderType(shop, null)).toBe("takeaway");
    expect(effectiveTillOrderType(shop, "gone")).toBe("takeaway");
    expect(effectiveTillOrderType(shop, "oil_change")).toBe("oil_change");
  });

  it("with it on, nothing chosen stays a regular sale", () => {
    expect(effectiveTillOrderType({ store_type: "other", order_types: [{ key: "takeaway", label: "x", enabled: true }] }, null)).toBeNull();
  });

  it("survives a save", () => {
    expect(serializeOrderTypes(orderTypeSettings(shop))[0]).toEqual({ key: "regular", label: "Regular sale", enabled: false });
  });
});

describe("the receipt's headline banner", () => {
  const shop = { store_type: "oil", order_types: [{ key: "takeaway", label: "Parcel", enabled: true }] };
  it("names the type in the shop's words, the table for dine-in, nothing for a regular sale", () => {
    expect(orderBanner({ order_type: "takeaway", shop })).toEqual({ title: "Parcel", sub: "", oil: false });
    expect(orderBanner({ order_type: "dine_in", table_label: "4", shop: { store_type: "cafe" } })).toEqual({ title: "Dine-in", sub: "Table 4", oil: false });
    expect(orderBanner({ order_type: null, shop })).toBeNull();
  });
  it("heads an oil-change bill — and an older oil bill with only its vehicle record — as an oil change", () => {
    expect(orderBanner({ order_type: "oil_change", shop })).toEqual({ title: "Oil change", sub: "", oil: true });
    expect(orderBanner({ order_type: null, oil_change: { vehicle_number: "LB-1" }, shop })).toEqual({ title: "Oil change", sub: "", oil: true });
  });
});

describe("sales filters", () => {
  const shop = { store_type: "oil", order_types: [{ key: "delivery", label: "Delivery", enabled: true }] };
  const bills = [
    { id: "a", order_type: "delivery", total: 100, amount_paid: 100, has_oil_change: false },
    { id: "b", order_type: null, total: 100, amount_paid: 0, has_oil_change: true },
    { id: "c", order_type: null, total: 100, amount_paid: 40, has_oil_change: false },
  ];
  const run = (v: string) => bills.filter((b) => saleMatchesFilter(b, parseFilter(v))).map((b) => b.id);

  it("offers the shop's enabled types, the oil change and the payment filters", () => {
    expect(saleFilterOptions(shop).map((o) => o.label)).toEqual([
      "All sales", "Regular sale", "Delivery", "Oil change", "On ledger", "Part ledger", "Paid",
    ]);
  });

  it("each filter finds its own bills", () => {
    expect(run("all")).toEqual(["a", "b", "c"]);
    expect(run("type:delivery")).toEqual(["a"]);
    expect(run("oil_change")).toEqual(["b"]);
    expect(run("type:regular")).toEqual(["b", "c"]);
    expect(saleMatchesFilter({ order_type: "oil_change", total: 1, has_oil_change: false }, parseFilter("oil_change"))).toBe(true);
    expect(run("pay:ledger")).toEqual(["b"]);
    expect(run("pay:part")).toEqual(["c"]);
    expect(run("pay:paid")).toEqual(["a"]);
  });

  it("round-trips through its string form and ignores rubbish", () => {
    for (const f of [{ kind: "oil_change" } as const, { kind: "payment", status: "part" } as const, { kind: "order_type", key: "c_1" } as const]) {
      expect(parseFilter(filterValue(f))).toEqual(f);
    }
    expect(parseFilter("type:DROP TABLE")).toEqual({ kind: "all" });
  });
});
