import { describe, it, expect } from "vitest";
import {
  balanceAfterLine,
  buildPaymentReceiptHtml,
  buildPaymentReceiptMessage,
  paymentSlipWords,
  receiptNo,
  type PaymentReceiptDto,
} from "@/lib/payment-receipt";

const money = (n: number, c: string) => `${c} ${n.toLocaleString("en-US")}`;
const shop = { name: "Shamsher <Corp>", address: null, phone: null, currency: "PKR", receipt_header: null, receipt_footer: "Shukriya" };
const base: PaymentReceiptDto = {
  id: "r1", receipt_number: "PR-12", person_name: "Qamar Gul", phone: "03310416678", direction: "owed_to_me",
  amount: 10000, discount: 0, method: "Cash", balance_before: 50000, balance_after: 40000,
  payment_date: "2026-09-23", notes: null, created_at: "2026-09-23T10:00:00Z",
};

describe("payment receipt", () => {
  it("shows what was owed, what was paid and what remains", () => {
    const msg = buildPaymentReceiptMessage(base, shop, money, "23/09/2026");
    expect(msg).toContain("PAYMENT RECEIPT PR-12");
    expect(msg).toContain("Previous balance: PKR 50,000");
    expect(msg).toContain("Received: PKR 10,000");
    expect(msg).toContain("Balance remaining: PKR 40,000");
  });

  it("reads 'Pending sync' until the server numbers it", () => {
    expect(receiptNo({ receipt_number: null })).toBe("Pending sync");
    expect(buildPaymentReceiptHtml({ ...base, receipt_number: null }, shop, money, "x")).toContain("Pending sync");
  });

  it("calls an overpayment an advance, not a negative balance", () => {
    expect(balanceAfterLine(-2500)).toEqual({ label: "Advance (in credit)", amount: 2500 });
    expect(balanceAfterLine(0)).toEqual({ label: "Balance remaining", amount: 0 });
  });

  it("is a voucher when the shop pays a supplier", () => {
    expect(paymentSlipWords({ direction: "i_owe" })).toEqual({ title: "PAYMENT VOUCHER", party: "Paid to" });
    expect(buildPaymentReceiptMessage({ ...base, direction: "i_owe" }, shop, money, "x")).toContain("Paid: PKR 10,000");
  });

  it("escapes shop text in the printed page", () => {
    const html = buildPaymentReceiptHtml(base, shop, money, "x");
    expect(html).toContain("Shamsher &lt;Corp&gt;");
    expect(html).not.toContain("<Corp>");
  });
});
