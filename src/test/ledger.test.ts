import { describe, it, expect } from "vitest";
import { derivePaidAmount } from "@/lib/ledger";

/**
 * The offline khata shows a balance derived from the local settlements, and
 * the server recomputes the same figure when they are pushed. If these two
 * rules ever drift, a shop sees one number at the counter and a different one
 * after syncing — so the rule is pinned here.
 */
describe("derivePaidAmount", () => {
  it("counts cash and written-off discount together", () => {
    expect(
      derivePaidAmount([
        { kind: "payment", amount: 500, discount: 0 },
        { kind: "payment", amount: 300, discount: 200 },
      ]),
    ).toBe(1000);
  });

  it("ignores 'increase' entries — they raise the principal, they don't clear it", () => {
    expect(
      derivePaidAmount([
        { kind: "payment", amount: 500, discount: 0 },
        { kind: "increase", amount: 900, discount: 0 },
      ]),
    ).toBe(500);
  });

  it("treats a missing kind as a payment, the way the column defaults", () => {
    expect(derivePaidAmount([{ amount: 250 }])).toBe(250);
  });

  it("survives null and string amounts off an IndexedDB row", () => {
    expect(
      derivePaidAmount([
        { kind: "payment", amount: "120.50", discount: null },
        { kind: "payment", amount: null, discount: "9.50" },
      ]),
    ).toBe(130);
  });

  it("rounds to two places rather than trailing float noise", () => {
    // 0.1 + 0.2 is 0.30000000000000004; a khata must never show that.
    expect(
      derivePaidAmount([
        { kind: "payment", amount: 0.1, discount: 0 },
        { kind: "payment", amount: 0.2, discount: 0 },
      ]),
    ).toBe(0.3);
  });

  it("is zero for a khata with nothing against it", () => {
    expect(derivePaidAmount([])).toBe(0);
  });
});
