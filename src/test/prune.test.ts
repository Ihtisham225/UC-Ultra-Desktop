import { describe, it, expect, vi, beforeEach } from "vitest";
import { staleIds } from "@/lib/prune";

/**
 * NIAZ OIL's catalogue was re-imported under fresh ids. The pull is upsert-only,
 * so every till kept the old product rows beside the new ones: each product
 * showed twice, and a sale rung up against the stale card was pushed for an id
 * the server did not have — 47 lines whose stock never came off the real
 * product. These pin the reconciliation that removes them.
 */

const SHOP = "shop-niaz";
const OTHER = "shop-other";
const set = (...xs: string[]) => new Set(xs);

describe("staleIds — which cached catalogue rows to drop", () => {
  it("drops the stale copy of a re-imported product and keeps the live one", () => {
    // The exact shape on the till: one product, cached under its old and new id.
    const rows = [
      { id: "old-loc", shop_id: SHOP },
      { id: "new-loc", shop_id: SHOP },
    ];
    expect(staleIds(rows, SHOP, set("new-loc"), set())).toEqual(["old-loc"]);
  });

  it("keeps every row the server still has", () => {
    const rows = [{ id: "a", shop_id: SHOP }, { id: "b", shop_id: SHOP }];
    expect(staleIds(rows, SHOP, set("a", "b"), set())).toEqual([]);
  });

  it("never drops a row still waiting to be pushed", () => {
    // Created offline: not on the server yet, so absent from the live set by
    // definition. Dropping it would lose work the counter has not synced.
    const rows = [{ id: "made-offline", shop_id: SHOP }];
    expect(staleIds(rows, SHOP, set(), set("made-offline"))).toEqual([]);
  });

  it("never touches another shop's catalogue", () => {
    // The live ids describe the device token's shop alone. Pruning across
    // shops would wipe the other shop's products off a till that holds both.
    const rows = [{ id: "theirs", shop_id: OTHER }];
    expect(staleIds(rows, SHOP, set(), set())).toEqual([]);
  });

  it("empties this shop's catalogue when the server genuinely has none", () => {
    // An empty live set is an answer, not a failure — the server sends it only
    // when the query succeeded.
    const rows = [{ id: "a", shop_id: SHOP }, { id: "b", shop_id: SHOP }];
    expect(staleIds(rows, SHOP, set(), set())).toEqual(["a", "b"]);
  });

  it("ignores rows with no usable id", () => {
    const rows = [{ shop_id: SHOP }, { id: 42, shop_id: SHOP }, { id: "", shop_id: SHOP }];
    expect(staleIds(rows as never, SHOP, set(), set())).toEqual([]);
  });
});

// ─── The wiring in pullAll ───────────────────────────────────────────────────

const syncPull = vi.fn();
const pruneLocalRows = vi.fn();
const notifyChange = vi.fn();
let queued: { table: string; recordId: string }[] = [];

vi.mock("@/lib/apiClient", () => ({
  getToken: () => "device-token",
  syncPush: async () => ({ results: [], pulled: {} }),
  syncPull: (...a: unknown[]) => syncPull(...a),
}));

vi.mock("@/lib/localDb", () => ({
  SYNC_TABLES: ["products", "product_variants"],
  purgeLocalChildren: async () => {},
  pruneLocalRows: (...a: unknown[]) => pruneLocalRows(...a),
  getAllQueued: async () => queued,
  removeFromQueue: async () => {},
  bulkUpsertLocal: async () => {},
  getLastPulledAt: async () => null,
  setLastPulledAt: async () => {},
  notifyChange: (...a: unknown[]) => notifyChange(...a),
}));

describe("pullAll reconciles the catalogue", () => {
  beforeEach(() => {
    syncPull.mockReset();
    pruneLocalRows.mockReset();
    notifyChange.mockReset();
    queued = [];
  });

  it("prunes each table against the live ids, for the server's shop", async () => {
    syncPull.mockResolvedValue({
      changes: {},
      serverTime: "2026-09-13T00:00:00Z",
      liveShopId: SHOP,
      liveIds: { products: ["p1", "p2"], product_variants: ["v1"] },
    });
    pruneLocalRows.mockResolvedValue(0);
    const { pullAll } = await import("@/lib/syncEngine");
    await pullAll();

    expect(pruneLocalRows).toHaveBeenCalledTimes(2);
    const [table, shop, live] = pruneLocalRows.mock.calls.find((c) => c[0] === "products")!;
    expect(table).toBe("products");
    expect(shop).toBe(SHOP);
    expect([...(live as Set<string>)].sort()).toEqual(["p1", "p2"]);
  });

  it("keeps queued rows — but only the queue entries for that table", async () => {
    queued = [
      { table: "products", recordId: "p-offline" },
      { table: "product_variants", recordId: "v-offline" },
    ];
    syncPull.mockResolvedValue({
      changes: {},
      serverTime: "t",
      liveShopId: SHOP,
      liveIds: { products: [], product_variants: [] },
    });
    pruneLocalRows.mockResolvedValue(0);
    const { pullAll } = await import("@/lib/syncEngine");
    await pullAll();

    const keepFor = (t: string) =>
      [...(pruneLocalRows.mock.calls.find((c) => c[0] === t)![3] as Set<string>)];
    expect(keepFor("products")).toEqual(["p-offline"]);
    expect(keepFor("product_variants")).toEqual(["v-offline"]);
  });

  it("prunes nothing against an older server that sends no live ids", async () => {
    // A terminal on this build talking to a server that predates the change
    // must behave exactly as before, rather than reading "no ids" as "no rows".
    syncPull.mockResolvedValue({ changes: {}, serverTime: "t" });
    const { pullAll } = await import("@/lib/syncEngine");
    await pullAll();
    expect(pruneLocalRows).not.toHaveBeenCalled();
  });

  it("refreshes a screen only when something was actually removed", async () => {
    syncPull.mockResolvedValue({
      changes: {},
      serverTime: "t",
      liveShopId: SHOP,
      liveIds: { products: ["p1"], product_variants: ["v1"] },
    });
    pruneLocalRows.mockImplementation(async (t: string) => (t === "products" ? 3 : 0));
    const { pullAll } = await import("@/lib/syncEngine");
    await pullAll();
    expect(notifyChange).toHaveBeenCalledWith("products");
    expect(notifyChange).not.toHaveBeenCalledWith("product_variants");
  });
});
