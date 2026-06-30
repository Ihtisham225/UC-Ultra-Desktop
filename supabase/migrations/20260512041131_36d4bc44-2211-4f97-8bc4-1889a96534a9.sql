-- Add kind column to debt_payments to distinguish payments (reduce balance)
-- from increases (add more debt to the same person).
ALTER TABLE public.debt_payments
ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'payment';

ALTER TABLE public.debt_payments
DROP CONSTRAINT IF EXISTS debt_payments_kind_check;

ALTER TABLE public.debt_payments
ADD CONSTRAINT debt_payments_kind_check
CHECK (kind IN ('payment', 'increase'));