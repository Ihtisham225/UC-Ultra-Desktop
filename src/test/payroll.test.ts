import { describe, expect, it } from "vitest";
import { computePayslip, failure } from "@/lib/payroll";

/**
 * The payslip sums are COPIED from the web app (`src/lib/payroll.ts`); the
 * server stores them and the draft editor previews them, so the two must agree.
 */
describe("computePayslip", () => {
  it("nets earnings, unpaid days and advances against the wage", () => {
    // The case walked through on the web: 30,000 for October (31 days),
    // 2,000 bonus, 3 unpaid days, 5,000 advanced.
    const t = computePayslip({
      basicSalary: 30000,
      daysInPeriod: 31,
      unpaidDays: 3,
      lines: [{ kind: "earning", amount: 2000 }],
      advances: 5000,
    });
    expect(t).toEqual({
      grossPay: 32000,
      absenceDeduction: 2903.23,
      advanceDeduction: 5000,
      totalDeductions: 7903.23,
      netPay: 24096.77,
    });
  });

  it("works on a weekly wage, where the period is 7 days", () => {
    const t = computePayslip({ basicSalary: 7000, daysInPeriod: 7, unpaidDays: 1, lines: [], advances: 0 });
    expect(t.absenceDeduction).toBe(1000);
    expect(t.netPay).toBe(6000);
  });

  it("can go negative, which the screens refuse to finalize", () => {
    const t = computePayslip({
      basicSalary: 1000, daysInPeriod: 30, unpaidDays: 0,
      lines: [{ kind: "deduction", amount: 500 }], advances: 800,
    });
    expect(t.netPay).toBe(-300);
  });
});

describe("failure", () => {
  it("reads the error off a failed result and nothing off a good one", () => {
    expect(failure({ ok: true })).toBeNull();
    expect(failure({ ok: false, error: "Nope" } as { ok: boolean })).toBe("Nope");
  });
});
