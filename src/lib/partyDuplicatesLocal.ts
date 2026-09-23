import { getAll } from "@/lib/localDb";
import { findDuplicateParties, type DuplicateMatch, type PartyLike } from "@/lib/party-duplicates";

/**
 * Parties on this terminal that look like the one being entered — same name
 * or same phone. Reads the synced local copy, so the warning works with no
 * connection too (the web asks the server with the same matcher).
 */
export async function findDuplicatePartiesLocal(
  shopId: string | undefined | null,
  name: string,
  phone?: string | null,
  excludeId?: string | null,
): Promise<DuplicateMatch[]> {
  if (!shopId) return [];
  try {
    const rows = await getAll<PartyLike>("suppliers", shopId);
    return findDuplicateParties(rows, { name, phone }, excludeId);
  } catch {
    // A warning must never block the save itself.
    return [];
  }
}
