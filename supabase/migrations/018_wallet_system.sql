-- Week 5: Wallet system, transaction ledger, withdrawal requests, VAT tracking
-- Adds financial infrastructure for seller earnings, buyer wallet checkout, and staff management

-- ============================================================================
-- WALLETS TABLE
-- ============================================================================
-- One wallet per user, lazy-created on first credit/debit.
-- The CHECK constraint is the ultimate safety net against negative balances.

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Users can read their own wallet
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Staff can read all wallets
CREATE POLICY "Staff can view all wallets" ON wallets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_staff = TRUE)
  );

-- All writes go through service role (no INSERT/UPDATE/DELETE policies for users)

-- ============================================================================
-- WALLET TRANSACTIONS TABLE (append-only ledger)
-- ============================================================================
-- Every wallet balance change is recorded here for audit trail.
-- amount_cents is always positive; the 'type' column determines direction.
-- RESTRICT on wallet FK: never lose financial records.

CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'withdrawal')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  balance_after_cents INTEGER NOT NULL,
  order_id UUID REFERENCES orders(id),
  withdrawal_id UUID, -- FK added after withdrawal_requests table is created
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own transactions
CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Staff can read all transactions
CREATE POLICY "Staff can view all transactions" ON wallet_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_staff = TRUE)
  );

-- Indexes for performance
CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX idx_wallet_transactions_order_id ON wallet_transactions(order_id) WHERE order_id IS NOT NULL;

-- ============================================================================
-- WITHDRAWAL REQUESTS TABLE
-- ============================================================================

CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
  bank_account_holder TEXT NOT NULL,
  bank_iban TEXT NOT NULL,
  staff_notes TEXT,
  reviewed_by UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own withdrawal requests
CREATE POLICY "Users can view own withdrawals" ON withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own withdrawal requests
CREATE POLICY "Users can create own withdrawals" ON withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Staff can read all withdrawal requests
CREATE POLICY "Staff can view all withdrawals" ON withdrawal_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_staff = TRUE)
  );

-- Index for staff dashboard filtering
CREATE INDEX idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);

-- ============================================================================
-- ADD FK from wallet_transactions to withdrawal_requests
-- ============================================================================

ALTER TABLE wallet_transactions
  ADD CONSTRAINT fk_wallet_transactions_withdrawal
  FOREIGN KEY (withdrawal_id) REFERENCES withdrawal_requests(id);

-- ============================================================================
-- VAT TRACKING COLUMNS ON ORDERS
-- ============================================================================
-- Store commission and shipping VAT breakdown per order for reporting.

ALTER TABLE orders ADD COLUMN commission_net_cents INTEGER;
ALTER TABLE orders ADD COLUMN commission_vat_cents INTEGER;
ALTER TABLE orders ADD COLUMN shipping_net_cents INTEGER;
ALTER TABLE orders ADD COLUMN shipping_vat_cents INTEGER;

-- ============================================================================
-- WALLET DEBIT ON CHECKOUT SESSIONS
-- ============================================================================
-- Track how much wallet balance the buyer intends to use for this checkout.

ALTER TABLE checkout_sessions ADD COLUMN wallet_debit_cents INTEGER DEFAULT 0;
