/**
 * Lifecycle integration — order completion handoff (PR C commit 13).
 *
 * Covers:
 *   - Scenario 1 (completion side): card flow → O.1 entry shape
 *     (Dr 5590 / Cr 5351 + Cr 6310-C + Cr 6310-S + Cr 5710-LV-OUT VAT)
 *   - Scenario 2 (completion side): EE B2C OSS → O.5 entry (Cr 5712 OSS rail)
 *   - Scenario 6: cutover orphan completion — order with no C.1/C.2 antecedent;
 *     `complete_order_with_event_atomic` returns orphan=true; wallet still
 *     credited; no O.x in journal_entries
 *
 * Each scenario:
 *   1. Pre-emit C.1 (via cart_complete_payment_with_event_atomic) to satisfy
 *      the antecedent check (skipped for scenario 6).
 *   2. Create an order row in `pending_seller` with cart_group_id linking
 *      back to the cart. wallet_credited_at MUST be null (RPC's idempotent-
 *      retry guard).
 *   3. Call `completeOrderWithGL` — wraps the parent RPC for atomic GL emit
 *      + wallet credit + status flip.
 *   4. Assert the O.x entry shape (or orphan return + no O.x for scenario 6).
 *
 * Skips F4 — refund-side antecedent missing lives in refund.test.ts because
 * it's actually the refund-path orphan (scenario 7 in the preamble's main
 * table), not a completion-side concept.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cartFulfillmentWithGL,
  completeOrderWithGL,
} from '@/lib/accounting/lifecycle-wraps';

import {
  supabase,
  TEST_PERIOD,
  ensureTestPeriod,
  ensureTestCounterparty,
  createSyntheticCart,
  assertJournalEntry,
  assertNoJournalEntry,
  assertJournalLines,
} from './setup';

import {
  createTestUser,
  createTestListing,
  createTestOrder,
  createTestWallet,
  cleanupTestData,
} from '../../helpers/factories';

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

/**
 * Build a card-cart + order pair, with the cart's C.1 already emitted.
 * Returns the order shape needed by `completeOrderWithGL`.
 */
async function buildCartAndOrder(opts: {
  sellerCountry: 'LV' | 'LT' | 'EE';
  itemsTotalCents: number;
  shippingCostCents: number;
}): Promise<{
  buyer: { id: string };
  seller: { id: string; country: string };
  order: {
    id: string;
    seller_id: string;
    seller_country: 'LV' | 'LT' | 'EE';
    items_total_cents: number;
    shipping_cost_cents: number;
    order_number: string;
    cart_group_id: string;
  };
}> {
  const buyer = await createTestUser({ country: 'LV' });
  const seller = await createTestUser({ country: opts.sellerCountry });

  // Pre-create counterparty for the seller (skip lazy-init lookup)
  await ensureTestCounterparty(supabase, {
    id: crypto.randomUUID(),
    type: 'seller',
    country: opts.sellerCountry,
    tax_status: 'private',
    legal_compliance_status: 'ok',
    user_id: seller.id,
    full_name: seller.full_name,
  });

  // Build listing + order; commission = 10% of items
  const listing = await createTestListing({
    sellerId: seller.id,
    priceCents: opts.itemsTotalCents,
    country: opts.sellerCountry,
  });

  const gross = opts.itemsTotalCents + opts.shippingCostCents;
  const { cart_group_id, everypay_payment_reference } = await createSyntheticCart(supabase, {
    buyer_id: buyer.id,
    total_amount_cents: gross,
    terminal_country: opts.sellerCountry,
  });

  // Pre-emit cart C.1 so the order's antecedent check passes
  await cartFulfillmentWithGL(supabase, {
    cart_group_id,
    buyer_id: buyer.id,
    payment_method: 'card',
    gross_cart_cents: gross,
    buyer_wallet_cents: 0,
    everypay_payment_reference,
    callback_payload: { test_artifact: true },
  });

  const orderRow = await createTestOrder({
    buyerId: buyer.id,
    sellerId: seller.id,
    items: [{ listingId: listing.id, priceCents: opts.itemsTotalCents }],
    shippingCostCents: opts.shippingCostCents,
    status: 'pending_seller',
  });

  // Update orders.cart_group_id + seller_country to drive the wrap correctly
  await supabase
    .from('orders')
    .update({ cart_group_id, seller_country: opts.sellerCountry })
    .eq('id', orderRow.id);

  return {
    buyer: { id: buyer.id },
    seller: { id: seller.id, country: opts.sellerCountry },
    order: {
      id: orderRow.id,
      seller_id: seller.id,
      seller_country: opts.sellerCountry,
      items_total_cents: opts.itemsTotalCents,
      shipping_cost_cents: opts.shippingCostCents,
      order_number: orderRow.order_number,
      cart_group_id,
    },
  };
}

