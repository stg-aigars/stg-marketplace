/**
 * Wallet service
 * Handles wallet creation, credits, debits, balance queries, and withdrawals.
 * All mutations use service client to bypass RLS.
 * All amounts in integer cents.
 */

import { createServiceClient } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/services/audit';
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

  // Select-first: avoids the ignoreDuplicates + RETURNING bug where
  // ON CONFLICT DO NOTHING returns zero rows for existing wallets
  const { data: existing } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single<WalletRow>();

  if (existing) return existing;

  const { data: wallet, error } = await supabase
    .from('wallets')
    .insert({ user_id: userId })
    .select('*')
    .single<WalletRow>();

  if (error || !wallet) {
    // Race condition: another request created it between our select and insert
    const { data: retry } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single<WalletRow>();
    if (retry) return retry;
    throw new Error(`Failed to get or create wallet for user ${userId}: ${error?.message}`);
  }

  return wallet;
}

/**
 * Credit a wallet (e.g. seller earnings on order completion).
 * Idempotent: if a credit transaction already exists for the same order, returns it.
 * Uses atomic Postgres RPC — balance update + transaction insert in one SQL transaction.
 */
export async function creditWallet(
  userId: string,
  amountCents: number,
  orderId: string,
  description: string
): Promise<WalletTransactionRow> {
  if (amountCents <= 0) throw new Error('Credit amount must be positive');

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('wallet_credit', {
    p_user_id: userId,
    p_amount_cents: amountCents,
    p_order_id: orderId,
    p_description: description,
  });

  if (error) throw new Error(`Failed to credit wallet: ${error.message}`);

  const txn = data as unknown as WalletTransactionRow;

  void logAuditEvent({
    actorId: userId,
    actorType: 'system',
    action: 'wallet.credit',
    resourceType: 'wallet_transaction',
    resourceId: txn.id,
    metadata: { amountCents, orderId, balanceAfterCents: txn.balance_after_cents },
  });

  return txn;
}

/**
 * Refund to a buyer's wallet (e.g. dispute resolution).
 * Uses type='refund' to avoid idempotency collision with seller type='credit'
 * on the same order_id.
 * Idempotent: if a refund transaction already exists for the same order, returns it.
 * Uses atomic Postgres RPC — balance update + transaction insert in one SQL transaction.
 */
export async function refundToWallet(
  userId: string,
  amountCents: number,
  orderId: string,
  description: string
): Promise<WalletTransactionRow> {
  if (amountCents <= 0) throw new Error('Refund amount must be positive');

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('wallet_refund', {
    p_user_id: userId,
    p_amount_cents: amountCents,
    p_order_id: orderId,
    p_description: description,
  });

  if (error) throw new Error(`Failed to refund wallet: ${error.message}`);

  const txn = data as unknown as WalletTransactionRow;

  void logAuditEvent({
    actorId: userId,
    actorType: 'system',
    action: 'wallet.refund',
    resourceType: 'wallet_transaction',
    resourceId: txn.id,
    metadata: { amountCents, orderId, balanceAfterCents: txn.balance_after_cents },
  });

  return txn;
}

/**
 * Debit a wallet (e.g. buyer spending wallet balance at checkout).
 * Idempotent on order_id + type='debit'.
 * Uses atomic Postgres RPC — balance check + update + transaction insert in one SQL transaction.
 * Throws InsufficientBalanceError if balance is too low.
 */
export async function debitWallet(
  userId: string,
  amountCents: number,
  orderId: string,
  description: string
): Promise<WalletTransactionRow> {
  if (amountCents <= 0) throw new Error('Debit amount must be positive');

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('wallet_debit', {
    p_user_id: userId,
    p_amount_cents: amountCents,
    p_order_id: orderId,
    p_description: description,
  });

  if (error) {
    // Parse INSUFFICIENT_BALANCE errors from the RPC
    const match = error.message.match(/INSUFFICIENT_BALANCE:(\d+) (\d+)/);
    if (match) {
      throw new InsufficientBalanceError(Number(match[1]), Number(match[2]));
    }
    throw new Error(`Failed to debit wallet: ${error.message}`);
  }

  const txn = data as unknown as WalletTransactionRow;

  void logAuditEvent({
    actorId: userId,
    actorType: 'user',
    action: 'wallet.debit',
    resourceType: 'wallet_transaction',
    resourceId: txn.id,
    metadata: { amountCents, orderId, balanceAfterCents: txn.balance_after_cents },
  });

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

  void logAuditEvent({
    actorId: userId,
    actorType: 'user',
    action: 'wallet.withdrawal_requested',
    resourceType: 'withdrawal_request',
    resourceId: withdrawal.id,
    metadata: { amountCents, bankIban: bankIban.slice(0, 4) + '****' },
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

  // Status must be 'rejected' — the staff route atomically updates status before calling this
  if (withdrawal.status !== 'rejected') {
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
