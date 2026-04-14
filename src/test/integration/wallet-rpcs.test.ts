import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServiceClient } from '../helpers/supabase';
import { createTestUser, createTestListing, createTestOrder, createTestWallet, cleanupTestData } from '../helpers/factories';

const supabase = createTestServiceClient();

let buyer: Awaited<ReturnType<typeof createTestUser>>;
let seller: Awaited<ReturnType<typeof createTestUser>>;
let testUser: Awaited<ReturnType<typeof createTestUser>>;
let testWallet: Awaited<ReturnType<typeof createTestWallet>>;

/** Create a real order so wallet_transactions FK on order_id is satisfied */
async function createOrderForWalletTest(): Promise<string> {
  const listing = await createTestListing({ sellerId: seller.id, priceCents: 1000 });
  const order = await createTestOrder({
    buyerId: buyer.id,
    sellerId: seller.id,
    items: [{ listingId: listing.id, priceCents: 1000 }],
  });
  return order.id;
}

describe('wallet RPCs', () => {
  beforeEach(async () => {
    buyer = await createTestUser({ fullName: 'Test Buyer' });
    seller = await createTestUser({ fullName: 'Test Seller' });
    testUser = buyer;
    testWallet = await createTestWallet({ userId: testUser.id });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it('credit idempotency: duplicate calls with same order_id produce one transaction', async () => {
    const orderId = await createOrderForWalletTest();

    const { data: first, error: firstErr } = await supabase.rpc('wallet_credit', {
      p_user_id: testUser.id,
      p_amount_cents: 1000,
      p_order_id: orderId,
      p_description: 'Test credit',
    });
    expect(firstErr).toBeNull();
    expect(first).toBeTruthy();

    // Second call with same order_id should be idempotent
    const { data: second, error: secondErr } = await supabase.rpc('wallet_credit', {
      p_user_id: testUser.id,
      p_amount_cents: 1000,
      p_order_id: orderId,
      p_description: 'Test credit duplicate',
    });
    expect(secondErr).toBeNull();
    expect(second).toBeTruthy();

    // Verify only one transaction exists
    const { data: txns } = await supabase
      .from('wallet_transactions')
      .select('id')
      .eq('order_id', orderId)
      .eq('type', 'credit');
    expect(txns).toHaveLength(1);

    // Verify balance is credited only once
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance_cents')
      .eq('user_id', testUser.id)
      .single();
    expect(wallet?.balance_cents).toBe(1000);
  });

  it('debit with insufficient balance raises INSUFFICIENT_BALANCE error', async () => {
    // Wallet starts at 0, credit 500 first
    testWallet = await createTestWallet({ userId: testUser.id, balanceCents: 500 }).catch(() => {
      // Wallet already exists from beforeEach, update balance directly
      return testWallet;
    });

    // Update existing wallet balance to 500
    await supabase
      .from('wallets')
      .update({ balance_cents: 500 })
      .eq('user_id', testUser.id);

    const orderId = crypto.randomUUID();
    const { error } = await supabase.rpc('wallet_debit', {
      p_user_id: testUser.id,
      p_amount_cents: 1000,
      p_order_id: orderId,
      p_description: 'Test debit too large',
    });

    expect(error).toBeTruthy();
    expect(error!.message).toContain('INSUFFICIENT_BALANCE');

    // Balance should remain unchanged
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance_cents')
      .eq('user_id', testUser.id)
      .single();
    expect(wallet?.balance_cents).toBe(500);
  });

  it('debit atomicity: credit then debit leaves balance at zero', async () => {
    const creditOrderId = await createOrderForWalletTest();
    const debitOrderId = await createOrderForWalletTest();

    // Credit 1000
    const { error: creditErr } = await supabase.rpc('wallet_credit', {
      p_user_id: testUser.id,
      p_amount_cents: 1000,
      p_order_id: creditOrderId,
      p_description: 'Test credit for debit',
    });
    expect(creditErr).toBeNull();

    // Debit 1000
    const { error: debitErr } = await supabase.rpc('wallet_debit', {
      p_user_id: testUser.id,
      p_amount_cents: 1000,
      p_order_id: debitOrderId,
      p_description: 'Test debit full balance',
    });
    expect(debitErr).toBeNull();

    // Balance should be 0
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance_cents')
      .eq('user_id', testUser.id)
      .single();
    expect(wallet?.balance_cents).toBe(0);

    // Two transactions should exist
    const { data: txns } = await supabase
      .from('wallet_transactions')
      .select('id, type')
      .eq('user_id', testUser.id);
    expect(txns).toHaveLength(2);
    expect(txns!.map((t) => t.type).sort()).toEqual(['credit', 'debit']);
  });

  it('withdrawal cycle: debit then credit-back restores balance', async () => {
    // Set initial balance to 5000
    await supabase
      .from('wallets')
      .update({ balance_cents: 5000 })
      .eq('user_id', testUser.id);

    const withdrawalId = crypto.randomUUID();

    // Create a withdrawal_request row (required FK target)
    const { error: wrError } = await supabase
      .from('withdrawal_requests')
      .insert({
        id: withdrawalId,
        user_id: testUser.id,
        amount_cents: 5000,
        bank_account_holder: 'Test User',
        bank_iban: 'LV00TEST0000000000000',
      });
    expect(wrError).toBeNull();

    // Debit via withdrawal RPC
    const { error: debitErr } = await supabase.rpc('wallet_withdrawal_debit', {
      p_user_id: testUser.id,
      p_amount_cents: 5000,
      p_withdrawal_id: withdrawalId,
      p_description: 'Withdrawal debit',
    });
    expect(debitErr).toBeNull();

    // Balance should be 0
    const { data: afterDebit } = await supabase
      .from('wallets')
      .select('balance_cents')
      .eq('user_id', testUser.id)
      .single();
    expect(afterDebit?.balance_cents).toBe(0);

    // Credit back (rejected withdrawal)
    const { error: creditErr } = await supabase.rpc('wallet_withdrawal_credit_back', {
      p_user_id: testUser.id,
      p_amount_cents: 5000,
      p_withdrawal_id: withdrawalId,
      p_description: 'Withdrawal rejected',
    });
    expect(creditErr).toBeNull();

    // Balance should be restored to 5000
    const { data: afterCredit } = await supabase
      .from('wallets')
      .select('balance_cents')
      .eq('user_id', testUser.id)
      .single();
    expect(afterCredit?.balance_cents).toBe(5000);
  });

  it('concurrent credit: parallel calls with same order_id produce only one transaction', async () => {
    const orderId = await createOrderForWalletTest();

    const call = () =>
      supabase.rpc('wallet_credit', {
        p_user_id: testUser.id,
        p_amount_cents: 500,
        p_order_id: orderId,
        p_description: 'Concurrent credit',
      });

    const results = await Promise.allSettled([call(), call()]);

    // Both should resolve (Supabase client returns error in data, not rejection)
    const settled = results.filter(
      (r) => r.status === 'fulfilled'
    ) as PromiseFulfilledResult<Awaited<ReturnType<typeof call>>>[];

    // At least one should succeed, the idempotency check means both may succeed
    // (second call finds existing transaction and returns it)
    const successes = settled.filter((r) => !r.value.error);
    // Failures are implicitly validated by the successes count assertion below

    // With the idempotency check in the RPC, both calls may succeed
    // (second one just returns the existing transaction).
    // Either way, only one transaction should exist.
    expect(successes.length).toBeGreaterThanOrEqual(1);

    // Verify only one transaction in the DB
    const { data: txns } = await supabase
      .from('wallet_transactions')
      .select('id')
      .eq('order_id', orderId)
      .eq('type', 'credit');
    expect(txns).toHaveLength(1);

    // Balance should be credited only once
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance_cents')
      .eq('user_id', testUser.id)
      .single();
    expect(wallet?.balance_cents).toBe(500);
  });
});
