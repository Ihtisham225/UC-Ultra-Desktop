import { describe, it, expect } from "vitest";
import {
  defaultTillOrderType,
  filterValue,
  oilChangeEnabled,
  oilChangeLabel,
  orderTypeLabel,
  orderTypeSettings,
  parseFilter,
  paymentStatus,
  saleFilterOptions,
  saleMatchesFilter,
  serializeOrderTypes,
  tillOrderTypes,
} from "@/lib/order-types";
import { orderLine } from "@/lib/cafe-order";

const keys = (list: { key: string }[]) => list.map((t) => t.key);

describe("defaults keep every till as it was", () => {
  it("a cafe offers Dine-in / Take away / Delivery and starts on Dine-in", () => {
    const shop = { store_type: "cafe", order_types: null };
    expect(keys(tillOrderTypes(shop))).toEqual(["dine_in", "takeaway", "delivery"]);
    expect(defaultTillOrderType(shop)).toBe("dine_in");
  });

  it("an oil shop shows the vehicle form and offers no buttons", () => {
    const shop = { store_type: "oil" };
    expect(oilChangeEnabled(shop)).toBe(true);
    expect(tillOrderTypes(shop)).toEqual([]);
    expect(defaultTillOrderType(shop)).toBeNull();
  });

  it("any other store asks nothing", () => {
    expect(tillOrderTypes({ store_type: "other" })).toEqual([]);
    expect(oilChangeEnabled({ store_type: "other" })).toBe(false);
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
      "All sales", "Delivery", "Oil change", "On ledger", "Part ledger", "Paid",
    ]);
  });

  it("each filter finds its own bills", () => {
    expect(run("all")).toEqual(["a", "b", "c"]);
    expect(run("type:delivery")).toEqual(["a"]);
    expect(run("oil_change")).toEqual(["b"]);
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
