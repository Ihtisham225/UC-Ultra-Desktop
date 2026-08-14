import { describe, it, expect } from "vitest";
import { isLabEnabled } from "@/lib/lab";

describe("isLabEnabled", () => {
  it("is on for a pharmacy that turned lab tests on", () => {
    expect(isLabEnabled({ store_type: "pharmacy", lab_tests_enabled: true })).toBe(true);
  });

  it("is off for a pharmacy that never turned lab tests on", () => {
    expect(isLabEnabled({ store_type: "pharmacy", lab_tests_enabled: false })).toBe(false);
  });

  // The reported bug: Tech Town Swat switched pharmacy -> phone and kept the
  // stale flag, so Lab/Results/Patients stayed in the sidebar.
  it("is off once the store type moves away from pharmacy, stale flag or not", () => {
    expect(isLabEnabled({ store_type: "phone", lab_tests_enabled: true })).toBe(false);
    expect(isLabEnabled({ store_type: "supermarket", lab_tests_enabled: true })).toBe(false);
  });

  it("is off when there is no shop yet", () => {
    expect(isLabEnabled(null)).toBe(false);
    expect(isLabEnabled(undefined)).toBe(false);
  });
});
