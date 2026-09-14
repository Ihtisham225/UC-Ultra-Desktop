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

describe("the ledger's account history", () => {
  const bills = [
    { id: "ord214", amount: 18070, created_at: "2026-09-13T09:00:00", label: "Bill ORD-214" },
    { id: "ord215", amount: 1700, created_at: "2026-09-14T09:00:00", label: "Bill ORD-215" },
  ];

  it("lists every bill and payment for the person, with the balance after each", () => {
    render(
      <LedgerEntriesTable
        debts={bills}
        currency="PKR"
        payments={[
          { id: "a", debt_id: "ord214", kind: "payment", amount: 8070, discount: 0, payment_date: "2026-09-15", account_name: "Cash", notes: "first instalment" },
          { id: "b", debt_id: "ord215", kind: "payment", amount: 1700, discount: 0, payment_date: "2026-09-20", account_name: "UBL" },
        ]}
      />,
    );
    expect(text()).toContain("Bill ORD-214");
    expect(text()).toContain("Bill ORD-215");
    expect(text()).toContain("first instalment");
    expect(text()).toContain("UBL");
    // 18,070 + 1,700 − 8,070 − 1,700.
    expect(text()).toMatch(/Remaining\D*10,000/);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(4); // 2 bills + 2 payments
  });

  it("shows the bills even when nothing has been paid", () => {
    render(<LedgerEntriesTable debts={bills} currency="PKR" payments={[]} />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(text()).toMatch(/Remaining\D*19,770/);
  });

  it("shows the load error instead of an empty table", () => {
    render(<LedgerEntriesTable debts={bills} currency="PKR" payments={null} error="Couldn't load the entries" />);
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
