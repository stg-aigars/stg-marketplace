/**
 * Lifecycle integration — cart payment fulfillment (PR C commit 13).
 *
 * Covers:
 *   - Scenario 1: card cart → C.1 (Dr 2630 / Cr 5590)
 *   - Scenario 2: bank_link / PIS cart → C.2 (Dr 2620 / Cr 5590)
 *   - Scenario 11: buyer-wallet 3-line C.1 (Dr 5351-buyer / Dr 2630 / Cr 5590)
 *   - F1: idempotent retry returns idempotent_skip (RPC's paid_at guard)
 *
 * Exercises `cartFulfillmentWithGL` directly — the wrap builds the C.1/C.2
 * event + lines via dispatcher + compute, then composes the parent RPC
 * (`cart_complete_payment_with_event_atomic`, migration 108) that atomically
 * stamps `cart_checkout_groups.paid_at` alongside the GL emit.
 *
 * **Not covered here** (deferred to followup PR or covered by sibling tests):
 *   - Scenario 6 (cutover orphan completion) — order-completion.test.ts
 *   - Scenario 12 (partial fulfillment with C.9 paired emit) — pending
 *     follow-up; requires synthetic unavailable-listing setup
 *   - F6 (insufficient wallet balance) — unit-test territory (the wrap
 *     doesn't validate wallet balance; that happens upstream in
 *     fulfillCartPayment service layer)
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { cartFulfillmentWithGL } from '@/lib/accounting/lifecycle-wraps';

import {
  supabase,
  TEST_PERIOD,
  ensureTestPeriod,
  createSyntheticCart,
  setBuyerWalletBalance,
  assertJournalEntry,
  assertJournalLines,
} from './setup';

import { createTestUser, cleanupTestData } from '../../helpers/factories';

beforeAll(async () => {
  await cleanupTestData();
  await ensureTestPeriod(supabase, TEST_PERIOD);
});

beforeEach(() => {
  // toFake: ['Date'] only -- faking setTimeout/setInterval too breaks Node's
  // built-in fetch (undici), which relies on real timers internally for
  // connection-pool/keep-alive handling. Under Node 22 (not Node 20) this
  // hangs any Supabase client call made while fake timers are active until
  // Vitest's own (real-timer) test timeout fires.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(Date.UTC(2027, 0, 15, 12, 0, 0)));
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  vi.useRealTimers();
  await cleanupTestData();
});

// ---------------------------------------------------------------------------
// Scenario 1 — card cart C.1
// ---------------------------------------------------------------------------

describe('Scenario 1 — card cart fulfillment emits C.1 (Dr 2630 / Cr 5590)', () => {
  it('flag-ON path: fulfilling a card cart writes C.1 and stamps paid_at', async () => {
    const buyer = await createTestUser({ country: 'LV' });
    const grossCart = 12_500;

    const { cart_group_id, everypay_payment_reference } = await createSyntheticCart(supabase, {
      buyer_id: buyer.id,
      total_amount_cents: grossCart,
      terminal_country: 'LV',
    });

    const result = await cartFulfillmentWithGL(supabase, {
      cart_group_id,
      buyer_id: buyer.id,
      payment_method: 'card',
      gross_cart_cents: grossCart,
      buyer_wallet_cents: 0,
      everypay_payment_reference,
      callback_payload: { test_artifact: true },
    });

    expect(result.cart_journal_entry_id).toBeTruthy();
    expect(result.partial_refund_journal_entry_id).toBeNull();
    expect(result.idempotent_skip).toBe(false);

    const entry = await assertJournalEntry(supabase, {
      source_doc_type: 'cart_payment',
      source_doc_id: cart_group_id,
      type_id: 'C.1',
    });
    expect(entry.accounting_period).toBe(TEST_PERIOD);
    expect(entry.posting_context.emission_source).toBe('lifecycle');

    await assertJournalLines(supabase, entry.id, [
      { account_code: '2630', debit_cents: grossCart, credit_cents: 0 },
      { account_code: '5590', debit_cents: 0, credit_cents: grossCart },
    ]);

    // Cart row was stamped
    const { data: cartRow } = await supabase
      .from('cart_checkout_groups')
      .select('paid_at, status')
      .eq('id', cart_group_id)
      .single<{ paid_at: string | null; status: string }>();
    expect(cartRow?.paid_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — bank_link (PIS) cart C.2
// ---------------------------------------------------------------------------

describe('Scenario 2 — bank_link cart fulfillment emits C.2 (Dr 2620 / Cr 5590)', () => {
  it('flag-ON path: fulfilling a PIS cart writes C.2 directly to the e-commerce account 2620', async () => {
    const buyer = await createTestUser({ country: 'LV' });
    const grossCart = 9_900;

    const { cart_group_id, everypay_payment_reference } = await createSyntheticCart(supabase, {
      buyer_id: buyer.id,
      total_amount_cents: grossCart,
      terminal_country: 'LV',
    });

    const result = await cartFulfillmentWithGL(supabase, {
      cart_group_id,
      buyer_id: buyer.id,
      payment_method: 'bank_link',
      gross_cart_cents: grossCart,
      buyer_wallet_cents: 0,
      everypay_payment_reference,
      callback_payload: { test_artifact: true },
    });

    expect(result.cart_journal_entry_id).toBeTruthy();

    const entry = await assertJournalEntry(supabase, {
      source_doc_type: 'cart_payment',
      source_doc_id: cart_group_id,
      type_id: 'C.2',
    });

    await assertJournalLines(supabase, entry.id, [
      { account_code: '2620', debit_cents: grossCart, credit_cents: 0 },
      { account_code: '5590', debit_cents: 0, credit_cents: grossCart },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Scenario 11 — buyer-wallet 3-line C.1 (commit 9 Q3 Option α)
// ---------------------------------------------------------------------------

describe('Scenario 11 — buyer-wallet hybrid cart emits 3-line C.1', () => {
  it('flag-ON path: card + buyer-wallet split → Dr 5351 (buyer) / Dr 2630 / Cr 5590', async () => {
    const buyer = await createTestUser({ country: 'LV' });
    const grossCart = 15_000;
    const buyerWalletPortion = 5_000;
    const cardPortion = grossCart - buyerWalletPortion; // 10_000

    await setBuyerWalletBalance(supabase, buyer.id, buyerWalletPortion);

    const { cart_group_id, everypay_payment_reference } = await createSyntheticCart(supabase, {
      buyer_id: buyer.id,
      total_amount_cents: grossCart,
      wallet_debit_cents: buyerWalletPortion,
      terminal_country: 'LV',
    });

    const result = await cartFulfillmentWithGL(supabase, {
      cart_group_id,
      buyer_id: buyer.id,
      payment_method: 'card',
      gross_cart_cents: grossCart,
      buyer_wallet_cents: buyerWalletPortion,
      everypay_payment_reference,
      callback_payload: { test_artifact: true },
    });

    expect(result.cart_journal_entry_id).toBeTruthy();

    const entry = await assertJournalEntry(supabase, {
      source_doc_type: 'cart_payment',
      source_doc_id: cart_group_id,
      type_id: 'C.1',
    });
    // posting_context.buyer_id stamped per commit-9 Q3 sign-off
    expect(entry.posting_context.buyer_id).toBe(buyer.id);

    await assertJournalLines(supabase, entry.id, [
      { account_code: '5351', debit_cents: buyerWalletPortion, credit_cents: 0 },
      { account_code: '2630', debit_cents: cardPortion, credit_cents: 0 },
      { account_code: '5590', debit_cents: 0, credit_cents: grossCart },
    ]);
  });
});

// ---------------------------------------------------------------------------
// F1 — idempotent retry returns idempotent_skip
// ---------------------------------------------------------------------------

describe('F1 — cart fulfillment idempotent retry', () => {
  it('second call on same cart returns idempotent_skip; no second GL entry written', async () => {
    const buyer = await createTestUser({ country: 'LV' });
    const grossCart = 4_500;

    const { cart_group_id, everypay_payment_reference } = await createSyntheticCart(supabase, {
      buyer_id: buyer.id,
      total_amount_cents: grossCart,
      terminal_country: 'LV',
    });

    const input = {
      cart_group_id,
      buyer_id: buyer.id,
      payment_method: 'card' as const,
      gross_cart_cents: grossCart,
      buyer_wallet_cents: 0,
      everypay_payment_reference,
      callback_payload: { test_artifact: true },
    };

    const first = await cartFulfillmentWithGL(supabase, input);
    expect(first.cart_journal_entry_id).toBeTruthy();
    expect(first.idempotent_skip).toBe(false);
    const firstEntryId = first.cart_journal_entry_id;

    const second = await cartFulfillmentWithGL(supabase, input);
    // Parent-RPC paid_at guard fires; cart row already stamped → idempotent_skip
    expect(second.cart_journal_entry_id).toBeNull();
    expect(second.idempotent_skip).toBe(true);

    // Verify only ONE C.1 entry exists for this cart
    const { data: entries } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('source_doc_type', 'cart_payment')
      .eq('source_doc_id', cart_group_id)
      .eq('type_id', 'C.1');
    expect(entries?.length).toBe(1);
    expect(entries?.[0]?.id).toBe(firstEntryId);
  });
});
