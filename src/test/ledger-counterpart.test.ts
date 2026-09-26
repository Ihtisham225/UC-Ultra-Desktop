import { describe, it, expect } from "vitest";
import { counterpartGroups, groupLedgers } from "@/lib/ledger-groups";

/**
 * Tech Town, AL BADAR: the supplier owed the shop 4,925,778; purchases settled
 * it to zero and the excess opened a new "to pay" row. Opening the new account
 * showed none of the old history, so the shop thought it had been wiped.
 */
const row = (id: string, direction: string, amount: number, paid: number, party: string | null, name = "AL BADAR", at = "2026-09-26T10:00:00Z") =>
  ({ id, direction, amount, paid_amount: paid, party_id: party, person_name: name, created_at: at });

describe("the same person's account facing the other way", () => {
  const groups = groupLedgers([
    row("old", "owed_to_me", 4925778, 4925778, "p1"),
    row("new", "i_owe", 74222, 0, "p1", "AL BADAR", "2026-09-26T19:00:00Z"),
    row("other", "owed_to_me", 500, 0, "p2", "Someone else"),
    row("typed", "owed_to_me", 100, 0, null, "Al  Badar"), // no party link: a different account
  ]);
  const toPay = groups.find((g) => g.direction === "i_owe")!;

  it("finds the settled 'to receive' account for the new 'to pay' one", () => {
    const other = counterpartGroups(groups, toPay);
    expect(other.map((g) => g.debts.map((d) => d.id))).toEqual([["old"]]);
    expect(other[0].status).toBe("settled");
  });

  it("works the other way round, and never picks up another person", () => {
    const toReceive = groups.find((g) => g.debts.some((d) => d.id === "old"))!;
    expect(counterpartGroups(groups, toReceive).flatMap((g) => g.debts.map((d) => d.id))).toEqual(["new"]);
    const someone = groups.find((g) => g.debts.some((d) => d.id === "other"))!;
    expect(counterpartGroups(groups, someone)).toEqual([]);
  });
});
