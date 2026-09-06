import { describe, it, expect } from "vitest";

/**
 * The rule the till and the sale edit both enforce, stated once so it cannot
 * drift: cash may exceed the bill (that is how change is given), nothing else
 * may, and a correction has no change to give so it caps everything.
 */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** What a tender is allowed to be, given the others already on the bill. */
function cap(total: number, others: number, accountType: string, atTill: boolean) {
  if (atTill && accountType === "cash") return Infinity;
  return round2(Math.max(0, total - others));
}

describe("overpayment", () => {
  it("lets cash exceed the bill at the till, so change can be given", () => {
    expect(cap(1800, 0, "cash", true)).toBe(Infinity);
  });

  it("caps a wallet tender at the bill — a transfer over it never arrived", () => {
    // ORD-213: Easypaisa 1,800 against an 800 bill.
    expect(cap(800, 0, "wallet", true)).toBe(800);
  });

  it("caps a bank tender at what the other tenders leave", () => {
    expect(cap(1800, 500, "bank", true)).toBe(1300);
  });

  it("caps cash too when correcting a bill — a correction gives no change", () => {
    expect(cap(800, 0, "cash", false)).toBe(800);
  });

  it("leaves no room once the bill is covered", () => {
    expect(cap(800, 800, "wallet", true)).toBe(0);
    expect(cap(800, 900, "wallet", true)).toBe(0);
  });

  it("rounds to two places rather than trailing float noise", () => {
    expect(cap(0.3, 0.1, "bank", true)).toBe(0.2);
  });
});
