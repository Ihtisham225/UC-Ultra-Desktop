import { afterEach, describe, expect, it } from "vitest";
import {
  APPEARANCE_PREPAINT,
  THEME_PRESETS,
  appearanceStyle,
  normalizeAppearance,
  type Appearance,
} from "@/lib/appearance";

/**
 * The web app applies a person's look from an inline <head> script before the
 * first paint; that script can't import anything, so it carries its own copy
 * of the preset table and colour maths. These tests run it and check it lands
 * on exactly what `appearanceStyle` would set.
 */
function runPrepaint(a: Appearance) {
  localStorage.setItem("ucu.appearance", JSON.stringify(a));
  new Function(APPEARANCE_PREPAINT)();
  const root = document.documentElement;
  const vars = ["--brand-h", "--brand-s", "--brand-l", "--brand-l-dark", "--chrome-h", "--chrome-s"];
  return {
    vars: Object.fromEntries(vars.map((v) => [v, root.style.getPropertyValue(v)])),
    attrs: { "data-chrome-tone": root.getAttribute("data-chrome-tone"), "data-glass": root.getAttribute("data-glass") },
  };
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("style");
});

describe("appearance pre-paint script", () => {
  const cases: Appearance[] = [
    ...THEME_PRESETS.map((p) => ({ theme: p.id, accent: null, chrome: "dark" as const, glass: true, checkout: "popup" as const })),
    { theme: "custom", accent: "#ff8800", chrome: "light", glass: false, checkout: "inline" },
    { theme: "custom", accent: "#0a0a0a", chrome: "dark", glass: true, checkout: "popup" },
    { theme: "custom", accent: "#f5f5ff", chrome: "light", glass: true, checkout: "popup" },
  ];
  for (const a of cases) {
    it(`matches appearanceStyle for ${a.theme}${a.accent ? ` ${a.accent}` : ""}`, () => {
      const expected = appearanceStyle(a);
      const got = runPrepaint(a);
      expect(got.attrs).toEqual(expected.attrs);
      for (const [k, v] of Object.entries(expected.vars)) expect(got.vars[k]).toBe(v);
    });
  }
});

describe("normalizeAppearance", () => {
  it("falls back to the default for nonsense", () => {
    expect(normalizeAppearance(null)).toEqual({ theme: "emerald", accent: null, chrome: "dark", glass: true, checkout: "popup" });
    expect(normalizeAppearance({ theme: "nope", chrome: "purple", glass: "yes" })).toEqual({
      theme: "emerald", accent: null, chrome: "dark", glass: true, checkout: "popup",
    });
  });
  it("keeps the till checkout only when it is on-screen; anything else is the pop-up", () => {
    expect(normalizeAppearance({ checkout: "inline" }).checkout).toBe("inline");
    expect(normalizeAppearance({ checkout: "sideways" }).checkout).toBe("popup");
  });
  it("keeps a custom colour only when it is a real hex", () => {
    expect(normalizeAppearance({ theme: "custom", accent: "#ABCDEF" }).accent).toBe("#abcdef");
    expect(normalizeAppearance({ theme: "custom", accent: "red" }).theme).toBe("emerald");
  });
});
