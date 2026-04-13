-- Atomic withdrawal operations via Postgres RPCs
--
-- Completes the wallet atomicity migration started in 070.
-- createWithdrawalRequest and creditBackRejectedWithdrawal had the same
-- non-atomic balance-update + transaction-insert pattern that was fixed
-- for credit/debit/refund in migration 070.

-- ============================================================
-- wallet_withdrawal_debit: debit wallet for a withdrawal request
-- Called after the withdrawal_request row is created.
-- ============================================================

CREATE OR REPLACE FUNCTION public.wallet_withdrawal_debit(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_withdrawal_id UUID,
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
    RAISE EXCEPTION 'Withdrawal amount must be positive';
  END IF;

  -- Idempotency: return existing transaction if already debited
  SELECT * INTO v_txn FROM public.wallet_transactions
    WHERE withdrawal_id = p_withdrawal_id AND type = 'withdrawal';
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
    withdrawal_id, description
  ) VALUES (
    v_wallet.id, p_user_id, 'withdrawal', p_amount_cents, v_new_balance,
    p_withdrawal_id, p_description
  ) RETURNING * INTO v_txn;

  RETURN to_jsonb(v_txn);
END;
$$;

-- ============================================================
-- wallet_withdrawal_credit_back: credit back a rejected withdrawal
-- ============================================================

CREATE OR REPLACE FUNCTION public.wallet_withdrawal_credit_back(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_withdrawal_id UUID,
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
    RAISE EXCEPTION 'Credit-back amount must be positive';
  END IF;

  -- Idempotency: return existing transaction if already credited back
  SELECT * INTO v_txn FROM public.wallet_transactions
    WHERE withdrawal_id = p_withdrawal_id AND type = 'credit';
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
    withdrawal_id, description
  ) VALUES (
    v_wallet.id, p_user_id, 'credit', p_amount_cents, v_new_balance,
    p_withdrawal_id, p_description
  ) RETURNING * INTO v_txn;

  RETURN to_jsonb(v_txn);
END;
$$;

-- Restrict execution to service role only
REVOKE EXECUTE ON FUNCTION public.wallet_withdrawal_debit(UUID, INTEGER, UUID, TEXT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_withdrawal_credit_back(UUID, INTEGER, UUID, TEXT) FROM public, anon, authenticated;
