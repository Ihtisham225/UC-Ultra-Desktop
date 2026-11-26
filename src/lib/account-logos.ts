/**
 * The marks a money account can carry — a fixed list of Pakistan's common
 * banks and wallets. Nothing is uploaded or stored but the key:
 * `money_accounts.logo_url` holds `preset:<key>` (e.g. "preset:easypaisa").
 *
 * A preset with `image: true` has the bank's real logo bundled with the app
 * as `public/account-logos/<key>.webp` (from Wikipedia/Wikimedia Commons,
 * shrunk to ≤192×96, a few KB each). The rest — and any image that fails to
 * load — are drawn as a coloured tile with a short name.
 *
 * COPIED to the desktop (src/lib/account-logos.ts) — identical except
 * ACCOUNT_LOGO_DIR, and the desktop's public/account-logos holds the same files.
 */

/** Where the bundled logo files are served from. Desktop: "./account-logos/" (relative base, file://). */
export const ACCOUNT_LOGO_DIR = "./account-logos/";

export type AccountLogoKind = "wallet" | "bank";

export interface AccountLogoPreset {
  key: string;
  /** Full name, shown under the tile in the picker and used to prefill the account name. */
  name: string;
  /** What the tile says — two to four letters. */
  short: string;
  kind: AccountLogoKind;
  bg: string;
  fg: string;
  /** A real logo is bundled as `<ACCOUNT_LOGO_DIR><key>.webp`. */
  image?: boolean;
}

export const ACCOUNT_LOGOS: AccountLogoPreset[] = [
  // Wallets
  { key: "easypaisa", name: "Easypaisa", short: "ep", kind: "wallet", bg: "#2EB24A", fg: "#FFFFFF", image: true },
  { key: "jazzcash", name: "JazzCash", short: "JC", kind: "wallet", bg: "#E31B23", fg: "#FFC20E", image: true },
  { key: "sadapay", name: "SadaPay", short: "SP", kind: "wallet", bg: "#F7705F", fg: "#FFFFFF" },
  { key: "nayapay", name: "NayaPay", short: "NP", kind: "wallet", bg: "#1F2A44", fg: "#FF7A33" },
  { key: "upaisa", name: "UPaisa", short: "UP", kind: "wallet", bg: "#F37021", fg: "#FFFFFF" },
  { key: "zindigi", name: "Zindigi", short: "Z", kind: "wallet", bg: "#5B2C83", fg: "#FFFFFF" },
  { key: "hbl_konnect", name: "HBL Konnect", short: "HK", kind: "wallet", bg: "#00836C", fg: "#FFFFFF" },
  // Banks
  { key: "hbl", name: "HBL", short: "HBL", kind: "bank", bg: "#00836C", fg: "#FFFFFF", image: true },
  { key: "ubl", name: "UBL", short: "UBL", kind: "bank", bg: "#0B5FA5", fg: "#FFFFFF", image: true },
  { key: "mcb", name: "MCB Bank", short: "MCB", kind: "bank", bg: "#00703C", fg: "#FFFFFF", image: true },
  { key: "meezan", name: "Meezan Bank", short: "MBL", kind: "bank", bg: "#6C2C74", fg: "#FFFFFF", image: true },
  { key: "alfalah", name: "Bank Alfalah", short: "BAF", kind: "bank", bg: "#D71921", fg: "#FFFFFF", image: true },
  { key: "abl", name: "Allied Bank", short: "ABL", kind: "bank", bg: "#1C4E9D", fg: "#FFFFFF", image: true },
  { key: "nbp", name: "National Bank", short: "NBP", kind: "bank", bg: "#00764B", fg: "#FFFFFF", image: true },
  { key: "bahl", name: "Bank Al Habib", short: "BAH", kind: "bank", bg: "#00614A", fg: "#FFFFFF", image: true },
  { key: "askari", name: "Askari Bank", short: "AKBL", kind: "bank", bg: "#003A70", fg: "#FFFFFF", image: true },
  { key: "faysal", name: "Faysal Bank", short: "FBL", kind: "bank", bg: "#0E7C86", fg: "#FFFFFF", image: true },
  { key: "habibmetro", name: "HabibMetro", short: "HMB", kind: "bank", bg: "#00594F", fg: "#FFFFFF", image: true },
  { key: "scb", name: "Standard Chartered", short: "SC", kind: "bank", bg: "#0072AA", fg: "#FFFFFF", image: true },
  { key: "js", name: "JS Bank", short: "JS", kind: "bank", bg: "#1B3664", fg: "#FFFFFF", image: true },
  { key: "bop", name: "Bank of Punjab", short: "BOP", kind: "bank", bg: "#0A7F3F", fg: "#FFFFFF", image: true },
  { key: "dib", name: "Dubai Islamic Bank", short: "DIB", kind: "bank", bg: "#00508E", fg: "#FFFFFF", image: true },
  { key: "bankislami", name: "BankIslami", short: "BI", kind: "bank", bg: "#0091C9", fg: "#FFFFFF", image: true },
  { key: "soneri", name: "Soneri Bank", short: "SNB", kind: "bank", bg: "#C8102E", fg: "#FFD100", image: true },
  { key: "albaraka", name: "Al Baraka Bank", short: "ALB", kind: "bank", bg: "#8C6D1F", fg: "#FFFFFF", image: true },
  { key: "sindh", name: "Sindh Bank", short: "SB", kind: "bank", bg: "#00A19A", fg: "#FFFFFF" },
  { key: "khyber", name: "Bank of Khyber", short: "BOK", kind: "bank", bg: "#005C35", fg: "#FFFFFF", image: true },
];

const PREFIX = "preset:";
const BY_KEY = new Map(ACCOUNT_LOGOS.map((l) => [l.key, l]));

/** The stored value for a preset. */
export const accountLogoValue = (key: string): string => `${PREFIX}${key}`;

/** The preset a stored value names, or null (empty, unknown, or an older uploaded image URL). */
export function accountLogoPreset(value: string | null | undefined): AccountLogoPreset | null {
  if (!value || !value.startsWith(PREFIX)) return null;
  return BY_KEY.get(value.slice(PREFIX.length)) ?? null;
}

/** The bundled logo file for a preset, or null when it is drawn as a tile. */
export const accountLogoSrc = (p: AccountLogoPreset): string | null =>
  p.image ? `${ACCOUNT_LOGO_DIR}${p.key}.webp` : null;

/** Whether a value names a preset on the list. */
export const isAccountLogoValue = (value: string): boolean => accountLogoPreset(value) !== null;
