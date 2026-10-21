import { describe, expect, it } from "vitest";
import { buildOrderSlipHtml, buildOrderSlipMessage, type OrderSlipDto } from "@/lib/order-slip";

const money = (n: number, c: string) => `${c} ${n.toFixed(2)}`;
const shop = { name: "Demo Shop", address: null, phone: null, currency: "PKR", receipt_header: null, receipt_footer: null };
const delivery: OrderSlipDto = {
  kind: "delivery",
  number: "DO-7",
  created_at: "2026-10-21T10:00:00.000Z",
  party_name: "Hamza Traders",
  party_phone: "03001234567",
  lines: [{ name: "LED bulb 12W", quantity: 40, unit: "pcs", price: 350, total: 14000 }],
  total: 14000,
  notes: null,
  bill_number: "1001",
  vehicle_number: "LES-4521",
  driver_name: "Akram",
  driver_phone: "03111111111",
  deliver_to: "Hall Road",
};

describe("order slips", () => {
  it("hides every price when printed without prices", () => {
    const html = buildOrderSlipHtml(delivery, shop, money, "21/10/2026", false);
    expect(html).not.toContain("350");
    expect(html).not.toContain("14,000");
    expect(html).not.toContain("Total (PKR)");
    expect(html).toContain("LED bulb 12W");
    const msg = buildOrderSlipMessage(delivery, shop, money, "21/10/2026", false);
    expect(msg).not.toContain("350");
    expect(msg).not.toContain("Total");
  });

  it("shows rate, amount and total with prices", () => {
    const html = buildOrderSlipHtml(delivery, shop, money, "21/10/2026", true);
    expect(html).toContain("350.00");
    expect(html).toContain("14,000.00");
    expect(buildOrderSlipMessage(delivery, shop, money, "21/10/2026", true)).toContain("*Total: PKR 14000.00*");
  });

  it("carries the bill, vehicle and driver on a delivery order", () => {
    const msg = buildOrderSlipMessage(delivery, shop, money, "21/10/2026", false);
    expect(msg).toContain("*DELIVERY ORDER DO-7*");
    expect(msg).toContain("Bill: 1001");
    expect(msg).toContain("Vehicle: LES-4521");
    expect(msg).toContain("Driver: Akram · 03111111111");
  });

  it("asks the supplier to send the goods on a purchase order", () => {
    const po: OrderSlipDto = { kind: "purchase", number: "PO-3", created_at: delivery.created_at, party_name: "Lahore Wholesale", party_phone: null, lines: delivery.lines, total: 0, notes: null, expected_date: "25/10/2026" };
    const msg = buildOrderSlipMessage(po, shop, money, "21/10/2026", false);
    expect(msg).toContain("Please send the following:");
    expect(msg).toContain("Needed by: 25/10/2026");
    expect(msg).toContain("1. LED bulb 12W — 40 pcs");
  });

  it("escapes what people type", () => {
    const html = buildOrderSlipHtml({ ...delivery, party_name: "<b>x</b>" }, shop, money, "d", false);
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
