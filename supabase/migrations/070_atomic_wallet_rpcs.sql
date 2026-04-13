-- Atomic wallet operations via Postgres RPCs
--
-- Wraps balance update + transaction insert in a single SQL transaction
-- to prevent drift (balance changes without audit trail) and leverage
-- the UNIQUE(order_id, type) index for DB-level idempotency.

-- ============================================================
-- wallet_credit: seller earnings on order completion
-- Returns the transaction row. Idempotent via UNIQUE index.
-- ============================================================

CREATE OR REPLACE FUNCTION public.wallet_credit(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_order_id UUID,
  p_description TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_txn public.wallet_transactions%ROWTYPE;
  v_new_balance INTEGER;
BEGIN
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive';
  END IF;

  -- Idempotency: return existing transaction if already credited
  SELECT * INTO v_txn FROM public.wallet_transactions
    WHERE order_id = p_order_id AND type = 'credit';
  IF FOUND THEN
    RETURN to_jsonb(v_txn);
  END IF;

  -- Get or create wallet (with row lock)
  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_wallet FROM public.wallets
      WHERE user_id = p_user_id FOR UPDATE;
  END IF;

  -- Update balance
  v_new_balance := v_wallet.balance_cents + p_amount_cents;
  UPDATE public.wallets SET balance_cents = v_new_balance
    WHERE id = v_wallet.id;

  -- Insert transaction (UNIQUE index enforces idempotency at DB level)
  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount_cents, balance_after_cents,
    order_id, description
  ) VALUES (
    v_wallet.id, p_user_id, 'credit', p_amount_cents, v_new_balance,
    p_order_id, p_description
  ) RETURNING * INTO v_txn;

  RETURN to_jsonb(v_txn);
END;
$$;

-- ============================================================
-- wallet_debit: buyer spending wallet balance at checkout
-- Raises exception on insufficient balance.
-- ============================================================

CREATE OR REPLACE FUNCTION public.wallet_debit(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_order_id UUID,
  p_description TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_txn public.wallet_transactions%ROWTYPE;
  v_new_balance INTEGER;
BEGIN
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Debit amount must be positive';
  END IF;

  -- Idempotency: return existing transaction if already debited
  SELECT * INTO v_txn FROM public.wallet_transactions
    WHERE order_id = p_order_id AND type = 'debit';
  IF FOUND THEN
    RETURN to_jsonb(v_txn);
  END IF;

  -- Get wallet with row lock
  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE:% %', p_amount_cents, 0;
  END IF;

  v_new_balance := v_wallet.balance_cents - p_amount_cents;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE:% %', p_amount_cents, v_wallet.balance_cents;
  END IF;

  -- Update balance
  UPDATE public.wallets SET balance_cents = v_new_balance
    WHERE id = v_wallet.id;

  -- Insert transaction
  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount_cents, balance_after_cents,
    order_id, description
  ) VALUES (
    v_wallet.id, p_user_id, 'debit', p_amount_cents, v_new_balance,
    p_order_id, p_description
  ) RETURNING * INTO v_txn;

  RETURN to_jsonb(v_txn);
END;
$$;

-- ============================================================
-- wallet_refund: buyer refund on dispute/cancellation
-- ============================================================

CREATE OR REPLACE FUNCTION public.wallet_refund(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_order_id UUID,
  p_description TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_txn public.wallet_transactions%ROWTYPE;
  v_new_balance INTEGER;
BEGIN
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  -- Idempotency: return existing transaction if already refunded
  SELECT * INTO v_txn FROM public.wallet_transactions
    WHERE order_id = p_order_id AND type = 'refund';
  IF FOUND THEN
    RETURN to_jsonb(v_txn);
  END IF;

  -- Get or create wallet (with row lock)
  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_wallet FROM public.wallets
      WHERE user_id = p_user_id FOR UPDATE;
  END IF;

  -- Update balance
  v_new_balance := v_wallet.balance_cents + p_amount_cents;
  UPDATE public.wallets SET balance_cents = v_new_balance
    WHERE id = v_wallet.id;

  -- Insert transaction
  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount_cents, balance_after_cents,
    order_id, description
  ) VALUES (
    v_wallet.id, p_user_id, 'refund', p_amount_cents, v_new_balance,
    p_order_id, p_description
  ) RETURNING * INTO v_txn;

  RETURN to_jsonb(v_txn);
END;
$$;

-- Restrict execution to service role only (these bypass RLS)
REVOKE EXECUTE ON FUNCTION public.wallet_credit(UUID, INTEGER, UUID, TEXT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_debit(UUID, INTEGER, UUID, TEXT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_refund(UUID, INTEGER, UUID, TEXT) FROM public, anon, authenticated;
