import { describe, expect, it } from "vitest";
import { customerBalance, partyKhataBalances, supplierBalance } from "@/lib/party-balances";

describe("party balances on the Customers and Suppliers lists", () => {
  const rows = [
    // Ali owes the shop 900 on one bill and 50 on another…
    { party_id: "ali", direction: "owed_to_me", amount: 1000, paid_amount: 100 },
    { party_id: "ali", direction: "owed_to_me", amount: "50", paid_amount: null },
    // …and the shop owes him 300 for goods it took on credit.
    { party_id: "ali", direction: "i_owe", amount: 300, paid_amount: 0 },
    // A settled row and an overpaid one count for nothing.
    { party_id: "ali", direction: "i_owe", amount: 200, paid_amount: 200 },
    { party_id: "ali", direction: "owed_to_me", amount: 10, paid_amount: 25 },
    // A supplier the shop owes, who owes nothing back.
    { party_id: "zic", direction: "i_owe", amount: 5000, paid_amount: 1000 },
    // A row typed by name with no party can't be tied to anyone on the lists.
    { party_id: null, direction: "owed_to_me", amount: 999, paid_amount: 0 },
  ];
  const b = partyKhataBalances(rows);

  it("keeps the two sides apart per party", () => {
    expect(b.ali).toEqual({ receivable: 950, payable: 300 });
    expect(b.zic).toEqual({ receivable: 0, payable: 4000 });
    expect(Object.keys(b).sort()).toEqual(["ali", "zic"]);
  });

  it("nets from the customer's side: positive to receive, negative when the shop owes", () => {
    expect(customerBalance(b.ali)).toBe(650);
    expect(customerBalance(b.zic)).toBe(-4000);
  });

  it("nets from the supplier's side: positive to pay, negative when they owe the shop", () => {
    expect(supplierBalance(b.zic)).toBe(4000);
    expect(supplierBalance(b.ali)).toBe(-650);
  });

  it("reads a party with no ledger as settled", () => {
    expect(customerBalance(undefined)).toBe(0);
    expect(supplierBalance(undefined)).toBe(0);
  });
});
