/**
 * Wallet types
 * Maps to wallets, wallet_transactions, and withdrawal_requests tables
 * in supabase/migrations/018_wallet_system.sql
 */

export type WalletTransactionType = 'credit' | 'debit' | 'withdrawal' | 'refund';

export interface WalletRow {
  id: string;
  user_id: string;
  balance_cents: number;
  created_at: string;
  updated_at: string;
}

export interface WalletTransactionRow {
  id: string;
  wallet_id: string;
  user_id: string;
  type: WalletTransactionType;
  amount_cents: number;
  balance_after_cents: number;
  order_id: string | null;
  withdrawal_id: string | null;
  description: string;
  created_at: string;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'completed' | 'rejected';

export interface WithdrawalRequestRow {
  id: string;
  user_id: string;
  amount_cents: number;
  status: WithdrawalStatus;
  reference_number: string;
  bank_account_holder: string;
  bank_iban: string;
  staff_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  /**
   * Stage-2 cutover gate marker (migration 110). Staff test withdrawals
   * set this true so the wrap layer emits C.4 (Dr 5351 / Cr 2610) while
   * real seller withdrawals take the legacy path. See
   * `docs/operations/lifecycle-cutover-runbook.md` §1 Gate 9 + §3.
   */
  is_staff_test: boolean;
  created_at: string;
  updated_at: string;
}
