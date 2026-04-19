-- Add expected_amount to payments (valor devido do mes).
-- amount remains the valor pago (paid amount).
-- PostgreSQL / Supabase compatible.

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS expected_amount numeric(10,2);

-- Backfill: existing rows treat current amount as both due and paid.
UPDATE public.payments
SET expected_amount = amount
WHERE expected_amount IS NULL;
