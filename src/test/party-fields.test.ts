import { describe, expect, it } from "vitest";
import {
  fieldsFor,
  mergePartyValues,
  normalizePartyFields,
  normalizePartyValues,
  receiptFieldRows,
  type PartyField,
} from "@/lib/party-fields";

const F: PartyField[] = [
  { id: "cnic", label: "CNIC", applies: "customer", on_receipt: true },
  { id: "ntn", label: "NTN", applies: "supplier", on_receipt: false },
  { id: "area", label: "Area", applies: "both", on_receipt: false },
];

describe("normalizePartyFields", () => {
  it("drops unlabelled and duplicate fields, and never prints a supplier-only one", () => {
    const out = normalizePartyFields([
      { id: "a", label: "  Ref  ", applies: "supplier", on_receipt: true },
      { id: "a", label: "Dup", applies: "customer" },
      { id: "b", label: "   " },
      "junk",
    ]);
    expect(out).toEqual([{ id: "a", label: "Ref", applies: "supplier", on_receipt: false }]);
  });
  it("is empty for anything that isn't a list", () => {
    expect(normalizePartyFields(null)).toEqual([]);
    expect(normalizePartyFields({})).toEqual([]);
  });
});

describe("fieldsFor", () => {
  it("shows a 'both' field once, and supplier fields only to a supplier", () => {
    expect(fieldsFor(F, { customer: true }).map((f) => f.id)).toEqual(["cnic", "area"]);
    expect(fieldsFor(F, { supplier: true }).map((f) => f.id)).toEqual(["ntn", "area"]);
    expect(fieldsFor(F, { customer: true, supplier: true }).map((f) => f.id)).toEqual(["cnic", "ntn", "area"]);
  });
});

describe("mergePartyValues", () => {
  it("only touches the fields the form showed", () => {
    // Edited from the customer form: the supplier-only NTN must survive.
    const stored = { cnic: "1", ntn: "N-9", gone: "kept for a deleted field" };
    const out = mergePartyValues(stored, fieldsFor(F, { customer: true }), { cnic: " 35202 ", area: "" });
    expect(out).toEqual({ cnic: "35202", ntn: "N-9", gone: "kept for a deleted field" });
  });
});

describe("receiptFieldRows", () => {
  it("prints only on-receipt customer fields this customer filled in", () => {
    expect(receiptFieldRows(F, { cnic: "35202-1", ntn: "N-9", area: "Saddar" })).toEqual([{ label: "CNIC", value: "35202-1" }]);
    expect(receiptFieldRows(F, { area: "Saddar" })).toEqual([]);
    expect(receiptFieldRows(undefined, { cnic: "x" })).toEqual([]);
  });
  it("ignores stored junk", () => {
    expect(normalizePartyValues(["x"])).toEqual({});
    expect(normalizePartyValues({ "bad key!": "x", ok: 5 })).toEqual({ ok: "5" });
  });
});
