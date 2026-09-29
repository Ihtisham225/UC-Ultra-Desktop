import { it, expect } from "vitest";
import { personLedgerLog } from "@/lib/ledger-log";

/** Tech Town, Ihtisham ul haq: one 35,000 payment over two bills is ONE history line. */
it("folds a payment's parts into one line, with a plain date", () => {
  const log = personLedgerLog(
    [
      { id: "b214", amount: 18070, created_at: "2026-09-14T02:07:21Z", label: "Bill ORD-214" },
      { id: "b215", amount: 51700, created_at: "2026-09-14T03:36:00Z", label: "Bill ORD-215" },
    ] as never,
    [
      { id: "i", debt_id: "b215", kind: "increase", amount: 50000, payment_date: "2026-09-28T00:00:00.000Z" },
      { id: "p1", debt_id: "b214", kind: "payment", amount: 8070, payment_date: "2026-09-28T00:00:00.000Z", receipt_id: "PR-2" },
      { id: "p2", debt_id: "b215", kind: "payment", amount: 26930, payment_date: "2026-09-28T00:00:00.000Z", receipt_id: "PR-2" },
    ],
  );
  const payments = log.rows.filter((r) => r.kind === "payment");
  expect(payments).toHaveLength(1);
  expect(payments[0]).toMatchObject({ amount: 35000, date: "2026-09-28" });
  expect(log.closing).toBe(18070 + 51700 - 35000);
});
