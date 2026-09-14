import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LedgerEntriesTable } from "@/components/LedgerEntriesLog";
import { PosShortcutsGuide } from "@/components/PosShortcutsGuide";

// Rendered with react-dom directly, like the other component tests here.
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = (el: ReactElement) => act(() => root.render(el));
const text = () => container.textContent ?? "";

describe("the ledger's payment history", () => {
  it("lists each entry with its account and the balance after it", () => {
    render(
      <LedgerEntriesTable
        debtAmount={18070}
        currency="PKR"
        payments={[
          { id: "a", kind: "payment", amount: 8070, discount: 0, payment_date: "2026-09-15", account_name: "Cash", notes: "first instalment" },
          { id: "b", kind: "payment", amount: 5000, discount: 0, payment_date: "2026-09-20", account_name: "UBL" },
        ]}
      />,
    );
    expect(text()).toContain("Opening amount");
    expect(text()).toContain("first instalment");
    expect(text()).toContain("UBL");
    // The last balance and "Remaining" agree: 18,070 − 8,070 − 5,000.
    expect(text()).toMatch(/Remaining\D*5,000/);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3); // opening + 2 entries
  });

  it("says plainly when nothing has been paid", () => {
    render(<LedgerEntriesTable debtAmount={18070} currency="PKR" payments={[]} />);
    expect(text()).toContain("No payments recorded yet.");
    expect(text()).toMatch(/Remaining\D*18,070/);
  });

  it("shows the load error instead of an empty table", () => {
    render(<LedgerEntriesTable debtAmount={1} currency="PKR" payments={null} error="Couldn't load the entries" />);
    expect(text()).toContain("Couldn't load the entries");
    expect(container.querySelector("table")).toBeNull();
  });
});

describe("Settings → Shortcuts", () => {
  it("lists every till shortcut, with no Alt keys", () => {
    render(<PosShortcutsGuide platform="desktop" />);
    for (const k of ["Ctrl+Enter", "Ctrl+P", "Ctrl+W", "Ctrl+N", "Ctrl+Shift+Backspace"]) expect(text()).toContain(k);
    expect(text()).not.toMatch(/Alt\+/);
    expect(text()).not.toContain("Desktop app only");
  });

  it("on the web, marks the two keys a browser keeps as desktop-only", () => {
    render(<PosShortcutsGuide platform="web" />);
    expect(text()).toContain("closes the tab");
    expect(text()).toContain("opens a new window");
    expect(text().match(/Desktop app only/g)).toHaveLength(2);
  });
});
