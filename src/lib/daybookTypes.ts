/**
 * Shapes returned by the Roznamcha (daybook) actions on the server. Mirrors
 * `src/app/(app)/(pro)/daybook/actions.ts` in the web app — the terminal
 * reaches them over RPC, so the types have to be restated here.
 *
 * ⚠️ Not a synced table. Like the rest of the craft register it is server-only,
 * so the daybook needs a connection — and unlike the till, nothing about it is
 * offline-first.
 */
import type { DaybookDirectionValue, DaybookKindValue, DaybookLinkTarget } from "@/lib/daybook";

export interface DaybookEntryDto {
  id: string;
  number: number;
  date: string;
  direction: DaybookDirectionValue;
  kind: DaybookKindValue;
  party_id: string | null;
  /** Always set — the name as it was written, party or not. */
  party_name: string;
  amount: number;
  description: string | null;
  quantity: number;
  unit: string | null;
  notes: string | null;
  /** ISO timestamp once ticked off; null while the line is still pending. */
  completed_at: string | null;
  linked_type: DaybookLinkTarget | null;
  linked_id: string | null;
  linked_label: string | null;
}

/**
 * What a day's sheet comes to. Money in and out are the only figures that add
 * up — material lines are counted, not totalled, because a kilo of yarn and a
 * piece of shawl don't sum to anything.
 */
export interface DaybookSummary {
  money_in: number;
  money_out: number;
  material_in: number;
  material_out: number;
  pending: number;
  completed: number;
}

export interface DaybookEntryInput {
  date: string;
  direction: DaybookDirectionValue;
  kind: DaybookKindValue;
  party_id?: string | null;
  party_name: string;
  amount?: number;
  description?: string | null;
  quantity?: number;
  unit?: string | null;
  notes?: string | null;
}

export interface DaybookFilters {
  from?: string | null;
  to?: string | null;
  party_id?: string | null;
}
