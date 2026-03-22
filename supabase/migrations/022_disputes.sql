-- Week 6: Dispute resolution system
-- Adds disputes table, updates wallet transaction types for refunds,
-- and creates storage bucket for dispute photo evidence.

-- ============================================================================
-- DISPUTES TABLE
-- ============================================================================
-- Separate from orders to keep lifecycle, photos, and staff notes independent.
-- One dispute per order enforced via UNIQUE constraint.

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES user_profiles(id),
  seller_id UUID NOT NULL REFERENCES user_profiles(id),

  -- Opening
  reason TEXT NOT NULL CHECK (char_length(reason) >= 10),
  photos TEXT[] NOT NULL DEFAULT '{}',

  -- Escalation
  escalated_at TIMESTAMPTZ,
  escalated_by UUID REFERENCES user_profiles(id),

  -- Resolution
  resolution TEXT CHECK (resolution IN ('refunded', 'resolved_no_refund')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES user_profiles(id),
  resolution_notes TEXT,

  -- Refund tracking
  refund_amount_cents INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_disputes_order_id ON disputes(order_id);
CREATE INDEX idx_disputes_unresolved ON disputes(created_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_disputes_escalated_unresolved ON disputes(escalated_at)
  WHERE escalated_at IS NOT NULL AND resolved_at IS NULL;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Buyers and sellers can read their own disputes
CREATE POLICY "Users can view own disputes" ON disputes
  FOR SELECT USING (
    auth.uid() = buyer_id OR auth.uid() = seller_id
  );

-- Staff can read all disputes
CREATE POLICY "Staff can view all disputes" ON disputes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_staff = TRUE)
  );

-- All writes go through service role (same pattern as orders, wallets)

-- ============================================================================
-- WALLET TRANSACTION TYPE UPDATE
-- ============================================================================
-- Add 'refund' type for buyer refund credits (separate from seller 'credit'
-- to maintain idempotency — same order can have both a seller credit and a buyer refund)

ALTER TABLE wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('credit', 'debit', 'withdrawal', 'refund'));

-- ============================================================================
-- STORAGE BUCKET FOR DISPUTE PHOTOS
-- ============================================================================
-- Note: Storage bucket creation is done via Supabase dashboard or management API.
-- Bucket name: dispute-photos
-- Public read access, authenticated upload to own {user_id}/ folder.
-- Run this in the Supabase SQL editor if storage policies need to be set up:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('dispute-photos', 'dispute-photos', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Authenticated users can upload dispute photos"
-- ON storage.objects FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'dispute-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
--
-- CREATE POLICY "Anyone can view dispute photos"
-- ON storage.objects FOR SELECT TO public
-- USING (bucket_id = 'dispute-photos');
