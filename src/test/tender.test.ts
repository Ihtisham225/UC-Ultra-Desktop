import { describe, it, expect } from "vitest";
import { allocateTenders } from "@/lib/tender";

describe("allocateTenders", () => {
  it("splits a bill across accounts and leaves the rest owing", () => {
    // The case from the brief: 500 cash, 500 wallet, 500 on credit.
    const r = allocateTenders(1500, [
      { account_id: "cash", amount: 500 },
      { account_id: "wallet", amount: 500 },
    ]);
    expect(r.paid).toBe(1000);
    expect(r.owed).toBe(500);
    expect(r.change).toBe(0);
    expect(r.applied).toEqual([
      { account_id: "cash", amount: 500 },
      { account_id: "wallet", amount: 500 },
    ]);
  });

  it("credits the drawer only with the bill and returns the rest as change", () => {
    const r = allocateTenders(1500, [{ account_id: "cash", amount: 2000 }]);
    expect(r.paid).toBe(1500);
    expect(r.change).toBe(500);
    expect(r.applied).toEqual([{ account_id: "cash", amount: 1500 }]);
  });

  it("stops allocating once the bill is covered", () => {
    const r = allocateTenders(1500, [
      { account_id: "cash", amount: 1000 },
      { account_id: "wallet", amount: 900 },
    ]);
    expect(r.applied).toEqual([
      { account_id: "cash", amount: 1000 },
      { account_id: "wallet", amount: 500 },
    ]);
    expect(r.change).toBe(400);
    expect(r.owed).toBe(0);
  });

  it("never books more into accounts than the bill", () => {
    for (const [a, b] of [[900, 900], [1500, 1500], [10, 5000]]) {
      const r = allocateTenders(1500, [
        { account_id: "cash", amount: a },
        { account_id: "wallet", amount: b },
      ]);
      expect(r.applied.reduce((s, t) => s + t.amount, 0)).toBeLessThanOrEqual(1500);
    }
  });

  it("keeps decimals exact", () => {
    const r = allocateTenders(99.99, [
      { account_id: "cash", amount: 50 },
      { account_id: "wallet", amount: 49.99 },
    ]);
    expect(r.paid).toBe(99.99);
    expect(r.owed).toBe(0);
  });

  it("treats no tender as fully on credit", () => {
    const r = allocateTenders(1500, []);
    expect(r.paid).toBe(0);
    expect(r.owed).toBe(1500);
  });
});
