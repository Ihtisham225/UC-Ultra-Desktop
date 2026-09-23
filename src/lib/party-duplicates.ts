/**
 * Spotting a customer or supplier that is about to be entered twice.
 *
 * ⚠️ Pure and COPIED VERBATIM into the desktop (`src/lib/party-duplicates.ts`
 * there). The web asks the server for the shop's parties; the terminal checks
 * its own synced copy, so the warning works offline too. Change both together.
 *
 * Why it exists: SHAMSHER CORPORATION added "Qamar Gul Machine Takhtaband"
 * twice with the same phone, deleted the wrong one, and a credit bill rung
 * against the ghost never reached the server. A duplicate is sometimes real
 * (two people with one name), so this WARNS — it never refuses.
 */

export interface PartyLike {
  id: string;
  name: string;
  phone?: string | null;
  is_customer?: boolean | null;
  is_supplier?: boolean | null;
  is_maker?: boolean | null;
  is_processor?: boolean | null;
}

export interface DuplicateMatch {
  id: string;
  name: string;
  phone: string | null;
  /** What matched: the name, the phone, or both. */
  on: "name" | "phone" | "both";
  /** "customer", "supplier", "customer & supplier"… for the warning. */
  roles: string;
  is_customer: boolean;
  /** Any of the selling roles: supplier, maker or processor. */
  is_seller: boolean;
}

/** Case, spacing and punctuation-insensitive: "Qamar  Gul." = "qamar gul". */
export function partyNameKey(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Digits only, with Pakistan's country code folded into the local form, so
 * "0331-0416678", "+92 331 0416678" and "923310416678" are one number. Too
 * short to identify anyone (under 7 digits) → no key, never a match.
 */
export function partyPhoneKey(phone: string | null | undefined): string {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(2);
  if (d.length === 12 && d.startsWith("92")) d = `0${d.slice(2)}`;
  if (d.length === 10 && d.startsWith("3")) d = `0${d}`;
  return d.length >= 7 ? d : "";
}

function rolesOf(p: PartyLike): string {
  const r = [
    p.is_customer ? "customer" : null,
    p.is_supplier ? "supplier" : null,
    p.is_maker ? "maker" : null,
    p.is_processor ? "processor" : null,
  ].filter(Boolean) as string[];
  return r.length ? r.join(" & ") : "party";
}

/**
 * Parties that look like the one being entered — same name, or same phone.
 * `excludeId` leaves out the record being edited, so saving it unchanged is
 * never flagged. Exact name + phone matches come first.
 */
export function findDuplicateParties(
  parties: readonly PartyLike[],
  entry: { name: string; phone?: string | null },
  excludeId?: string | null,
): DuplicateMatch[] {
  const name = partyNameKey(entry.name);
  const phone = partyPhoneKey(entry.phone);
  if (!name && !phone) return [];
  const out: DuplicateMatch[] = [];
  for (const p of parties) {
    if (!p?.id || p.id === excludeId) continue;
    const byName = !!name && partyNameKey(p.name) === name;
    const byPhone = !!phone && partyPhoneKey(p.phone) === phone;
    if (!byName && !byPhone) continue;
    out.push({
      id: p.id,
      name: p.name,
      phone: p.phone ?? null,
      on: byName && byPhone ? "both" : byName ? "name" : "phone",
      roles: rolesOf(p),
      is_customer: !!p.is_customer,
      is_seller: !!(p.is_supplier || p.is_maker || p.is_processor),
    });
  }
  const rank = { both: 0, name: 1, phone: 2 } as const;
  return out.sort((a, b) => rank[a.on] - rank[b.on]);
}
