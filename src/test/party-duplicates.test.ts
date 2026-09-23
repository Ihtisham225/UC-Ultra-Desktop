import { describe, it, expect } from "vitest";
import { findDuplicateParties, partyNameKey, partyPhoneKey } from "@/lib/party-duplicates";

const parties = [
  { id: "a", name: "Qamar Gul Machine Takhtaband", phone: "03310416678", is_customer: true },
  { id: "b", name: "Hafiz Lahore", phone: null, is_supplier: true },
  { id: "c", name: "Naqib Machine", phone: "0346-5692110", is_customer: true, is_supplier: true },
];

describe("party duplicates", () => {
  it("matches a name regardless of case, spacing and punctuation", () => {
    expect(partyNameKey("  qamar  gul. MACHINE takhtaband ")).toBe(partyNameKey("Qamar Gul Machine Takhtaband"));
    const m = findDuplicateParties(parties, { name: "qamar gul machine  takhtaband" });
    expect(m.map((x) => [x.id, x.on])).toEqual([["a", "name"]]);
  });

  it("matches a phone written any common way", () => {
    for (const p of ["0331-0416678", "+92 331 0416678", "923310416678", "3310416678"]) {
      expect(partyPhoneKey(p)).toBe("03310416678");
    }
    const m = findDuplicateParties(parties, { name: "Someone Else", phone: "+92 346 5692110" });
    expect(m.map((x) => [x.id, x.on])).toEqual([["c", "phone"]]);
  });

  it("puts name-and-phone matches first and reports roles", () => {
    const m = findDuplicateParties(parties, { name: "Naqib Machine", phone: "03465692110" });
    expect(m[0]).toMatchObject({ id: "c", on: "both", is_customer: true, is_seller: true, roles: "customer & supplier" });
  });

  it("ignores the record being edited, and short or empty phones", () => {
    expect(findDuplicateParties(parties, { name: "Qamar Gul Machine Takhtaband" }, "a")).toEqual([]);
    expect(findDuplicateParties(parties, { name: "New Person", phone: "123" })).toEqual([]);
    expect(findDuplicateParties(parties, { name: "", phone: "" })).toEqual([]);
  });

  it("does not match a partial name", () => {
    expect(findDuplicateParties(parties, { name: "Qamar Gul" })).toEqual([]);
  });
});
