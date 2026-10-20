import { describe, expect, it } from "vitest";
import { Package } from "lucide-react";
import type { NavPage } from "@/lib/app-nav";
import { moveItem, navOrderFrom, normalizeNavOrder, orderedNav } from "@/lib/nav-order";

const page = (to: string, section: NavPage["section"]): NavPage => ({ to, label: to, icon: Package, section });
const pages = [
  page("/dashboard", "Overview"), page("/analytics", "Overview"), page("/reports", "Overview"),
  page("/pos", "Selling"), page("/sales", "Selling"),
  page("/expenses", "Money"), page("/debts", "Money"),
];
const shape = (groups: ReturnType<typeof orderedNav>) => groups.map((g) => `${g.section}:${g.items.map((p) => p.to).join(",")}`);

describe("orderedNav — the shop's sidebar order", () => {
  it("is the default order when nothing is saved", () => {
    expect(shape(orderedNav(pages, null))).toEqual(["Overview:/dashboard,/analytics,/reports", "Selling:/pos,/sales", "Money:/expenses,/debts"]);
  });

  it("follows a saved group and page order", () => {
    const order = { sections: ["Money", "Overview", "Selling"] as const, pages: { Overview: ["/reports", "/dashboard", "/analytics"] } };
    expect(shape(orderedNav(pages, { sections: [...order.sections], pages: order.pages }))).toEqual([
      "Money:/expenses,/debts", "Overview:/reports,/dashboard,/analytics", "Selling:/pos,/sales",
    ]);
  });

  it("keeps a page the saved order never saw, in its default place after the arranged ones", () => {
    const order = { sections: [], pages: { Overview: ["/reports", "/dashboard"] } };
    expect(shape(orderedNav(pages, order))[0]).toBe("Overview:/reports,/dashboard,/analytics");
  });

  it("never shows a page the person can't open, even if the saved order names it", () => {
    const order = { sections: [], pages: { Money: ["/payroll", "/debts", "/expenses"] } };
    expect(shape(orderedNav(pages, order))[2]).toBe("Money:/debts,/expenses");
  });

  it("round-trips through what the editor saves", () => {
    const groups = orderedNav(pages, null);
    const moved = moveItem(groups, 2, 0);
    expect(shape(orderedNav(pages, navOrderFrom(moved)))).toEqual(shape(moved));
  });
});

describe("normalizeNavOrder", () => {
  it("drops junk and unknown groups, and reads empty as the default", () => {
    expect(normalizeNavOrder(null)).toBeNull();
    expect(normalizeNavOrder({ sections: ["Nope"], pages: { Nope: ["/x"] } })).toBeNull();
    expect(normalizeNavOrder({ sections: ["Money", "Money", 3], pages: { Money: ["/debts", "nope", 4] } }))
      .toEqual({ sections: ["Money"], pages: { Money: ["/debts"] } });
  });
});
