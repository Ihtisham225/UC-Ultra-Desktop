import { describe, it, expect, vi, beforeEach } from "vitest";
import { isReadOnlyAction } from "@/lib/serverWrites";
import { orphanIds } from "@/lib/prune";

/**
 * A save made through the server (a purchase, a return, a cheque) changes rows
 * the offline store also holds — the supplier's khata, the stock, the account.
 * They used to reach the store only on the next 30s background sync, often
 * later, so the shop saw a purchase saved and its ledger unchanged for minutes
 * and thought it had failed. These pin the fix: every write pulls at once.
 */

describe("which server actions count as writes", () => {
  it("treats saves, deletes and payments as writes", () => {
    for (const a of [
      "createPurchaseAction", "updatePurchaseAction", "deletePurchaseAction",
      "createStandaloneReturnAction", "takeChequeAction", "createPersonLedgerEntryAction",
      "saveExpenseAction", "deleteExpenseAction", "updateSaleAction", "setStaffSalaryAction",
    ]) expect(isReadOnlyAction(a), a).toBe(false);
  });
  it("leaves plain reads alone", () => {
    for (const a of [
      "listPurchasesAction", "getPurchaseDetailAction", "loadPosProductsAction",
      "searchPurchaseItemsAction", "findDuplicatePartiesAction", "exportTableAction",
      "adminListShopsAction", "vehicleHistoryAction", "lastVisitAction",
    ]) expect(isReadOnlyAction(a), a).toBe(true);
  });
  it("an unknown name counts as a write — a spare sync is cheap, a missed one is the bug", () => {
    expect(isReadOnlyAction("somethingNewAction")).toBe(false);
  });
});

describe("lines of a purchase deleted on the server", () => {
  const rows = [
    { id: "i1", shop_id: "s1", purchase_id: "p-live" },
    { id: "i2", shop_id: "s1", purchase_id: "p-gone" },
    { id: "i3", shop_id: "s1", purchase_id: "p-queued" },
    { id: "i4", shop_id: "s2", purchase_id: "p-gone" },
  ];
  it("go with it — but never another shop's, and never a purchase still queued", () => {
    expect(orphanIds(rows, "purchase_id", "s1", new Set(["p-live"]), new Set(["p-queued"]))).toEqual(["i2"]);
  });
});

const pushAll = vi.fn();
const pullAll = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  getToken: () => "device-token",
  syncPush: (...a: unknown[]) => pushAll(...a),
  syncPull: (...a: unknown[]) => pullAll(...a),
}));
vi.mock("@/lib/localDb", () => ({
  SYNC_TABLES: [],
  getAllQueued: async () => [],
  removeFromQueue: async () => {},
  bulkUpsertLocal: async () => {},
  getLastPulledAt: async () => null,
  setLastPulledAt: async () => {},
  notifyChange: () => {},
  purgeLocalChildren: async () => {},
  pruneLocalRows: async () => 0,
  pruneOrphanChildren: async () => 0,
}));

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("a server write pulls straight away", () => {
  beforeEach(() => {
    vi.resetModules();
    pullAll.mockReset();
    pullAll.mockResolvedValue({ changes: {}, serverTime: "" });
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });

  it("syncs within a moment of a write, once for a burst of writes", async () => {
    const { startSyncLoop } = await import("@/lib/syncEngine");
    const { announceServerWrite } = await import("@/lib/serverWrites");
    const stop = startSyncLoop(() => "shop-1", 60_000)!;
    await wait(20);
    pullAll.mockClear(); // the loop's own first run

    announceServerWrite("createPurchaseAction");
    announceServerWrite("createPurchaseAction");
    announceServerWrite("takeChequeAction");
    await wait(300);
    expect(pullAll).toHaveBeenCalledTimes(1);

    announceServerWrite("listPurchasesAction"); // a read
    await wait(300);
    expect(pullAll).toHaveBeenCalledTimes(1);
    stop();
  });

  it("is not swallowed by a sync already in flight", async () => {
    let release!: () => void;
    const slow = new Promise<void>((r) => { release = r; });
    const { startSyncLoop } = await import("@/lib/syncEngine");
    const { announceServerWrite } = await import("@/lib/serverWrites");
    pullAll.mockImplementationOnce(() => slow.then(() => ({ changes: {}, serverTime: "" })));
    const stop = startSyncLoop(() => "shop-1", 60_000)!; // starts a slow sync
    await wait(20);
    announceServerWrite("createPurchaseAction");
    await wait(300);
    expect(pullAll).toHaveBeenCalledTimes(1); // still waiting on the slow one
    release();
    await wait(50);
    expect(pullAll).toHaveBeenCalledTimes(2); // then pulls again, after the write
    stop();
  });
});
