-- Sequential invoice and credit note numbering.
-- Format: INV-2026-00001, CN-2026-00001 (5-digit sequence, resets yearly).
-- Invoices are immutable legal documents — never modified or deleted.

-- ============================================================
-- 1. Sequence counter table
-- ============================================================

CREATE TABLE document_sequences (
  type TEXT NOT NULL,           -- 'invoice' or 'credit_note'
  year SMALLINT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  PRIMARY KEY (type, year)
);

ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
-- No public policies — service role only via RPC

-- ============================================================
-- 2. Invoices table
-- ============================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('invoice', 'credit_note')),
  document_number TEXT NOT NULL UNIQUE,
  reference_invoice_id UUID REFERENCES invoices(id),
  issued_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, type)
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_invoices_order_id ON invoices(order_id);

-- Sellers see invoices for their orders
CREATE POLICY "Sellers can view own invoices" ON invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders WHERE orders.id = invoices.order_id AND orders.seller_id = auth.uid()
  ));

-- Buyers see invoices for their orders
CREATE POLICY "Buyers can view own invoices" ON invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders WHERE orders.id = invoices.order_id AND orders.buyer_id = auth.uid()
  ));

-- ============================================================
-- 3. Denormalized columns on orders for quick display
-- ============================================================

ALTER TABLE orders ADD COLUMN invoice_number TEXT;
ALTER TABLE orders ADD COLUMN credit_note_number TEXT;

-- ============================================================
-- 4. Immutability trigger
-- Invoices are legal documents — block all modifications.
-- To correct data in emergencies: disable trigger, fix, re-enable.
-- See operations guide for the procedure.
-- ============================================================

CREATE OR REPLACE FUNCTION public.invoices_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Invoices are immutable — issue a credit note instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_invoice_mutation
  BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoices_immutable();

-- ============================================================
-- 5. RPC: issue_document_number
-- Atomically increments the sequence, inserts the invoice row,
-- and denormalizes onto orders. Idempotent per (order_id, type).
-- ============================================================

CREATE OR REPLACE FUNCTION public.issue_document_number(
  p_order_id UUID,
  p_type TEXT,
  p_reference_invoice_id UUID DEFAULT NULL,
  p_issued_at TIMESTAMPTZ DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_issued TIMESTAMPTZ;
  v_year SMALLINT;
  v_next INT;
  v_prefix TEXT;
  v_number TEXT;
BEGIN
  -- Validate type
  IF p_type = 'invoice' THEN
    v_prefix := 'INV';
  ELSIF p_type = 'credit_note' THEN
    v_prefix := 'CN';
    IF p_reference_invoice_id IS NULL THEN
      RAISE EXCEPTION 'Credit note requires reference_invoice_id';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid document type: %', p_type;
  END IF;

  -- Lock the order row to serialize concurrent calls for the same order
  PERFORM id FROM public.orders WHERE id = p_order_id FOR UPDATE;

  -- Idempotency: return existing document if already issued
  SELECT document_number INTO v_number FROM public.invoices
    WHERE order_id = p_order_id AND type = p_type;
  IF FOUND THEN
    RETURN v_number;
  END IF;

  -- Derive year from Riga time (Latvia EET/EEST)
  v_issued := COALESCE(p_issued_at, NOW());
  v_year := EXTRACT(YEAR FROM v_issued AT TIME ZONE 'Europe/Riga')::SMALLINT;

  -- Atomic increment
  INSERT INTO public.document_sequences (type, year, last_number)
  VALUES (p_type, v_year, 1)
  ON CONFLICT (type, year)
  DO UPDATE SET last_number = public.document_sequences.last_number + 1
  RETURNING last_number INTO v_next;

  -- Format: INV-2026-00001 or CN-2026-00001
  v_number := v_prefix || '-' || v_year || '-' || LPAD(v_next::TEXT, 5, '0');

  -- Insert invoice record (UNIQUE (order_id, type) enforces idempotency at DB level)
  INSERT INTO public.invoices (order_id, type, document_number, reference_invoice_id, issued_at)
  VALUES (p_order_id, p_type, v_number, p_reference_invoice_id, v_issued);

  -- Denormalize onto orders for quick display
  IF p_type = 'invoice' THEN
    UPDATE public.orders SET invoice_number = v_number WHERE id = p_order_id;
  ELSE
    UPDATE public.orders SET credit_note_number = v_number WHERE id = p_order_id;
  END IF;

  RETURN v_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_document_number(UUID, TEXT, UUID, TIMESTAMPTZ)
  FROM public, anon, authenticated;
