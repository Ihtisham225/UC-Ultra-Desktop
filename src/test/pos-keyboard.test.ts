import { describe, it, expect, beforeAll, vi } from "vitest";
import { matchPosShortcut, shortcutLabel } from "@/lib/pos-shortcuts";
import { orderSteps, stepsIn, advanceFrom, STEP } from "@/lib/checkout-keys";

/**
 * The till is driven from the keyboard: Enter walks the checkout, and four
 * shortcuts open checkout, print, send WhatsApp and start a new sale. These pin
 * the rules — including the shortcuts that were deliberately NOT taken.
 */

const key = (over: Partial<Parameters<typeof matchPosShortcut>[0]>) => ({
  key: "",
  code: "",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
});

describe("matchPosShortcut", () => {
  it("opens checkout on Ctrl+Enter, and Cmd+Enter on a Mac", () => {
    expect(matchPosShortcut(key({ key: "Enter", ctrlKey: true }))).toBe("checkout");
    expect(matchPosShortcut(key({ key: "Enter", metaKey: true }))).toBe("checkout");
  });

  it("prints on Ctrl+P / Cmd+P", () => {
    expect(matchPosShortcut(key({ key: "p", code: "KeyP", ctrlKey: true }))).toBe("print");
    expect(matchPosShortcut(key({ key: "p", code: "KeyP", metaKey: true }))).toBe("print");
  });

  it("matches Alt+W and Alt+N on Windows, where the key is the letter", () => {
    expect(matchPosShortcut(key({ key: "w", code: "KeyW", altKey: true }))).toBe("whatsapp");
    expect(matchPosShortcut(key({ key: "n", code: "KeyN", altKey: true }))).toBe("newSale");
  });

  it("still matches on a Mac, where Option+W types ∑ and Option+N is a dead key", () => {
    // `key` never says "w" or "n" there — only the physical `code` does.
    expect(matchPosShortcut(key({ key: "∑", code: "KeyW", altKey: true }))).toBe("whatsapp");
    expect(matchPosShortcut(key({ key: "Dead", code: "KeyN", altKey: true }))).toBe("newSale");
  });

  it("leaves copy, close-tab and save alone", () => {
    // Ctrl+C would stop anyone copying text on the till; Ctrl+W closes the tab
    // and can't be blocked; Ctrl+S means save. None of them may be claimed.
    expect(matchPosShortcut(key({ key: "c", code: "KeyC", ctrlKey: true }))).toBeNull();
    expect(matchPosShortcut(key({ key: "w", code: "KeyW", ctrlKey: true }))).toBeNull();
    expect(matchPosShortcut(key({ key: "s", code: "KeyS", ctrlKey: true }))).toBeNull();
  });

  it("ignores a plain Enter and near-miss combinations", () => {
    expect(matchPosShortcut(key({ key: "Enter" }))).toBeNull();
    expect(matchPosShortcut(key({ key: "p", code: "KeyP", altKey: true }))).toBeNull();
    expect(matchPosShortcut(key({ key: "P", code: "KeyP", ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(matchPosShortcut(key({ key: "w", code: "KeyW", altKey: true, ctrlKey: true }))).toBeNull();
  });

  it("labels each shortcut for the platform", () => {
    expect(shortcutLabel("checkout", false)).toBe("Ctrl+Enter");
    expect(shortcutLabel("checkout", true)).toBe("⌘↵");
    expect(shortcutLabel("whatsapp", false)).toBe("Alt+W");
    expect(shortcutLabel("newSale", true)).toBe("⌥N");
  });
});

describe("orderSteps", () => {
  it("orders by step number, then by position on the page", () => {
    const items = [
      { value: "notes", step: 6, index: 0 },
      { value: "customer", step: 1, index: 5 },
      { value: "km", step: 2, index: 3 },
      { value: "vehicle", step: 2, index: 1 },
    ];
    expect(orderSteps(items)).toEqual(["customer", "vehicle", "km", "notes"]);
  });

  it("drops anything without a usable step number", () => {
    expect(orderSteps([{ value: "x", step: NaN, index: 0 }, { value: "y", step: 3, index: 1 }])).toEqual(["y"]);
  });
});

describe("the Enter chain through checkout", () => {
  // jsdom lays nothing out, so offsetParent is always null and every field
  // would read as hidden. Treat display:none as hidden, everything else shown.
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      configurable: true,
      get() {
        return (this as HTMLElement).style.display === "none" ? null : (this as HTMLElement).parentElement;
      },
    });
  });

  const build = () => {
    const root = document.createElement("div");
    // Deliberately out of step order on the page: the account select sits
    // before the amount box, but Enter must still go amount → account.
    root.innerHTML = `
      <button id="customer" data-checkout-step="${STEP.customer}" data-checkout-picker></button>
      <button id="vehicle" data-checkout-step="${STEP.vehicle}" data-checkout-picker></button>
      <input id="km" data-checkout-step="${STEP.vehicle}" />
      <input id="discount" data-checkout-step="${STEP.discount}" />
      <button id="account" data-checkout-step="${STEP.account}"></button>
      <input id="amount" data-checkout-step="${STEP.amount}" />
      <input id="notes" data-checkout-step="${STEP.notes}" />`;
    document.body.appendChild(root);
    return root;
  };

  it("walks customer, vehicle, its fields, discount, amount, account, notes", () => {
    const root = build();
    expect(stepsIn(root).map((e) => e.id)).toEqual(["customer", "vehicle", "km", "discount", "amount", "account", "notes"]);
    root.remove();
  });

  it("moves to the next field on Enter, and reports the end of the chain", () => {
    const root = build();
    const $ = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
    expect(advanceFrom($("discount"), root)).toBe(true);
    expect(document.activeElement?.id).toBe("amount");
    expect(advanceFrom($("amount"), root)).toBe(true);
    expect(document.activeElement?.id).toBe("account");
    expect(advanceFrom($("notes"), root)).toBe(false);
    root.remove();
  });

  it("opens a dropdown step rather than just focusing it", () => {
    const root = build();
    const vehicle = root.querySelector<HTMLElement>("#vehicle")!;
    const clicked = vi.fn();
    vehicle.addEventListener("click", clicked);
    advanceFrom(root.querySelector("#customer")!, root);
    expect(document.activeElement).toBe(vehicle);
    expect(clicked).toHaveBeenCalledTimes(1);
    root.remove();
  });

  it("skips a field that is disabled or hidden", () => {
    const root = build();
    (root.querySelector("#km") as HTMLInputElement).disabled = true;
    (root.querySelector("#discount") as HTMLElement).style.display = "none";
    advanceFrom(root.querySelector("#vehicle")!, root);
    expect(document.activeElement?.id).toBe("amount");
    root.remove();
  });
});
