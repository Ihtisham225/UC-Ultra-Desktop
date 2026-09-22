import { describe, expect, it } from "vitest";
import { chequeLabel, daysUntil, dueLabel } from "@/lib/cheques";
import { targetsFor } from "@/lib/daybook";
import { buildReceiptMessage } from "@/lib/whatsapp-receipt";
import { buildReturnMessage, refundedVia, type ReturnSlip } from "@/lib/return-receipt";

const money = (n: number, c: string) => `${c} ${n.toFixed(2)}`;

describe("cheques", () => {
  it("counts calendar days to the cheque date, negative once past", () => {
    const now = new Date(2026, 8, 22, 23, 30); // late evening must not tip the count
    expect(daysUntil("2026-09-22", now)).toBe(0);
    expect(daysUntil("2026-10-05", now)).toBe(13);
    expect(daysUntil("2026-09-20", now)).toBe(-2);
  });

  it("words the due state the way the dashboard shows it", () => {
    expect(dueLabel(0)).toBe("due today");
    expect(dueLabel(1)).toBe("due tomorrow");
    expect(dueLabel(5)).toBe("due in 5 days");
    expect(dueLabel(-1)).toBe("1 day overdue");
    expect(dueLabel(-3)).toBe("3 days overdue");
  });

  it("labels the khata entry with number, bank and date", () => {
    expect(chequeLabel({ cheque_number: "777", bank_name: "HBL", cheque_date: "2026-10-05" }))
      .toBe("Cheque #777 (HBL) dated 05 Oct 2026");
    expect(chequeLabel({ cheque_number: "9", bank_name: null, cheque_date: "2026-01-31" }))
      .toBe("Cheque #9 dated 31 Jan 2026");
  });
});

describe("Roznamcha targets by store type", () => {
  it("offers general records outside handicraft, and never mixes the two sets", () => {
    const general = targetsFor("money", "in", false).map((t) => t.value);
    expect(general).toEqual(["ledger_payment_in", "ledger_entry", "purchase"]);
    expect(targetsFor("money", "out", false).map((t) => t.value)).toContain("expense");
    const craft = targetsFor("money", "in", true).map((t) => t.value);
    expect(craft).toEqual(["customer_payment"]);
    expect(craft.some((v) => general.includes(v as never))).toBe(false);
  });

  it("keeps the handicraft default when no store type is passed", () => {
    expect(targetsFor("material", "out").map((t) => t.value)).toContain("making_challan");
  });
});

describe("WhatsApp receipt", () => {
  const base = {
    shopName: "Shop", receiptNumber: 12, date: "22/09/2026",
    lines: [{ name: "Oil", quantity: 1, line_total: 1000 }],
    total: 1000, paid: 400, due: 600, currency: "PKR", formatMoney: money,
  };

  it("carries the khata block — and then no second balance line", () => {
    const msg = buildReceiptMessage({ ...base, ledger: { previous: 2000, thisBill: 600, total: 2600 } });
    expect(msg).toContain("Previous balance: PKR 2000.00");
    expect(msg).toContain("This bill: PKR 600.00");
    expect(msg).toContain("*Total balance: PKR 2600.00*");
    expect(msg).not.toContain("Balance: PKR 600.00");
  });

  it("falls back to the plain balance without a ledger, and prints the note", () => {
    const msg = buildReceiptMessage({ ...base, notes: "Deliver Friday" });
    expect(msg).toContain("Balance: PKR 600.00");
    expect(msg).toContain("Note: Deliver Friday");
  });
});

describe("return slip", () => {
  const slip: ReturnSlip = {
    return_number: "RET-1", created_at: "2026-09-22T10:00:00Z", sale_receipt_number: null,
    refund_method: "cash", account_name: null, reason: "Damaged", notes: null,
    items_total: 600, deduction: 100, total_refund: 500,
    customer: { name: "Ali", phone: "03001234567" },
    items: [{ product_name: "Filter", quantity: 2, unit_price: 300, line_total: 600 }],
    shop: { name: "Shop", address: null, phone: null, currency: "PKR", receipt_header: null, receipt_footer: null },
  };

  it("names the account when there is one, else the method", () => {
    expect(refundedVia(slip)).toBe("Cash");
    expect(refundedVia({ ...slip, account_name: "Meezan" })).toBe("Meezan");
    expect(refundedVia({ ...slip, refund_method: "other" })).toBe("Store credit / other");
  });

  it("shows the deduction and what was refunded, with no bill line for a bill-less return", () => {
    const msg = buildReturnMessage(slip, money, "22/09/2026");
    expect(msg).toContain("Deduction: -PKR 100.00");
    expect(msg).toContain("*Refunded: PKR 500.00*");
    expect(msg).not.toContain("Against receipt");
  });
});
