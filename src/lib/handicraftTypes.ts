import type { ChallanKindValue } from "@/lib/handicraft";

/**
 * Shapes returned by the handicraft server actions, mirrored here because the
 * desktop talks to them over the rpc bridge and can't import the Next app's
 * types. Keep in step with the web app's material-purchases/job-work actions
 * and src/lib/party-ledger.ts.
 */

export interface PartyOption {
  id: string;
  name: string;
  city: string | null;
  is_supplier: boolean;
  is_maker: boolean;
  is_processor: boolean;
}

export interface MaterialPurchaseItemDto {
  id: string;
  colour: string | null;
  act: string | null;
  bags: number;
  /** In the bill's unit — see MaterialPurchaseDto.weight_unit. */
  weight: number;
  rate: number;
  amount: number;
}

export interface MaterialPurchaseDto {
  id: string;
  number: number;
  book_number: string | null;
  date: string;
  supplier_id: string | null;
  supplier_name: string;
  city: string | null;
  bilty_number: string | null;
  weight_unit: "lb" | "kg";
  kg_per_bag: number;
  received_by: string | null;
  notes: string | null;
  total: number;
  items: MaterialPurchaseItemDto[];
}

export type PartyPaymentKindValue = "material" | "making" | "processing";

export interface PartyPaymentDto {
  id: string;
  number: number;
  kind: PartyPaymentKindValue;
  date: string;
  supplier_id: string;
  supplier_name: string;
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
}

export interface LedgerRow {
  kind: "opening" | "purchase" | "payment" | "job_work";
  id: string;
  itemId: string | null;
  date: string;
  number: number | null;
  book_number: string | null;
  supplier_id: string | null;
  supplier_name: string;
  city: string | null;
  bilty_number: string | null;
  colour: string | null;
  act: string | null;
  bags: number;
  weight: number;
  weight_unit: string | null;
  rate: number;
  debit: number;
  credit: number;
  balance: number;
  label: string | null;
  method: string | null;
  reference: string | null;
  note: string | null;
}

export interface LedgerResult {
  rows: LedgerRow[];
  opening: number;
  debit_total: number;
  purchase_total: number;
  job_work_total: number;
  credit_total: number;
  closing: number;
}

export interface PartyBalance {
  id: string;
  name: string;
  city: string | null;
  is_supplier: boolean;
  is_maker: boolean;
  is_processor: boolean;
  opening_balance: number;
  purchases_total: number;
  job_work_total: number;
  payments_total: number;
  balance: number;
}

export interface JobProcessDto {
  id: string;
  name: string;
  name_local: string | null;
  default_rate: number;
  sort_order: number;
  is_archived: boolean;
}

export interface ChallanItemDto {
  id: string;
  description: string;
  quantity: number;
  bundles: number | null;
  pieces_per_bundle: number | null;
  per_piece_weight: number | null;
  process_ids: string[];
  received: number;
  short: number;
  damaged: number;
  pending: number;
}

export interface ChallanDto {
  id: string;
  kind: ChallanKindValue;
  number: number;
  book_number: string | null;
  date: string;
  supplier_id: string;
  supplier_name: string;
  sent_via: string | null;
  sent_by: string | null;
  counted_by: string | null;
  total_bundles: number | null;
  notes: string | null;
  status: "open" | "closed";
  items: ChallanItemDto[];
  total_qty: number;
  total_pending: number;
  sent_weight: number;
  received_weight: number;
  pending_weight: number;
  receipts_count: number;
}

export interface ReceiptChargeDto {
  id: string;
  process_id: string | null;
  process_name: string;
  rate: number;
  quantity: number;
  amount: number;
}

export interface ReceiptItemDto {
  id: string;
  challan_item_id: string;
  description: string;
  received_qty: number;
  short_qty: number;
  damaged_qty: number;
  per_piece_weight: number | null;
  note: string | null;
  line_total: number;
  charges: ReceiptChargeDto[];
}

export interface ReceiptDto {
  id: string;
  kind: ChallanKindValue;
  number: number;
  book_number: string | null;
  date: string;
  challan_id: string;
  challan_number: number;
  supplier_id: string;
  supplier_name: string;
  received_via: string | null;
  notes: string | null;
  charges_total: number;
  deduction: number;
  total: number;
  paid_now: number;
  received_weight: number;
  items: ReceiptItemDto[];
}

export interface ReceiptDraftLine {
  challan_item_id: string;
  description: string;
  sent: number;
  pending: number;
  per_piece_weight: number | null;
  process_ids: string[];
}

export interface ReceiptDraft {
  challan: {
    id: string;
    kind: ChallanKindValue;
    sent_weight: number;
    received_weight: number;
    number: number;
    book_number: string | null;
    date: string;
    supplier_id: string;
    supplier_name: string;
  };
  lines: ReceiptDraftLine[];
  rates: Record<string, number>;
}

export interface AttachmentDto {
  id: string;
  entity_type: string;
  entity_id: string;
  url: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

export type AttachmentEntity =
  | "material_purchase"
  | "job_work_challan"
  | "job_work_receipt"
  | "party_payment";

/* ---------- reports ---------- */

export interface PurchasesByPartyRow {
  party_id: string;
  party: string;
  city: string | null;
  bills: number;
  lines: number;
  bags: number;
  weight_lb: number;
  weight_kg: number;
  amount: number;
}

export interface JobWorkByProcessRow {
  process: string;
  company: string;
  pieces: number;
  amount: number;
  avg_rate: number;
}

export interface PendingAtCompanyRow {
  kind: ChallanKindValue;
  company: string;
  city: string | null;
  challan_number: number;
  book_number: string | null;
  date: string;
  description: string;
  sent: number;
  received: number;
  short: number;
  damaged: number;
  pending: number;
  days_out: number;
}

export interface PartyBalanceReportRow {
  party: string;
  city: string | null;
  roles: string;
  opening: number;
  purchases: number;
  job_work: number;
  paid: number;
  balance: number;
}

/* ---------- dashboard ---------- */

export interface CompanyPending {
  id: string;
  name: string;
  city: string | null;
  pieces: number;
  challans: number;
  oldest_days: number;
}

export interface PartyBalanceRow {
  id: string;
  name: string;
  city: string | null;
  role: string;
  balance: number;
}

export interface CraftDashboard {
  payable_total: number;
  payable_material: number;
  payable_job_work: number;
  in_credit: number;
  pieces_at_companies: number;
  open_challans: number;
  month_purchases: number;
  month_job_work: number;
  month_payments: number;
  month_label: string;
  by_company: CompanyPending[];
  top_balances: PartyBalanceRow[];
}


/** What the handicraft dashboard needs, straight off craftDashboardStats. */
export interface CompanyPending {
  id: string;
  name: string;
  city: string | null;
  kind: ChallanKindValue;
  pieces: number;
  challans: number;
  oldest_days: number;
}

export interface PartyBalanceRow {
  id: string;
  name: string;
  city: string | null;
  roles: string;
  balance: number;
}

export interface CraftDashboard {
  payable_total: number;
  payable_material: number;
  payable_job_work: number;
  in_credit: number;
  pieces_at_companies: number;
  pieces_at_processors: number;
  open_making_jobs: number;
  open_challans: number;
  month_purchases: number;
  month_job_work: number;
  month_payments: number;
  month_label: string;
  by_company: CompanyPending[];
  top_balances: PartyBalanceRow[];
}
