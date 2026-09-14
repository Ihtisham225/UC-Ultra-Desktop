import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A shop owner deleted their store from the terminal and was left on a white
 * screen. The session still listed the dead store (re-opening it was refused
 * with 403 and the error swallowed), and the app then navigated with
 * `window.location.href`, which under Electron's HashRouter loads a file that
 * doesn't exist. These pin how the terminal now leaves a deleted store.
 */

const switchShop = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  switchShop: (...a: unknown[]) => switchShop(...a),
  getDeviceSession: vi.fn(),
  logout: vi.fn(),
  setToken: vi.fn(),
}));

import { sessionWithoutShop, leaveDeletedShop, getSession, type StoredSession } from "@/lib/deviceSession";

const shop = (id: string) => ({ id, name: `Shop ${id}` }) as StoredSession["shops"][number];
const session = (over: Partial<StoredSession> = {}): StoredSession => ({
  token: "tok",
  user: { id: "u" } as StoredSession["user"],
  currentShopId: "dead",
  shops: [shop("dead"), shop("alive")],
  permissionsByShop: { dead: ["sales:view"], alive: ["sales:view"] },
  ...over,
});

describe("sessionWithoutShop", () => {
  it("drops the deleted store and moves to the one left", () => {
    const next = sessionWithoutShop(session(), "dead");
    expect(next.shops.map((s) => s.id)).toEqual(["alive"]);
    expect(next.currentShopId).toBe("alive");
    expect(next.permissionsByShop).toEqual({ alive: ["sales:view"] });
  });

  it("keeps the current store when a different one was deleted", () => {
    const next = sessionWithoutShop(session({ currentShopId: "alive" }), "dead");
    expect(next.currentShopId).toBe("alive");
  });

  it("leaves no current store when none is left, which sends the terminal to onboarding", () => {
    const next = sessionWithoutShop(session({ shops: [shop("dead")] }), "dead");
    expect(next.shops).toEqual([]);
    expect(next.currentShopId).toBe("");
  });
});

describe("leaveDeletedShop", () => {
  beforeEach(() => {
    switchShop.mockReset();
    localStorage.clear();
  });
  const save = (s: StoredSession) => localStorage.setItem("ucu.device.session", JSON.stringify(s));

  it("gets a fresh token for the store left, and says to go home", async () => {
    save(session());
    switchShop.mockResolvedValue({ token: "new", currentShopId: "alive", shops: [shop("alive")], permissionsByShop: {} });
    expect(await leaveDeletedShop("dead")).toBe("/");
    expect(switchShop).toHaveBeenCalledWith("alive");
    expect(getSession()?.shops.map((s) => s.id)).toEqual(["alive"]);
  });

  it("never tries to re-open the deleted store", async () => {
    // That call is what came back 403 and left the session pointing at nothing.
    save(session());
    switchShop.mockResolvedValue({ token: "new", currentShopId: "alive", shops: [shop("alive")], permissionsByShop: {} });
    await leaveDeletedShop("dead");
    expect(switchShop).not.toHaveBeenCalledWith("dead");
  });

  it("says to go to onboarding when no store is left, without asking the server", async () => {
    save(session({ shops: [shop("dead")] }));
    expect(await leaveDeletedShop("dead")).toBe("/onboarding");
    expect(switchShop).not.toHaveBeenCalled();
    expect(getSession()?.shops).toEqual([]);
  });

  it("still leaves the dead store behind when the switch fails offline", async () => {
    save(session());
    switchShop.mockRejectedValue(new Error("offline"));
    expect(await leaveDeletedShop("dead")).toBe("/");
    expect(getSession()?.shops.map((s) => s.id)).toEqual(["alive"]);
  });
});
