-- Migration: withdrawal_reference_number
-- Adds human-readable sequential reference to withdrawal_requests for use
-- in SEPA remittance field when paying sellers from platform bank account.
-- Format: WD-YYYY-NNNNN (e.g. WD-2026-00001). Year boundary uses Europe/Riga.
--
-- Sequence gaps are acceptable: createWithdrawalRequest inserts the row (trigger
-- consumes a number) and then debits the wallet via RPC; if the debit fails it
-- rolls back by deleting the row, leaving an unused reference. Unlike invoice
-- numbering, withdrawal references are an operational identifier, not a legal
-- document, so gaps are fine.

-- 1. Add column (nullable initially for backfill)
ALTER TABLE public.withdrawal_requests
  ADD COLUMN reference_number TEXT;

-- 2. Sequence issuance helper (parallel to issue_document_number, decoupled from orders/invoices)
CREATE OR REPLACE FUNCTION public.issue_withdrawal_reference(p_issued_at TIMESTAMPTZ DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_issued TIMESTAMPTZ;
  v_year   SMALLINT;
  v_next   INT;
BEGIN
  v_issued := COALESCE(p_issued_at, NOW());
  v_year   := EXTRACT(YEAR FROM v_issued AT TIME ZONE 'Europe/Riga')::SMALLINT;

  INSERT INTO public.document_sequences (type, year, last_number)
  VALUES ('withdrawal', v_year, 1)
  ON CONFLICT (type, year) DO UPDATE
    SET last_number = public.document_sequences.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN 'WD-' || v_year || '-' || LPAD(v_next::TEXT, 5, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_withdrawal_reference(TIMESTAMPTZ)
  FROM public, anon, authenticated;

-- 3. BEFORE INSERT trigger — fills reference_number if not provided
CREATE OR REPLACE FUNCTION public.withdrawal_requests_set_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.reference_number IS NULL THEN
    NEW.reference_number := public.issue_withdrawal_reference(NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER withdrawal_requests_set_reference_trigger
  BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.withdrawal_requests_set_reference();

-- 4. Backfill existing rows in chronological order (only 1 row today; safe)
DO $$
DECLARE
  r RECORD;
  v_ref TEXT;
BEGIN
  FOR r IN
    SELECT id, created_at
    FROM public.withdrawal_requests
    WHERE reference_number IS NULL
    ORDER BY created_at ASC
  LOOP
    v_ref := public.issue_withdrawal_reference(r.created_at);
    UPDATE public.withdrawal_requests SET reference_number = v_ref WHERE id = r.id;
  END LOOP;
END;
$$;

-- 5. Enforce NOT NULL + uniqueness now that backfill is done
ALTER TABLE public.withdrawal_requests
  ALTER COLUMN reference_number SET NOT NULL,
  ADD CONSTRAINT withdrawal_requests_reference_number_key UNIQUE (reference_number);
