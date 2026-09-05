import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The screen that writes a row has to see its own change.
 *
 * BroadcastChannel deliberately does not deliver a message back to the context
 * that posted it, and the app holds one channel for the whole window — so
 * relying on it alone meant a page that saved a ledger entry, a payment or a
 * purchase went on showing the old list until someone reloaded it by hand.
 */

vi.mock("idb", () => ({ openDB: vi.fn() }));

describe("local change notification", () => {
  beforeEach(() => vi.resetModules());

  it("calls a subscriber in the same context that fired the change", async () => {
    const { notifyChange, onLocalChange } = await import("@/lib/localDb");
    const seen: string[] = [];
    const off = onLocalChange((t) => seen.push(t));

    notifyChange("debts");
    notifyChange("debt_payments");

    expect(seen).toEqual(["debts", "debt_payments"]);
    off();
  });

  it("stops calling a subscriber once it unsubscribes", async () => {
    const { notifyChange, onLocalChange } = await import("@/lib/localDb");
    const seen: string[] = [];
    const off = onLocalChange((t) => seen.push(t));
    notifyChange("purchases");
    off();
    notifyChange("purchases");
    expect(seen).toEqual(["purchases"]);
  });

  it("keeps telling the others when one subscriber throws", async () => {
    const { notifyChange, onLocalChange } = await import("@/lib/localDb");
    const seen: string[] = [];
    const offBad = onLocalChange(() => { throw new Error("bad subscriber"); });
    const offGood = onLocalChange((t) => seen.push(t));

    expect(() => notifyChange("sales")).not.toThrow();
    expect(seen).toEqual(["sales"]);
    offBad();
    offGood();
  });
});
