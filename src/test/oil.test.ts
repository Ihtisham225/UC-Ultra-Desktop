import { describe, it, expect } from "vitest";
import { isOil, normalizePlate, tidyPlate, kmRemaining } from "@/lib/oil";

describe("isOil", () => {
  it("is true only for the oil store type", () => {
    expect(isOil({ store_type: "oil" })).toBe(true);
    expect(isOil({ store_type: "phone" })).toBe(false);
    expect(isOil({})).toBe(false);
    expect(isOil(null)).toBe(false);
    expect(isOil(undefined)).toBe(false);
  });
});

describe("normalizePlate", () => {
  it("treats every way of writing one plate as the same car", () => {
    const forms = ["LEA 07-1234", "lea071234", "LEA-07 1234", " lea 07 1234 "];
    const normalized = forms.map(normalizePlate);
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe("LEA071234");
  });

  it("survives a plate that is punctuation only", () => {
    expect(normalizePlate("---")).toBe("");
  });
});

describe("tidyPlate", () => {
  it("keeps the counter's spacing but uppercases and collapses runs", () => {
    expect(tidyPlate("  lea 07-1234  ")).toBe("LEA 07-1234");
    expect(tidyPlate("lea    07")).toBe("LEA 07");
  });
});

describe("kmRemaining", () => {
  it("reports the distance left until the next change", () => {
    expect(kmRemaining(125400, 130400)).toBe(5000);
  });

  it("goes negative once the car is overdue", () => {
    expect(kmRemaining(131000, 130400)).toBe(-600);
  });

  it("is unknown when either reading is missing", () => {
    expect(kmRemaining(null, 130400)).toBeNull();
    expect(kmRemaining(125400, null)).toBeNull();
    expect(kmRemaining(undefined, undefined)).toBeNull();
  });
});
