/**
 * Shapes returned by the craft customer actions on the server. Mirrors
 * `src/app/(app)/(pro)/customers/craft-actions.ts` in the web app — the
 * terminal reaches them over RPC, so the types have to be restated here.
 */
export interface CraftCustomer {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  /** Billed − received. Positive means the customer owes the shop. */
  balance: number;
  billed: number;
  received: number;
  challan_count: number;
}

export interface CustomerChallanDto {
  id: string;
  number: number;
  customer_id: string;
  customer_name: string;
  date: string;
  amount: number;
  due_date: string | null;
  bill_no: string | null;
  bilty_no: string | null;
  notes: string | null;
}

export interface CustomerPaymentDto {
  id: string;
  number: number;
  customer_id: string;
  customer_name: string;
  date: string;
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
}
