import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NotificationBell, setNotificationsLoader } from "@/components/NotificationBell";

// The bell asks the server at most once per shop per local day: frequent
// polling kept the Neon database from ever suspending.
const item = (id: string) => ({ id, kind: "low_stock" as const, severity: "warning" as const, title: id, href: "/" });

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
function render(ui: React.ReactElement) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root!.render(ui));
}
function cleanup() {
  if (root) act(() => root!.unmount());
  root = null;
}

async function flush() {
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
}

describe("NotificationBell — once a day", () => {
  let loader: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "Date"] });
    vi.setSystemTime(new Date(2026, 10, 3, 9, 0));
    loader = vi.fn(async () => [item("a")]);
    setNotificationsLoader(loader as never);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("fetches on the first open of the day, then never again that day", async () => {
    render(<NotificationBell shopId="s1" navigate={() => {}} />);
    await flush();
    expect(loader).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 3; i++) { window.dispatchEvent(new Event("focus")); await flush(); }
    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 60_000); });
    expect(loader).toHaveBeenCalledTimes(1);
    cleanup();
    render(<NotificationBell shopId="s1" navigate={() => {}} />); // app reopened same day
    await flush();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("left open overnight, checks again on focus once the date changes", async () => {
    render(<NotificationBell shopId="s1" navigate={() => {}} />);
    await flush();
    vi.setSystemTime(new Date(2026, 10, 4, 8, 0));
    window.dispatchEvent(new Event("focus")); await flush();
    window.dispatchEvent(new Event("focus")); await flush();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("caches per shop", async () => {
    render(<NotificationBell shopId="s1" navigate={() => {}} />);
    await flush();
    cleanup();
    render(<NotificationBell shopId="s2" navigate={() => {}} />);
    await flush();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("retries on the next focus after a failed (offline) fetch", async () => {
    loader.mockRejectedValueOnce(new Error("offline"));
    render(<NotificationBell shopId="s1" navigate={() => {}} />);
    await flush();
    window.dispatchEvent(new Event("focus")); await flush();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
