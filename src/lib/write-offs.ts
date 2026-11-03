/**
 * Shapes shared by the "Used & wasted" screen and its actions (cafe shops).
 * ⚠️ COPIED verbatim to the desktop, whose screen calls the same actions over RPC.
 */

export type WriteOffKind = "use" | "waste";

export const WRITE_OFF_KINDS: { value: WriteOffKind; label: string; hint: string; reasons: string[] }[] = [
  {
    value: "use",
    label: "Used in the shop",
    hint: "Cups, shopping bags, cleaning stuff — taken for the shop, not sold.",
    reasons: ["Packing", "Cleaning", "Staff", "Kitchen"],
  },
  {
    value: "waste",
    label: "Wasted",
    hint: "Spilt, expired, burnt or dropped.",
    reasons: ["Spilt", "Expired", "Burnt", "Dropped", "Spoiled"],
  },
];

export const writeOffKindLabel = (k: WriteOffKind) => WRITE_OFF_KINDS.find((x) => x.value === k)?.label ?? k;

export interface WriteOffProductDto {
  id: string;
  name: string;
  unit: string | null;
  stock: number;
  /** Average cost per unit (recipe cost for a made-to-order item); null when never bought. */
  cost: number | null;
  /** A made-to-order item writes off its ingredients, not itself. */
  made_to_order: boolean;
}

export interface WriteOffDto {
  id: string;
  kind: WriteOffKind;
  date: string;
  product_id: string;
  product_name: string;
  unit: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reason: string | null;
  notes: string | null;
}

export interface WriteOffsApi {
  formData: () => Promise<WriteOffProductDto[]>;
  list: (opts: { from: string; to: string }) => Promise<WriteOffDto[]>;
  create: (input: {
    kind: WriteOffKind;
    product_id: string;
    quantity: number;
    date: string;
    reason?: string | null;
    notes?: string | null;
  }) => Promise<{ ok: boolean; id?: string; error?: string }>;
  remove: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

/** Totals by kind, at cost — what the P&L takes off as "used in the shop" and "wastage". */
export function writeOffTotals(rows: { kind: string; total_cost: number | string }[]): { shopUse: number; wastage: number } {
  let shopUse = 0, wastage = 0;
  for (const r of rows) {
    const v = Number(r.total_cost) || 0;
    if (r.kind === "use") shopUse += v;
    else if (r.kind === "waste") wastage += v;
  }
  return { shopUse: Math.round(shopUse * 100) / 100, wastage: Math.round(wastage * 100) / 100 };
}
