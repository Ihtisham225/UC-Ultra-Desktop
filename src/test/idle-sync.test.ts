import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ACTIVE_MS, IDLE_AFTER_MS, QUIET_AFTER_MS, QUIET_MS, nextSyncDelay } from "@/lib/syncSchedule";

// Every pull keeps the shared Neon database awake, so the till syncs often only
// while it is being used, slows down when quiet and stops when idle, hidden,
// locked or asleep — and catches up the moment someone comes back.

describe("nextSyncDelay", () => {
  const base = { now: 1_000_000_000, hidden: false, away: false };
  const at = (quietFor: number) => nextSyncDelay({ ...base, lastActivity: base.now - quietFor });

  it("syncs at the active pace while the till is in use", () => {
    expect(at(0)).toBe(ACTIVE_MS);
    expect(at(QUIET_AFTER_MS - 1)).toBe(ACTIVE_MS);
  });
  it("slows down once nobody has touched it for a while", () => {
    expect(at(QUIET_AFTER_MS)).toBe(QUIET_MS);
    expect(at(IDLE_AFTER_MS - 1)).toBe(QUIET_MS);
  });
  it("stops when idle, hidden or the computer is away", () => {
    expect(at(IDLE_AFTER_MS)).toBeNull();
    expect(nextSyncDelay({ ...base, lastActivity: base.now, hidden: true })).toBeNull();
    expect(nextSyncDelay({ ...base, lastActivity: base.now, away: true })).toBeNull();
  });
});

const pull = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  getToken: () => "device-token",
  syncPush: async () => ({ results: [] }),
  syncPull: (...a: unknown[]) => pull(...a),
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

const MIN = 60_000;
let visibility: DocumentVisibilityState = "visible";
let power: ((s: "lock" | "unlock" | "suspend" | "resume") => void) | null = null;

describe("the background sync loop", () => {
  let stop: (() => void) | undefined;
  const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);
  const pulls = () => pull.mock.calls.length;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    pull.mockReset();
    pull.mockResolvedValue({ changes: {}, serverTime: "" });
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
    power = null;
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      onPowerState: (cb: typeof power) => { power = cb; return () => { power = null; }; },
    };
    const { startSyncLoop } = await import("@/lib/syncEngine");
    stop = startSyncLoop(() => "shop-1");
    await advance(0);
  });
  afterEach(() => {
    stop?.();
    vi.useRealTimers();
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  it("syncs on start and every minute while in use", async () => {
    expect(pulls()).toBe(1);
    window.dispatchEvent(new KeyboardEvent("keydown"));
    await advance(MIN);
    expect(pulls()).toBe(2);
  });

  it("slows to every 15 minutes when quiet, then stops entirely", async () => {
    await advance(5 * MIN); // quiet from here
    const quietStart = pulls();
    await advance(25 * MIN); // up to the 30-minute idle mark
    expect(pulls() - quietStart).toBeLessThanOrEqual(2);
    const idle = pulls();
    await advance(12 * 60 * MIN); // a whole night
    expect(pulls()).toBe(idle);
  });

  it("catches up the moment someone comes back", async () => {
    await advance(2 * 60 * MIN);
    const before = pulls();
    window.dispatchEvent(new MouseEvent("pointerdown"));
    await advance(0);
    expect(pulls()).toBe(before + 1);
    await advance(MIN);
    expect(pulls()).toBe(before + 2); // back at the active pace
  });

  it("pauses while minimised and catches up when shown", async () => {
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    const before = pulls();
    await advance(60 * MIN);
    expect(pulls()).toBe(before);
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await advance(0);
    expect(pulls()).toBe(before + 1);
  });

  it("pauses while the computer is locked and catches up on unlock", async () => {
    power!("lock");
    const before = pulls();
    await advance(60 * MIN);
    expect(pulls()).toBe(before);
    power!("unlock");
    await advance(0);
    expect(pulls()).toBe(before + 1);
  });

  it("sends this till's own writes within seconds, even while paused", async () => {
    await advance(2 * 60 * MIN); // idle
    const before = pulls();
    const { announceQueued } = await import("@/lib/queueSignal");
    announceQueued();
    announceQueued(); // a burst sends once
    await advance(2_500);
    expect(pulls()).toBe(before + 1);
  });
});