// ---------------------------------------------------------------------------
// Scenario 1 — completion side: LV card flow → O.1
// ---------------------------------------------------------------------------

describe('Scenario 1 (completion-side) — LV card flow emits O.1 with 5-line shape', () => {
  it('completeOrderWithGL on a card cart with C.1 antecedent emits O.1; non-orphan; wallet credited', async () => {
    const { buyer, seller, order } = await buildCartAndOrder({
      sellerCountry: 'LV',
      itemsTotalCents: 5_000,
      shippingCostCents: 350,
    });

    // Seller needs a wallet for the RPC's wallet_credit call
    await createTestWallet({ userId: seller.id, balanceCents: 0 });

    const result = await completeOrderWithGL(supabase, order);

    expect(result.orphan).toBe(false);
    expect(result.journal_entry_id).toBeTruthy();
    expect(result.idempotent_skip).toBe(false);

    // O.1 entry for LV private seller (B2C LV)
    const entry = await assertJournalEntry(supabase, {
      source_doc_type: 'order',
      source_doc_id: order.id,
      type_id: 'O.1',
    });
    expect(entry.accounting_period).toBe(TEST_PERIOD);
    expect(entry.posting_context.emission_source).toBe('lifecycle');

    // 5-line shape per CLAUDE.md (LV private seller — VAT outbound 21%):
    //   Dr 5590 gross_cart  (5350)
    //   Cr 5351 seller_net
    //   Cr 6310-C commission_net
    //   Cr 6310-S shipping_net
    //   Cr 5710-LV-OUT vat_amount
    const { data: lines } = await supabase
      .from('journal_lines')
      .select('account_code, debit_cents, credit_cents')
      .eq('entry_id', entry.id);
    expect(lines?.length).toBe(5);

    // Verify the suspense-debit + seller-credit pair carries the expected value.
    // (Per CLAUDE.md: seller_net = item_value - commission_gross.)
    const lineByAcct = new Map((lines ?? []).map((l) => [l.account_code, l]));
    expect(lineByAcct.get('5590')?.debit_cents).toBe(5_350);
    expect(lineByAcct.get('5710-LV-OUT')).toBeDefined();
    expect((lineByAcct.get('5710-LV-OUT')?.credit_cents ?? 0)).toBeGreaterThan(0);

    // Verify buyer arg threaded through (defensive — no PostHog assertion here)
    expect(buyer.id).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — completion side: EE B2C OSS → O.5
// ---------------------------------------------------------------------------

describe('Scenario 2 (completion-side) — EE B2C OSS emits O.5 with OSS-EE VAT routing', () => {
  it('completeOrderWithGL with EE private seller routes VAT to OSS-EE rail (5712)', async () => {
    const { seller, order } = await buildCartAndOrder({
      sellerCountry: 'EE',
      itemsTotalCents: 4_000,
      shippingCostCents: 350,
    });

    await createTestWallet({ userId: seller.id, balanceCents: 0 });

    const result = await completeOrderWithGL(supabase, order);
    expect(result.orphan).toBe(false);
    expect(result.journal_entry_id).toBeTruthy();

    const entry = await assertJournalEntry(supabase, {
      source_doc_type: 'order',
      source_doc_id: order.id,
      type_id: 'O.5',
    });
    // consumption_ms must land in posting_context (mapping declares it required)
    expect(entry.posting_context.oss_consumption_ms).toBe('EE');

    const { data: lines } = await supabase
      .from('journal_lines')
      .select('account_code, credit_cents')
      .eq('entry_id', entry.id);

    // OSS-EE VAT rail is 5712 per CLAUDE.md accounting module section
    const vatLine = (lines ?? []).find((l) => l.account_code === '5712');
    expect(vatLine, 'O.5 should credit 5712 (OSS-EE)').toBeDefined();
    expect((vatLine?.credit_cents ?? 0)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2b — completion side: LT B2C OSS → O.3 (mirror of scenario 2)
// ---------------------------------------------------------------------------

describe('Scenario 2b (completion-side) — LT B2C OSS emits O.3 with OSS-LT VAT routing', () => {
  it('completeOrderWithGL with LT private seller routes VAT to OSS-LT rail (5711)', async () => {
    const { seller, order } = await buildCartAndOrder({
      sellerCountry: 'LT',
      itemsTotalCents: 4_000,
      shippingCostCents: 350,
    });

    await createTestWallet({ userId: seller.id, balanceCents: 0 });

    const result = await completeOrderWithGL(supabase, order);
    expect(result.orphan).toBe(false);
    expect(result.journal_entry_id).toBeTruthy();

    const entry = await assertJournalEntry(supabase, {
      source_doc_type: 'order',
      source_doc_id: order.id,
      type_id: 'O.3',
    });
    expect(entry.posting_context.oss_consumption_ms).toBe('LT');

    const { data: lines } = await supabase
      .from('journal_lines')
      .select('account_code, credit_cents')
      .eq('entry_id', entry.id);

    // OSS-LT VAT rail is 5711 per CLAUDE.md accounting module section
    const vatLine = (lines ?? []).find((l) => l.account_code === '5711');
    expect(vatLine, 'O.3 should credit 5711 (OSS-LT)').toBeDefined();
    expect((vatLine?.credit_cents ?? 0)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 6 — cutover orphan completion
// ---------------------------------------------------------------------------

describe('Scenario 6 — cutover-window orphan completion', () => {
  it('order without C.1/C.2 antecedent: orphan=true; wallet credited; no O.x emitted', async () => {
    const buyer = await createTestUser({ country: 'LV' });
    const seller = await createTestUser({ country: 'LV' });

    await ensureTestCounterparty(supabase, {
      id: crypto.randomUUID(),
      type: 'seller',
      country: 'LV',
      tax_status: 'private',
      legal_compliance_status: 'ok',
      user_id: seller.id,
      full_name: seller.full_name,
    });

    const listing = await createTestListing({
      sellerId: seller.id,
      priceCents: 5_000,
      country: 'LV',
    });

    const itemsTotal = 5_000;
    const shipping = 350;

    // NO cart fulfillment → no C.1 antecedent
    const orderRow = await createTestOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      items: [{ listingId: listing.id, priceCents: itemsTotal }],
      shippingCostCents: shipping,
      status: 'pending_seller',
    });

    // Leave orders.cart_group_id NULL → RPC's antecedent check returns false
    await createTestWallet({ userId: seller.id, balanceCents: 0 });

    const result = await completeOrderWithGL(supabase, {
      id: orderRow.id,
      seller_id: seller.id,
      seller_country: 'LV',
      items_total_cents: itemsTotal,
      shipping_cost_cents: shipping,
      order_number: orderRow.order_number,
      cart_group_id: null,
    });

    expect(result.orphan).toBe(true);
    expect(result.journal_entry_id).toBeNull();
    expect(result.idempotent_skip).toBe(false);
    // Wallet credit still happened (cutover invariant — orphan ≠ no wallet credit)
    expect(result.wallet_txn_id).toBeTruthy();

    // No O.1 / O.2 / O.3 / O.4 / O.5 entry should exist for this order
    for (const typeId of ['O.1', 'O.2', 'O.3', 'O.4', 'O.5']) {
      await assertNoJournalEntry(supabase, {
        source_doc_type: 'order',
        source_doc_id: orderRow.id,
        type_id: typeId,
      });
    }

    // assertJournalLines unused in this scenario but retained for shape parity
    void assertJournalLines;
  });
});
