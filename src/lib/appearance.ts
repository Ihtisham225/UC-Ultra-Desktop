/**
 * How the app looks for one person: a colour theme (a preset or their own
 * colour), whether the sidebar and header are dark or light, and whether they
 * are see-through glass or solid.
 *
 * It is saved on the user's account (users.appearance) so it follows them to
 * any computer, and kept in localStorage too so it can be applied BEFORE the
 * first paint — otherwise every page load would flash the default green.
 *
 * Applying it only sets CSS variables and two data attributes on <html>;
 * globals.css (index.css on the desktop) does the rest.
 *
 * ⚠️ COPIED verbatim to the desktop app (`src/lib/appearance.ts`).
 */

export type ChromeTone = "dark" | "light";

export interface Appearance {
  /** A preset id, or "custom" to use `accent`. */
  theme: string;
  /** #rrggbb, for theme = "custom". */
  accent?: string | null;
  /** Sidebar and header: dark ink or light. */
  chrome: ChromeTone;
  /** See-through, blurred sidebar and header (true) or solid (false). */
  glass: boolean;
}

export interface ThemePreset {
  id: string;
  name: string;
  /** Brand colour: buttons, links, the active nav pill. HSL parts. */
  brand: [number, number, number];
  /** Hue and saturation the dark sidebar/header is tinted with. */
  chrome: [number, number];
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "emerald", name: "Emerald", brand: [158, 84, 39], chrome: [168, 42] },
  { id: "ocean", name: "Ocean", brand: [211, 80, 46], chrome: [215, 45] },
  { id: "indigo", name: "Indigo", brand: [243, 65, 56], chrome: [240, 34] },
  { id: "violet", name: "Violet", brand: [271, 62, 52], chrome: [268, 32] },
  { id: "rose", name: "Rose", brand: [346, 75, 50], chrome: [340, 30] },
  { id: "sunset", name: "Sunset", brand: [22, 88, 48], chrome: [18, 34] },
  { id: "teal", name: "Teal", brand: [184, 78, 33], chrome: [188, 45] },
  { id: "graphite", name: "Graphite", brand: [218, 16, 38], chrome: [220, 14] },
];

export const DEFAULT_APPEARANCE: Appearance = { theme: "emerald", accent: null, chrome: "dark", glass: true };

const STORAGE_KEY = "ucu.appearance";
const HEX = /^#[0-9a-f]{6}$/i;

/** Anything stored or sent → a valid Appearance (unknown bits fall back to the default). */
export function normalizeAppearance(raw: unknown): Appearance {
  const a = (raw && typeof raw === "object" ? raw : {}) as Partial<Appearance>;
  const custom = a.theme === "custom" && typeof a.accent === "string" && HEX.test(a.accent);
  const theme = custom ? "custom" : THEME_PRESETS.some((p) => p.id === a.theme) ? String(a.theme) : DEFAULT_APPEARANCE.theme;
  return {
    theme,
    accent: custom ? String(a.accent).toLowerCase() : null,
    chrome: a.chrome === "light" ? "light" : "dark",
    glass: a.glass === false ? false : true,
  };
}

export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/**
 * The brand and chrome colours an appearance stands for. A custom colour is
 * kept readable: white text has to sit on it (buttons), so its lightness is
 * held between 28% and 52%.
 */
export function resolveColours(a: Appearance): { brand: [number, number, number]; chrome: [number, number] } {
  if (a.theme === "custom" && a.accent && HEX.test(a.accent)) {
    const [h, s, l] = hexToHsl(a.accent);
    return { brand: [h, Math.max(s, 25), Math.min(Math.max(l, 28), 52)], chrome: [h, Math.min(Math.max(s * 0.45, 12), 45)] };
  }
  const p = THEME_PRESETS.find((x) => x.id === a.theme) ?? THEME_PRESETS[0];
  return { brand: p.brand, chrome: p.chrome };
}

/** The CSS variables + <html> attributes an appearance sets. */
export function appearanceStyle(a: Appearance): { vars: Record<string, string>; attrs: Record<string, string> } {
  const { brand, chrome } = resolveColours(a);
  const [h, s, l] = brand;
  return {
    vars: {
      "--brand-h": String(h),
      "--brand-s": `${s}%`,
      "--brand-l": `${l}%`,
      // Dark mode lifts the brand so it still reads on the dark page.
      "--brand-l-dark": `${Math.min(l + 12, 62)}%`,
      "--chrome-h": String(chrome[0]),
      "--chrome-s": `${chrome[1]}%`,
    },
    attrs: { "data-chrome-tone": a.chrome, "data-glass": a.glass ? "on" : "off" },
  };
}

/** Apply to the page. Safe to call any number of times. */
export function applyAppearance(a: Appearance): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const { vars, attrs } = appearanceStyle(a);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  for (const [k, v] of Object.entries(attrs)) root.setAttribute(k, v);
}

export function readStoredAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeAppearance(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function storeAppearance(a: Appearance): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch {
    // Storage blocked — the account copy still holds it.
  }
}

export function sameAppearance(a: Appearance, b: Appearance): boolean {
  return a.theme === b.theme && (a.accent ?? null) === (b.accent ?? null) && a.chrome === b.chrome && a.glass === b.glass;
}

/**
 * Inline <head> script that applies the stored appearance before the first
 * paint. Self-contained (no imports), so it duplicates the preset table in
 * miniature — `src/test/appearance.test.ts` on the desktop checks the two agree.
 */
export const APPEARANCE_PREPAINT = `(function(){try{
var a=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"null");if(!a)return;
var P=${JSON.stringify(Object.fromEntries(THEME_PRESETS.map((p) => [p.id, [...p.brand, ...p.chrome]])))};
var c=P[a.theme];
if(a.theme==="custom"&&/^#[0-9a-f]{6}$/i.test(a.accent||"")){
var n=parseInt(a.accent.slice(1),16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,h=0,s=0;
if(mx!==mn){var d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60}
h=Math.round(h);s=Math.round(s*100);l=Math.round(l*100);
c=[h,Math.max(s,25),Math.min(Math.max(l,28),52),h,Math.min(Math.max(s*.45,12),45)]}
var R=document.documentElement;
if(c){R.style.setProperty("--brand-h",c[0]);R.style.setProperty("--brand-s",c[1]+"%");R.style.setProperty("--brand-l",c[2]+"%");
R.style.setProperty("--brand-l-dark",Math.min(c[2]+12,62)+"%");R.style.setProperty("--chrome-h",c[3]);R.style.setProperty("--chrome-s",c[4]+"%")}
R.setAttribute("data-chrome-tone",a.chrome==="light"?"light":"dark");R.setAttribute("data-glass",a.glass===false?"off":"on");
}catch(e){}})();`;
