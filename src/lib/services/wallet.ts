/**
 * Wallet service
 * Handles wallet creation, credits, debits, balance queries, and withdrawals.
 * All mutations use service client to bypass RLS.
 * All amounts in integer cents.
 */

import { createServiceClient } from '@/lib/supabase';
import type { WalletRow, WalletTransactionRow, WithdrawalRequestRow } from '@/lib/wallet/types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class InsufficientBalanceError extends Error {
  constructor(requested: number, available: number) {
    super(`Insufficient wallet balance: requested ${requested} cents, available ${available} cents`);
    this.name = 'InsufficientBalanceError';
  }
}

// ---------------------------------------------------------------------------
// Core wallet operations
// ---------------------------------------------------------------------------

/**
 * Get or lazily create a wallet for the user.
 * Uses INSERT ON CONFLICT to handle concurrent creation safely.
 */
export async function getOrCreateWallet(userId: string): Promise<WalletRow> {
  const supabase = createServiceClient();

  // Attempt insert; no-op if wallet already exists
  await supabase
    .from('wallets')
    .insert({ user_id: userId })
    .select()
    .single();

  // Always fetch to handle both new and existing wallets
  const { data: wallet, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single<WalletRow>();

  if (error || !wallet) {
    throw new Error(`Failed to get or create wallet for user ${userId}: ${error?.message}`);
  }

  return wallet;
}

/**
 * Credit a wallet (e.g. seller earnings on order completion).
 * Idempotent: if a credit transaction already exists for the same order, returns it.
 */
export async function creditWallet(
  userId: string,
  amountCents: number,
  orderId: string,
  description: string
): Promise<WalletTransactionRow> {
  if (amountCents <= 0) throw new Error('Credit amount must be positive');

  const supabase = createServiceClient();

  // Idempotency check: prevent double-credit for the same order
  const { data: existing } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('order_id', orderId)
    .eq('type', 'credit')
    .single<WalletTransactionRow>();

  if (existing) return existing;

  const wallet = await getOrCreateWallet(userId);

  // Atomic increment with optimistic lock (matches debitWallet pattern)
  const { data: updated, error: updateError } = await supabase
    .from('wallets')
    .update({ balance_cents: wallet.balance_cents + amountCents })
    .eq('id', wallet.id)
    .eq('balance_cents', wallet.balance_cents) // Optimistic lock
    .select('balance_cents')
    .single<{ balance_cents: number }>();

  if (updateError || !updated) {
    // Optimistic lock failed — balance changed between read and write (concurrent operation)
    throw new Error(`Failed to credit wallet: concurrent balance change detected`);
  }

  // Record transaction
  const { data: txn, error: txnError } = await supabase
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      user_id: userId,
      type: 'credit' as const,
      amount_cents: amountCents,
      balance_after_cents: updated.balance_cents,
      order_id: orderId,
      description,
    })
    .select('*')
    .single<WalletTransactionRow>();

  if (txnError || !txn) {
    throw new Error(`Failed to record credit transaction: ${txnError?.message}`);
  }

  return txn;
}

/**
 * Debit a wallet (e.g. buyer spending wallet balance at checkout).
 * Atomic: uses WHERE balance_cents >= amount to prevent overdraft.
 * Idempotent on order_id + type='debit'.
 */
export async function debitWallet(
  userId: string,
  amountCents: number,
  orderId: string,
  description: string
): Promise<WalletTransactionRow> {
  if (amountCents <= 0) throw new Error('Debit amount must be positive');

  const supabase = createServiceClient();

  // Idempotency check: prevent double-debit for the same order
  const { data: existing } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('order_id', orderId)
    .eq('type', 'debit')
    .single<WalletTransactionRow>();

  if (existing) return existing;

  const wallet = await getOrCreateWallet(userId);

  // Atomic decrement with balance guard
  // The DB CHECK (balance_cents >= 0) is the ultimate safety net
  const newBalance = wallet.balance_cents - amountCents;
  if (newBalance < 0) {
    throw new InsufficientBalanceError(amountCents, wallet.balance_cents);
  }

  const { data: updated, error: updateError } = await supabase
    .from('wallets')
    .update({ balance_cents: newBalance })
    .eq('id', wallet.id)
    .eq('balance_cents', wallet.balance_cents) // Optimistic lock
    .select('balance_cents')
    .single<{ balance_cents: number }>();

  if (updateError || !updated) {
    // Optimistic lock failed — balance changed between read and write
    throw new InsufficientBalanceError(amountCents, wallet.balance_cents);
  }

  // Record transaction
  const { data: txn, error: txnError } = await supabase
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      user_id: userId,
      type: 'debit' as const,
      amount_cents: amountCents,
      balance_after_cents: updated.balance_cents,
      order_id: orderId,
      description,
    })
    .select('*')
    .single<WalletTransactionRow>();

  if (txnError || !txn) {
    throw new Error(`Failed to record debit transaction: ${txnError?.message}`);
  }

  return txn;
}

