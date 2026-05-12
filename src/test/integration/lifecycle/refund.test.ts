/**
 * Lifecycle integration — order refund (PR C commit 13).
 *
 * Covers:
 *   - Scenario 3: full refund same-period (O.7) — reverses O.1 within same
 *     period; pairs with C.5 cash leg (card refund actually left STG cash).
 *   - Scenario 7: refund orphan — order with no O.x antecedent (synthetic
 *     or cancelled-pre-cutover). orphan=true; refund-side O.x emit skipped;
 *     C.5 still fires (cash actually moved out).
 *
 * **Not covered here** (deferred — see `pr_c_followups.md`):
 *   - Scenario 4 (O.8 cross-period refund) — requires multi-period state
 *     setup including prior-period P.1 already posted
 *   - Scenario 5 (O.9 partial refund) — requires per-credit-note source_doc_id
 *     sequencing + proportional VAT split tests at integration level
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cartFulfillmentWithGL,
  completeOrderWithGL,
  refundOrderWithGL,
} from '@/lib/accounting/lifecycle-wraps';

import {
  supabase,
  TEST_PERIOD,
  ensureTestPeriod,
  ensureTestCounterparty,
  createSyntheticCart,
  assertJournalEntry,
  assertNoJournalEntry,
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
  vi.useFakeTimers();
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
// Scenario 3 — full refund same-period (O.7)
// ---------------------------------------------------------------------------

describe('Scenario 3 — full refund same-period emits O.7 (current-period reversal) + C.5 cash leg', () => {
  it('refundOrderWithGL on a completed order: O.7 reverses O.1; C.5 cash leg fires for card refund', async () => {
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

    const itemsTotal = 5_000;
    const shipping = 350;
    const gross = itemsTotal + shipping;

    const listing = await createTestListing({
      sellerId: seller.id,
      priceCents: itemsTotal,
      country: 'LV',
    });

    const { cart_group_id, everypay_payment_reference } = await createSyntheticCart(supabase, {
      buyer_id: buyer.id,
      total_amount_cents: gross,
      terminal_country: 'LV',
    });

    // Step 1: pre-emit C.1 (cart payment)
    await cartFulfillmentWithGL(supabase, {
      cart_group_id,
      buyer_id: buyer.id,
      payment_method: 'card',
      gross_cart_cents: gross,
      buyer_wallet_cents: 0,
      everypay_payment_reference,
      callback_payload: { test_artifact: true },
    });

    // Step 2: create order, link to cart, complete it → O.1
    const orderRow = await createTestOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      items: [{ listingId: listing.id, priceCents: itemsTotal }],
      shippingCostCents: shipping,
      status: 'pending_seller',
    });
    await supabase
      .from('orders')
      .update({ cart_group_id, seller_country: 'LV' })
      .eq('id', orderRow.id);
    await createTestWallet({ userId: seller.id, balanceCents: 0 });

    await completeOrderWithGL(supabase, {
      id: orderRow.id,
      seller_id: seller.id,
      seller_country: 'LV',
      items_total_cents: itemsTotal,
      shipping_cost_cents: shipping,
      order_number: orderRow.order_number,
      cart_group_id,
    });

    // Sanity: O.1 exists
    await assertJournalEntry(supabase, {
      source_doc_type: 'order',
      source_doc_id: orderRow.id,
      type_id: 'O.1',
    });

    // Step 3: refund the order — full card refund
    const creditNoteNumber = `STG-CN-${crypto.randomUUID().slice(0, 8)}`;
    await supabase
      .from('orders')
      .update({ credit_note_number: creditNoteNumber, invoice_number: orderRow.order_number })
      .eq('id', orderRow.id);

    const result = await refundOrderWithGL(
      supabase,
      {
        id: orderRow.id,
        seller_id: seller.id,
        order_number: orderRow.order_number,
        invoice_number: orderRow.order_number,
        credit_note_number: creditNoteNumber,
        items_total_cents: itemsTotal,
        shipping_cost_cents: shipping,
        total_amount_cents: gross,
        payment_method: 'card',
        cart_group_id,
      },
      {
        card_refunded: gross,
        wallet_refunded: 0,
        total_refunded: gross,
        refund_status: 'completed',
      }
    );

    expect(result.orphan).toBe(false);
    expect(result.refund_entry_id).toBeTruthy();
    expect(result.cash_leg_entry_id).toBeTruthy();

    // O.7 exists (current-period reversal)
    const refundEntry = await assertJournalEntry(supabase, {
      source_doc_type: 'order',
      source_doc_id: orderRow.id,
      type_id: 'O.7',
    });
    expect(refundEntry.accounting_period).toBe(TEST_PERIOD);

    // C.5 cash leg exists (card refund actually moved out)
    const cashLegRef = `STG-RF-${TEST_PERIOD}-${orderRow.order_number}`;
    await assertJournalEntry(supabase, {
      source_doc_type: 'refund',
      source_doc_id: cashLegRef,
      type_id: 'C.5',
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario 7 — refund orphan (no O.x antecedent → C.5 only)
// ---------------------------------------------------------------------------

describe('Scenario 7 — refund orphan: no O.x antecedent emits C.5 only with orphan=true telemetry hook', () => {
  it('refundOrderWithGL on order with no O.x: orphan=true; refund_entry_id=null; C.5 still emits for card refund', async () => {
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

    const itemsTotal = 3_000;
    const shipping = 350;
    const gross = itemsTotal + shipping;

    const listing = await createTestListing({
      sellerId: seller.id,
      priceCents: itemsTotal,
      country: 'LV',
    });
    const orderRow = await createTestOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      items: [{ listingId: listing.id, priceCents: itemsTotal }],
      shippingCostCents: shipping,
      status: 'pending_seller',
    });

    // No completeOrderWithGL → no O.x antecedent in journal_entries

    const result = await refundOrderWithGL(
      supabase,
      {
        id: orderRow.id,
        seller_id: seller.id,
        order_number: orderRow.order_number,
        invoice_number: null,
        credit_note_number: null,
        items_total_cents: itemsTotal,
        shipping_cost_cents: shipping,
        total_amount_cents: gross,
        payment_method: 'card',
        cart_group_id: null,
      },
      {
        card_refunded: gross,
        wallet_refunded: 0,
        total_refunded: gross,
        refund_status: 'completed',
      }
    );

    expect(result.orphan).toBe(true);
    expect(result.refund_entry_id).toBeNull();
    // Cash leg still fires — STG cash actually left the books via card refund
    expect(result.cash_leg_entry_id).toBeTruthy();

    // No O.7 / O.8 / O.9 in journal_entries for this order
    for (const typeId of ['O.7', 'O.8', 'O.9']) {
      await assertNoJournalEntry(supabase, {
        source_doc_type: 'order',
        source_doc_id: orderRow.id,
        type_id: typeId,
      });
    }
  });
});
