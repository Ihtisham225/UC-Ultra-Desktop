import { describe, it, expect } from "vitest";
import { computePnl, pnlStatement } from "@/lib/pnl";

// The client's screenshot: 573,100 before discounts, 571,370 billed, no tax,
// 505,990 cost of goods, 1,000 expenses, 5,000 salaries. The old P&L said gross
// 67,110 (it ignored the 1,730 of discounts) and Analytics said net 565,370 (it
// forgot the cost of goods altogether).
describe("computePnl", () => {
  const screenshot = computePnl({
    sales: [{ subtotal: 573100, tax: 0, total: 571370, items: [{ product_id: "p", quantity: 505990 }] }],
    returns: [],
    purchaseItems: [{ product_id: "p", quantity: 1, unit_cost: 1 }],
    expenses: 1000,
    payroll: 5000,
  });

  it("takes discounts off before working out profit", () => {
    expect(screenshot.discounts).toBe(1730);
    expect(screenshot.netSales).toBe(571370);
    expect(screenshot.grossProfit).toBe(65380);
    expect(screenshot.margin).toBe(11.4);
  });

  it("net profit is gross profit less expenses and salaries — never revenue less expenses", () => {
    expect(screenshot.overheads).toBe(6000);
    expect(screenshot.netProfit).toBe(59380);
  });

  it("takes tax out of net sales", () => {
    const p = computePnl({
      sales: [{ subtotal: 1000, tax: 170, total: 1170, items: [] }],
      returns: [], purchaseItems: [], expenses: 0,
    });
    expect(p.billed).toBe(1170);
    expect(p.netSales).toBe(1000);
  });

  it("takes a return's refund off sales and its goods' cost off COGS", () => {
    const p = computePnl({
      sales: [{ subtotal: 1000, tax: 0, total: 1000, items: [{ product_id: "p", quantity: 10 }] }],
      returns: [{ total_refund: 200, items: [{ product_id: "p", quantity: 2 }] }],
      // 10 bought at 60 plus 100 transport → landed cost 70 each.
      purchaseItems: [{ product_id: "p", quantity: 10, unit_cost: 60, expense_amount: 100 }],
      expenses: 0,
    });
    expect(p.netSales).toBe(800);
    expect(p.cogsSold).toBe(700);
    expect(p.cogsReturned).toBe(140);
    expect(p.grossProfit).toBe(800 - 560);
  });

  it("costs variants separately from their product", () => {
    const p = computePnl({
      sales: [{ subtotal: 0, tax: 0, total: 0, items: [{ product_id: "p", variant_id: "big", quantity: 1 }] }],
      returns: [],
      purchaseItems: [
        { product_id: "p", variant_id: "small", quantity: 1, unit_cost: 10 },
        { product_id: "p", variant_id: "big", quantity: 1, unit_cost: 90 },
      ],
      expenses: 0,
    });
    expect(p.cogs).toBe(90);
  });

  it("flags goods with no purchase price, but not services", () => {
    const p = computePnl({
      sales: [{ subtotal: 300, tax: 0, total: 300, items: [
        { product_id: "never-bought", quantity: 1, line_total: 200 },
        { product_id: "lab-test", quantity: 1, line_total: 100 },
      ] }],
      returns: [], purchaseItems: [], expenses: 0,
      serviceIds: new Set(["lab-test"]),
    });
    expect(p.uncosted).toEqual({ lines: 1, salesValue: 200 });
  });

  it("the statement adds up to its own net profit", () => {
    const lines = pnlStatement(screenshot);
    expect(lines[lines.length - 1]).toMatchObject({ label: "Net profit", value: 59380 });
    expect(lines.map((l) => l.label)).toContain("Discounts given");
  });
});
