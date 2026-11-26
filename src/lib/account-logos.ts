/**
 * The marks a money account can carry — a fixed list of Pakistan's common
 * banks and wallets, drawn in the app as a coloured tile with a short name.
 * Nothing is uploaded or stored but the key: `money_accounts.logo_url` holds
 * `preset:<key>` (e.g. "preset:easypaisa").
 *
 * The colours are each brand's familiar colour, so the tile is easy to spot
 * in a list; they are recognition marks, not the brands' artwork.
 *
 * COPIED verbatim to the desktop (src/lib/account-logos.ts) — keep in step.
 */

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
}

export const ACCOUNT_LOGOS: AccountLogoPreset[] = [
  // Wallets
  { key: "easypaisa", name: "Easypaisa", short: "ep", kind: "wallet", bg: "#2EB24A", fg: "#FFFFFF" },
  { key: "jazzcash", name: "JazzCash", short: "JC", kind: "wallet", bg: "#E31B23", fg: "#FFC20E" },
  { key: "sadapay", name: "SadaPay", short: "SP", kind: "wallet", bg: "#F7705F", fg: "#FFFFFF" },
  { key: "nayapay", name: "NayaPay", short: "NP", kind: "wallet", bg: "#1F2A44", fg: "#FF7A33" },
  { key: "upaisa", name: "UPaisa", short: "UP", kind: "wallet", bg: "#F37021", fg: "#FFFFFF" },
  { key: "zindigi", name: "Zindigi", short: "Z", kind: "wallet", bg: "#5B2C83", fg: "#FFFFFF" },
  { key: "hbl_konnect", name: "HBL Konnect", short: "HK", kind: "wallet", bg: "#00836C", fg: "#FFFFFF" },
  // Banks
  { key: "hbl", name: "HBL", short: "HBL", kind: "bank", bg: "#00836C", fg: "#FFFFFF" },
  { key: "ubl", name: "UBL", short: "UBL", kind: "bank", bg: "#0B5FA5", fg: "#FFFFFF" },
  { key: "mcb", name: "MCB Bank", short: "MCB", kind: "bank", bg: "#00703C", fg: "#FFFFFF" },
  { key: "meezan", name: "Meezan Bank", short: "MBL", kind: "bank", bg: "#6C2C74", fg: "#FFFFFF" },
  { key: "alfalah", name: "Bank Alfalah", short: "BAF", kind: "bank", bg: "#D71921", fg: "#FFFFFF" },
  { key: "abl", name: "Allied Bank", short: "ABL", kind: "bank", bg: "#1C4E9D", fg: "#FFFFFF" },
  { key: "nbp", name: "National Bank", short: "NBP", kind: "bank", bg: "#00764B", fg: "#FFFFFF" },
  { key: "bahl", name: "Bank Al Habib", short: "BAH", kind: "bank", bg: "#00614A", fg: "#FFFFFF" },
  { key: "askari", name: "Askari Bank", short: "AKBL", kind: "bank", bg: "#003A70", fg: "#FFFFFF" },
  { key: "faysal", name: "Faysal Bank", short: "FBL", kind: "bank", bg: "#0E7C86", fg: "#FFFFFF" },
  { key: "habibmetro", name: "HabibMetro", short: "HMB", kind: "bank", bg: "#00594F", fg: "#FFFFFF" },
  { key: "scb", name: "Standard Chartered", short: "SC", kind: "bank", bg: "#0072AA", fg: "#FFFFFF" },
  { key: "js", name: "JS Bank", short: "JS", kind: "bank", bg: "#1B3664", fg: "#FFFFFF" },
  { key: "bop", name: "Bank of Punjab", short: "BOP", kind: "bank", bg: "#0A7F3F", fg: "#FFFFFF" },
  { key: "dib", name: "Dubai Islamic Bank", short: "DIB", kind: "bank", bg: "#00508E", fg: "#FFFFFF" },
  { key: "bankislami", name: "BankIslami", short: "BI", kind: "bank", bg: "#0091C9", fg: "#FFFFFF" },
  { key: "soneri", name: "Soneri Bank", short: "SNB", kind: "bank", bg: "#C8102E", fg: "#FFD100" },
  { key: "albaraka", name: "Al Baraka Bank", short: "ALB", kind: "bank", bg: "#8C6D1F", fg: "#FFFFFF" },
  { key: "sindh", name: "Sindh Bank", short: "SB", kind: "bank", bg: "#00A19A", fg: "#FFFFFF" },
  { key: "khyber", name: "Bank of Khyber", short: "BOK", kind: "bank", bg: "#005C35", fg: "#FFFFFF" },
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

/** Whether a value names a preset on the list. */
export const isAccountLogoValue = (value: string): boolean => accountLogoPreset(value) !== null;
