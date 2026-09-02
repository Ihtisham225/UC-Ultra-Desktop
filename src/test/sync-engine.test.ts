import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The till asks for the server-issued order number straight after a sale, so
 * the sync it awaits has to have actually pushed that sale.
 *
 * syncAll() deliberately skips when the 30s background loop is mid-sync. That
 * is right for the loop and wrong for anyone whose next step needs their rows
 * on the server: they carried on against a sale that had never been pushed,
 * the server said it did not exist, and the slip kept its provisional code
 * while the Sales page — reading the row the later pull corrected — showed the
 * real number. These pin the difference between the two.
 */

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
}));

/** Let every pending microtask (and the macrotask queue) drain. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
};

describe("syncEngine concurrency", () => {
  beforeEach(() => {
    vi.resetModules();
    pushAll.mockReset();
    pullAll.mockReset();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });

  it("syncAll skips while one is already running", async () => {
    const gate = deferred();
    pullAll.mockImplementation(() => gate.promise.then(() => ({})));
    const { syncAll } = await import("@/lib/syncEngine");

    const first = syncAll();
    await flush();
    const second = syncAll();      // the background loop, mid-sync
    await second;                  // returns at once, without its own pull

    expect(pullAll).toHaveBeenCalledTimes(1);
    gate.resolve();
    await first;
  });

  it("syncNow waits for the in-flight sync and then runs its own", async () => {
    const gate = deferred();
    pullAll.mockImplementationOnce(() => gate.promise.then(() => ({})));
    pullAll.mockImplementation(async () => ({}));
    const { syncAll, syncNow } = await import("@/lib/syncEngine");

    const background = syncAll();
    await flush();

    let settled = false;
    const waiting = syncNow().then(() => { settled = true; });

    // It must not resolve while the first sync is still going: that is exactly
    // the moment the old code returned and the caller raced ahead.
    await flush();
    expect(settled).toBe(false);

    gate.resolve();
    await background;
    await waiting;

    expect(settled).toBe(true);
    // Its own run, after the one it waited on.
    expect(pullAll).toHaveBeenCalledTimes(2);
  });

  it("does nothing when offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { syncAll, syncNow } = await import("@/lib/syncEngine");
    await syncAll();
    await syncNow();
    expect(pullAll).not.toHaveBeenCalled();
  });
});
