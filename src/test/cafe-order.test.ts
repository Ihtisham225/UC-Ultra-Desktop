import { describe, expect, it } from "vitest";
import { buildKitchenSlipHtml, normalizeTables, orderLine, orderTypeOf } from "@/lib/cafe-order";

describe("cafe orders", () => {
  it("reads only the three order types", () => {
    expect(orderTypeOf("dine_in")).toBe("dine_in");
    expect(orderTypeOf("takeaway")).toBe("takeaway");
    expect(orderTypeOf("drive_thru")).toBeNull();
  });
  it("prints the table only for dine-in", () => {
    expect(orderLine({ order_type: "dine_in", table_label: "2" })).toBe("Dine-in · Table 2");
    expect(orderLine({ order_type: "dine_in", table_label: null })).toBe("Dine-in");
    expect(orderLine({ order_type: "delivery", table_label: "2" })).toBe("Delivery");
    expect(orderLine({ order_type: null })).toBe("");
  });
  it("tidies the shop's table list — trimmed, no blanks, no repeats", () => {
    expect(normalizeTables("1, 2,\n2 , Family 1,, ")).toEqual(["1", "2", "Family 1"]);
    expect(normalizeTables([" T1", "t1", "T2"])).toEqual(["T1", "T2"]);
    expect(normalizeTables(null)).toEqual([]);
  });
  it("builds a kitchen slip with the items and table but no prices", () => {
    const html = buildKitchenSlipHtml(
      {
        receipt_number: "5", created_at: "2026-11-03T15:55:00Z", order_type: "dine_in", table_label: "2", notes: "less sugar",
        items: [
          { product_name: "Chai", quantity: 2 },
          // stored in base units: 8 L sold as 2 bottles
          { product_name: "Oil <special>", quantity: 8, unit_label: "Bottle", unit_factor: 4 },
        ],
      },
      "Test Mart",
      "03/11/2026 8:55 PM",
    );
    expect(html).toContain("KITCHEN");
    expect(html).toContain("Dine-in · Table 2");
    expect(html).toContain("less sugar");
    expect(html).toContain(">2 Bottle<");
    expect(html).toContain("Oil &lt;special&gt;");
    expect(html).not.toMatch(/80\.00|price/i);
  });
});
