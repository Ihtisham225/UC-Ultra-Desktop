import { useState } from "react";
import { Banknote, Check, Landmark, Wallet } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  ACCOUNT_LOGOS, accountLogoPreset, accountLogoSrc, accountLogoValue,
  type AccountLogoKind, type AccountLogoPreset,
} from "@/lib/account-logos";

// COPIED verbatim to the desktop (src/components/AccountLogo.tsx) — keep in step.

const TYPE_ICON = { cash: Banknote, bank: Landmark, wallet: Wallet } as const;

/** A preset drawn as a coloured tile with its short name — an SVG, sharp at any size. */
function PresetTile({ preset, className }: { preset: AccountLogoPreset; className: string }) {
  const len = preset.short.length;
  const size = len <= 1 ? 22 : len === 2 ? 17 : len === 3 ? 13 : 10.5;
  return (
    <svg viewBox="0 0 32 32" className={`${className} shrink-0 rounded-md`} role="img" aria-label={preset.name}>
      <rect width="32" height="32" rx="6" fill={preset.bg} />
      <text
        x="16" y="16.5" textAnchor="middle" dominantBaseline="central"
        fill={preset.fg} fontSize={size} fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
        letterSpacing={len >= 3 ? "-0.3" : "0"}
      >
        {preset.short}
      </text>
    </svg>
  );
}

/**
 * A preset's mark: the bank's real logo on a white square (logos are made for
 * light backgrounds, so dark mode keeps the white), else its coloured tile —
 * also used if the bundled file fails to load.
 */
function PresetMark({ preset, className, wideClassName }: { preset: AccountLogoPreset; className: string; wideClassName?: string }) {
  const [broken, setBroken] = useState(false);
  const src = accountLogoSrc(preset);
  if (!src || broken) return <PresetTile preset={preset} className={className} />;
  return (
    <span className={`${wideClassName ?? className} shrink-0 rounded-md bg-white border border-border/60 inline-flex items-center justify-center overflow-hidden p-0.5`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny bundled WebP */}
      <img src={src} alt={preset.name} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-contain" />
    </span>
  );
}

/**
 * An account's mark: the bank or wallet chosen from the list, else the icon
 * for its type. An image URL from before the list (when logos were uploaded)
 * is still drawn, falling back to the icon if it fails to load.
 */
export function AccountLogo({
  logoUrl, type, className = "size-8", wideClassName,
}: {
  logoUrl?: string | null;
  type: string;
  className?: string;
  /**
   * Size for a real bank logo — most are wide wordmarks, unreadable squeezed
   * into a square. Omitted, it gets the same box as everything else.
   */
  wideClassName?: string;
}) {
  const [broken, setBroken] = useState(false);
  const preset = accountLogoPreset(logoUrl);
  if (preset) return <PresetMark preset={preset} className={className} wideClassName={wideClassName} />;
  if (logoUrl && /^https?:\/\//.test(logoUrl) && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- older uploaded logo, tiny
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className={`${className} shrink-0 rounded-md object-contain bg-white border border-border/60`}
      />
    );
  }
  const Icon = TYPE_ICON[type as keyof typeof TYPE_ICON] ?? Wallet;
  return (
    <span className={`${className} shrink-0 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center`}>
      <Icon className="size-[55%]" />
    </span>
  );
}

/**
 * Logo picker for the account form: Pakistan's common banks and wallets, as
 * tiles. Picking one stores only its key — nothing is uploaded.
 */
export function AccountLogoField({
  logoUrl, type, onChange,
}: {
  logoUrl: string | null;
  type: string;
  onChange: (value: string | null, preset: AccountLogoPreset | null) => void;
}) {
  const selected = accountLogoPreset(logoUrl);
  // The list matching the account's type comes first.
  const groups: { kind: AccountLogoKind; title: string }[] =
    type === "wallet"
      ? [{ kind: "wallet", title: "Wallets" }, { kind: "bank", title: "Banks" }]
      : [{ kind: "bank", title: "Banks" }, { kind: "wallet", title: "Wallets" }];

  const tile = (active: boolean) =>
    `flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
    }`;

  return (
    <div className="space-y-2">
      <Label>Logo <span className="font-normal text-muted-foreground">(optional)</span></Label>
      <div className="max-h-64 overflow-y-auto rounded-lg border p-2 space-y-3">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          <button type="button" data-enter-skip className={tile(!logoUrl)} onClick={() => onChange(null, null)} aria-pressed={!logoUrl}>
            <AccountLogo type={type} className="size-10" />
            <span className="text-[10px] leading-tight text-muted-foreground">None</span>
          </button>
        </div>
        {groups.map((g) => (
          <div key={g.kind} className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.title}</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {ACCOUNT_LOGOS.filter((l) => l.kind === g.kind).map((l) => {
                const active = selected?.key === l.key;
                return (
                  <button
                    key={l.key} type="button" data-enter-skip title={l.name} aria-pressed={active}
                    className={`relative ${tile(active)}`}
                    onClick={() => onChange(accountLogoValue(l.key), l)}
                  >
                    <PresetMark preset={l} className="size-10" wideClassName="h-10 w-full" />
                    <span className="line-clamp-2 text-[10px] leading-tight">{l.name}</span>
                    {active && <Check className="absolute end-1 top-1 size-3 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
