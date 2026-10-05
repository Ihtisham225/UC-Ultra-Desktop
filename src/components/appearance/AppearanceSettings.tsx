"use client";

/**
 * Settings → Appearance: this person's colour theme, sidebar/header tone and
 * transparency, plus light/dark mode. Every change shows at once and is saved
 * to their account, so it follows them to any computer.
 *
 * ⚠️ COPIED verbatim to the desktop app (`src/components/appearance/`).
 */
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  THEME_PRESETS,
  applyAppearance,
  hslToHex,
  readStoredAppearance,
  resolveColours,
  storeAppearance,
  type Appearance,
  type ChromeTone,
} from "@/lib/appearance";
import { appearanceApi } from "@/components/appearance/appearance-api";

const noopSubscribe = () => () => {};
const serverSnapshot = () => null;

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  // The stored look is only readable in the browser; until then the default.
  const stored = useSyncExternalStore(noopSubscribe, readStoredAppearanceCached, serverSnapshot);
  const [picked, setPicked] = useState<Appearance | null>(null);
  const current = picked ?? stored;
  const [saving, setSaving] = useState(false);

  const change = async (patch: Partial<Appearance>) => {
    if (!current) return;
    const next: Appearance = { ...current, ...patch };
    setPicked(next);
    applyAppearance(next);
    storeAppearance(next);
    setSaving(true);
    try {
      await appearanceApi.save(next);
    } catch (e) {
      toast.error(e instanceof Error ? `Not saved to your account: ${e.message}` : "Not saved to your account");
    } finally {
      setSaving(false);
    }
  };

  if (!current) return null;
  const custom = current.theme === "custom" && current.accent ? current.accent : null;
  const customHex = custom ?? hslToHex(...resolveColours(current).brand);

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Palette className="size-4 text-primary" /> Colour theme</h3>
            <p className="text-sm text-muted-foreground">Buttons, links and the highlighted page in the sidebar. Only changes your own screen.</p>
          </div>
          <span className="text-xs text-muted-foreground">{saving ? "Saving…" : "Saved to your account"}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {THEME_PRESETS.map((p) => {
            const active = current.theme === p.id;
            const [h, s, l] = p.brand;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => void change({ theme: p.id, accent: null })}
                className={cn(
                  "group flex flex-col items-center gap-1.5 rounded-xl border p-2 text-xs transition-colors hover:bg-muted/50",
                  active && "border-primary ring-2 ring-primary/30",
                )}
              >
                <span className="relative flex h-10 w-full overflow-hidden rounded-lg">
                  <span className="w-1/3" style={{ background: `hsl(${p.chrome[0]} ${p.chrome[1]}% 14%)` }} />
                  <span className="flex flex-1 items-center justify-center" style={{ background: `hsl(${h} ${s}% ${l}%)` }}>
                    {active && <Check className="size-4 text-white" />}
                  </span>
                </span>
                <span className={cn(active ? "font-semibold" : "text-muted-foreground")}>{p.name}</span>
              </button>
            );
          })}
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-2 text-xs transition-colors hover:bg-muted/50",
              custom && "border-primary ring-2 ring-primary/30",
            )}
          >
            <span className="relative flex h-10 w-full items-center justify-center overflow-hidden rounded-lg" style={{ background: customHex }}>
              {custom && <Check className="size-4 text-white" />}
              <input
                type="color"
                aria-label="Pick your own colour"
                value={customHex}
                onChange={(e) => void change({ theme: "custom", accent: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </span>
            <span className={cn(custom ? "font-semibold" : "text-muted-foreground")}>Your colour</span>
          </label>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Sidebar &amp; header</h3>
          <p className="text-sm text-muted-foreground">How the menu on the left and the bar along the top look.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["dark", "light"] as ChromeTone[]).map((tone) => (
            <button
              key={tone}
              type="button"
              onClick={() => void change({ chrome: tone })}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-start transition-colors hover:bg-muted/50",
                current.chrome === tone && "border-primary ring-2 ring-primary/30",
              )}
            >
              <MiniShell tone={tone} appearance={current} />
              <span>
                <span className="block text-sm font-medium">{tone === "dark" ? "Dark" : "Light"}</span>
                <span className="block text-xs text-muted-foreground">
                  {tone === "dark" ? "Tinted with your theme colour" : "White panels, like the pages"}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div>
            <Label htmlFor="appearance-glass" className="text-sm font-medium">See-through (glass)</Label>
            <p className="text-xs text-muted-foreground">
              The page shows softly through the sidebar and header. Turn off for solid panels.
            </p>
          </div>
          <Switch id="appearance-glass" checked={current.glass} onCheckedChange={(v) => void change({ glass: v })} />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Light or dark</h3>
          <p className="text-sm text-muted-foreground">The whole app. &ldquo;Match computer&rdquo; follows your computer&apos;s setting.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {([
            ["light", "Light", Sun],
            ["dark", "Dark", Moon],
            ["system", "Match computer", Monitor],
          ] as [Theme, string, typeof Sun][]).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm transition-colors hover:bg-muted/50",
                theme === value && "border-primary ring-2 ring-primary/30 font-medium",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

/** A thumbnail of the shell in a given tone, in the person's colours. */
function MiniShell({ tone, appearance }: { tone: ChromeTone; appearance: Appearance }) {
  const { brand, chrome } = resolveColours(appearance);
  const panel = tone === "dark" ? `hsl(${chrome[0]} ${chrome[1]}% 14%)` : "hsl(0 0% 100%)";
  const line = tone === "dark" ? "hsl(0 0% 100% / 0.35)" : "hsl(220 15% 80%)";
  return (
    <span className="flex h-14 w-20 shrink-0 gap-1 rounded-lg border bg-muted p-1">
      <span className="flex w-6 flex-col gap-0.5 rounded-md p-1" style={{ background: panel }}>
        <span className="h-1 rounded" style={{ background: `hsl(${brand[0]} ${brand[1]}% ${brand[2]}%)` }} />
        <span className="h-1 rounded" style={{ background: line }} />
        <span className="h-1 rounded" style={{ background: line }} />
      </span>
      <span className="flex flex-1 flex-col gap-1">
        <span className="h-2.5 rounded-md" style={{ background: panel }} />
        <span className="flex-1 rounded-md bg-background" />
      </span>
    </span>
  );
}

// useSyncExternalStore needs the same object back while nothing changed, so
// the snapshot is cached against the stored text it was read from.
let cached: { raw: string | null; value: Appearance } | null = null;
function readStoredAppearanceCached(): Appearance {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem("ucu.appearance");
  } catch {
    // Storage blocked — fall through to the default.
  }
  if (!cached || cached.raw !== raw) cached = { raw, value: readStoredAppearance() };
  return cached.value;
}
