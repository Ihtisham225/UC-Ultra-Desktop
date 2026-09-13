import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

// The paper lives beside the dialog, whose other imports reach the network and
// the shop session. The paper needs none of them.
vi.mock("@/lib/apiClient", () => ({ rpc: vi.fn() }));
vi.mock("@/lib/printThermal", () => ({ printThermalHtml: vi.fn() }));
vi.mock("@/contexts/ShopContext", () => ({ useShop: () => ({ currentShop: null }) }));
vi.mock("react-router-dom", () => ({ Link: () => null }));

import { ReceiptPaper } from "@/components/ReceiptDialog";
import { ReceiptPreview } from "@/components/ReceiptPreview";

/**
 * What the counter hands over, rendered for real. The two new receipt settings
 * must gate exactly what they say, and the old-balance block must replace — not
 * repeat — the ordinary BALANCE DUE line.
 */

const sale = (shop: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id: "s1",
  receipt_number: "1024",
  created_at: "2026-01-15T10:30:00",
  subtotal: 4000,
  discount: 0,
  tax: 0,
  total: 4000,
  amount_paid: 2500,
  change_due: 0,
  balance_due: 1500,
  payment_method: "cash",
  payments: [{ account_name: "Cash", amount: 2500 }],
  items: [{ product_name: "Oil filter", quantity: 1, unit_price: 4000, line_total: 4000, unit_label: "pcs" }],
  notes: "Collect the rest on Friday",
  previous_balance: 2500,
  shop: { name: "Test Shop", currency: "PKR", ...shop },
  ...extra,
});

const customer = { name: "Ahmed Khan", phone: "03001234567" };

// Rendered with react-dom directly, like rich-text-editor.test.tsx: this
// project's @testing-library/react is missing its @testing-library/dom peer.
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
/** An element whose own text is exactly `label`. */
const has = (label: string) =>
  Array.from(container.querySelectorAll("span, div")).some((n) => n.childNodes.length === 1 && n.textContent === label);

describe("ReceiptPaper", () => {
  it("prints neither the old balance nor the note while both settings are off", () => {
    render(<ReceiptPaper sale={sale({})} customer={customer} withTerms={false} />);
    expect(has("Previous balance")).toBe(false);
    expect(text()).not.toContain("Collect the rest on Friday");
    // The bill's own balance still prints the ordinary way.
    expect(has("BALANCE DUE")).toBe(true);
  });

  it("prints previous balance, this bill and the new total when switched on", () => {
    render(<ReceiptPaper sale={sale({ show_previous_balance_on_receipt: true })} customer={customer} withTerms={false} />);
    expect(has("Previous balance")).toBe(true);
    expect(has("This bill")).toBe(true);
    expect(has("TOTAL BALANCE")).toBe(true);
    // 2,500 owed before + 1,500 left on this bill.
    expect(text()).toMatch(/TOTAL BALANCE\D*4,000/);
    // Replaced, not repeated: "this bill" already is the balance due.
    expect(has("BALANCE DUE")).toBe(false);
  });

  it("prints the note only when its setting is on", () => {
    render(<ReceiptPaper sale={sale({ show_notes_on_receipt: true })} customer={customer} withTerms={false} />);
    expect(text()).toContain("Note: Collect the rest on Friday");
    render(<ReceiptPaper sale={sale({ show_notes_on_receipt: false })} customer={customer} withTerms={false} />);
    expect(text()).not.toContain("Collect the rest on Friday");
  });

  it("prints no balance block for a walk-in, even with the setting on", () => {
    render(
      <ReceiptPaper
        sale={sale({ show_previous_balance_on_receipt: true }, { previous_balance: null })}
        customer={null}
        withTerms={false}
      />,
    );
    expect(has("Previous balance")).toBe(false);
    expect(has("BALANCE DUE")).toBe(true);
  });

  it("skips a blank note rather than printing an empty 'Note:' line", () => {
    render(<ReceiptPaper sale={sale({ show_notes_on_receipt: true }, { notes: "   " })} customer={customer} withTerms={false} />);
    expect(text()).not.toContain("Note:");
  });
});

describe("ReceiptPreview in Settings", () => {
  const settings = {
    receipt_header: "",
    receipt_footer: "Thank you for your custom",
    receipt_terms: "",
    print_terms_by_default: false,
    show_tax_line: true,
    show_customer_on_receipt: true,
    show_imei_on_receipt: false,
    show_previous_balance_on_receipt: false,
    show_notes_on_receipt: false,
  };
  const shop = { id: "shop", name: "Preview Shop", currency: "PKR", tax_rate: 0, store_type: "other" } as never;

  it("shows the form's UNSAVED values, and follows each switch", () => {
    render(<ReceiptPreview shop={shop} settings={settings} />);
    expect(text()).toContain("Thank you for your custom");
    expect(has("Previous balance")).toBe(false);
    expect(text()).not.toContain("Note:");

    render(<ReceiptPreview shop={shop} settings={{ ...settings, show_previous_balance_on_receipt: true, show_notes_on_receipt: true }} />);
    expect(has("Previous balance")).toBe(true);
    expect(text()).toContain("Note:");
  });

  it("adds an oil-change block for an oil shop", () => {
    render(<ReceiptPreview shop={{ ...(shop as object), store_type: "oil" } as never} settings={settings} />);
    expect(text()).toContain("OIL CHANGE");
  });
});