// ---------------------------------------------------------------------------
// Balance & history
// ---------------------------------------------------------------------------

/** Get wallet balance in cents. Returns 0 if no wallet exists (no lazy creation on read). */
export async function getWalletBalance(userId: string): Promise<number> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('wallets')
    .select('balance_cents')
    .eq('user_id', userId)
    .single<{ balance_cents: number }>();

  return data?.balance_cents ?? 0;
}

/** Get paginated transaction history, newest first. */
export async function getTransactionHistory(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ transactions: WalletTransactionRow[]; total: number }> {
  const supabase = createServiceClient();
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('wallet_transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch transaction history: ${error.message}`);
  }

  return {
    transactions: (data ?? []) as WalletTransactionRow[],
    total: count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------

/**
 * Create a withdrawal request. Debits wallet immediately (funds held for withdrawal).
 * If staff later rejects, funds are credited back.
 */
export async function createWithdrawalRequest(
  userId: string,
  amountCents: number,
  bankAccountHolder: string,
  bankIban: string
): Promise<WithdrawalRequestRow> {
  if (amountCents <= 0) throw new Error('Withdrawal amount must be positive');

  const supabase = createServiceClient();
  const wallet = await getOrCreateWallet(userId);

  if (wallet.balance_cents < amountCents) {
    throw new InsufficientBalanceError(amountCents, wallet.balance_cents);
  }

  // Create withdrawal request first to get the ID
  const { data: withdrawal, error: withdrawalError } = await supabase
    .from('withdrawal_requests')
    .insert({
      user_id: userId,
      amount_cents: amountCents,
      bank_account_holder: bankAccountHolder,
      bank_iban: bankIban,
    })
    .select('*')
    .single<WithdrawalRequestRow>();

  if (withdrawalError || !withdrawal) {
    throw new Error(`Failed to create withdrawal request: ${withdrawalError?.message}`);
  }

  // Debit wallet — hold funds for withdrawal
  const newBalance = wallet.balance_cents - amountCents;

  const { data: updated, error: updateError } = await supabase
    .from('wallets')
    .update({ balance_cents: newBalance })
    .eq('id', wallet.id)
    .eq('balance_cents', wallet.balance_cents) // Optimistic lock
    .select('balance_cents')
    .single<{ balance_cents: number }>();

  if (updateError || !updated) {
    // Rollback: delete the withdrawal request
    await supabase.from('withdrawal_requests').delete().eq('id', withdrawal.id);
    throw new InsufficientBalanceError(amountCents, wallet.balance_cents);
  }

  // Record withdrawal transaction
  await supabase
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      user_id: userId,
      type: 'withdrawal' as const,
      amount_cents: amountCents,
      balance_after_cents: updated.balance_cents,
      withdrawal_id: withdrawal.id,
      description: `Withdrawal request — ${bankIban}`,
    });

  return withdrawal;
}

/**
 * Credit back a rejected withdrawal. Called by staff when rejecting a request.
 */
export async function creditBackRejectedWithdrawal(
  withdrawalId: string
): Promise<void> {
  const supabase = createServiceClient();

  const { data: withdrawal, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('id', withdrawalId)
    .single<WithdrawalRequestRow>();

  if (error || !withdrawal) {
    throw new Error(`Withdrawal request not found: ${withdrawalId}`);
  }

  // Status is already 'rejected' when called from the staff route (status updated first
  // to prevent double-credit races). Accept rejected status in addition to pending/approved.
  if (!['pending', 'approved', 'rejected'].includes(withdrawal.status)) {
    throw new Error(`Cannot credit back withdrawal in status: ${withdrawal.status}`);
  }

  const wallet = await getOrCreateWallet(withdrawal.user_id);

  // Credit back the held amount with optimistic lock
  const { data: updated, error: updateError } = await supabase
    .from('wallets')
    .update({ balance_cents: wallet.balance_cents + withdrawal.amount_cents })
    .eq('id', wallet.id)
    .eq('balance_cents', wallet.balance_cents) // Optimistic lock
    .select('balance_cents')
    .single<{ balance_cents: number }>();

  if (updateError || !updated) {
    throw new Error(`Failed to credit back withdrawal: concurrent balance change detected`);
  }

  // Record the credit-back transaction
  await supabase
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      user_id: withdrawal.user_id,
      type: 'credit' as const,
      amount_cents: withdrawal.amount_cents,
      balance_after_cents: updated.balance_cents,
      withdrawal_id: withdrawalId,
      description: `Withdrawal rejected — funds returned`,
    });
}
