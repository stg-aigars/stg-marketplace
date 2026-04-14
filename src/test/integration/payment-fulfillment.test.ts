import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServiceClient } from '../helpers/supabase';
import {
  createTestUser,
  createTestListing,
  cleanupTestData,
} from '../helpers/factories';

const supabase = createTestServiceClient();

describe('payment fulfillment constraints', () => {
  let seller: Awaited<ReturnType<typeof createTestUser>>;
  let buyer: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    seller = await createTestUser({ fullName: 'Seller' });
    buyer = await createTestUser({ fullName: 'Buyer' });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it('UNIQUE index prevents duplicate everypay_payment_reference', async () => {
    const listing1 = await createTestListing({ sellerId: seller.id, priceCents: 1500 });
    const listing2 = await createTestListing({ sellerId: seller.id, priceCents: 2000 });

    const paymentRef = `test-ref-${Date.now()}`;
    const orderNumber1 = `STG-DUP-${Date.now()}-A`;
    const orderNumber2 = `STG-DUP-${Date.now()}-B`;

    const baseOrder = {
      buyer_id: buyer.id,
      seller_id: seller.id,
      status: 'pending_seller' as const,
      total_amount_cents: 1850,
      items_total_cents: 1500,
      shipping_cost_cents: 350,
      seller_country: 'LV',
      platform_commission_cents: 150,
      seller_wallet_credit_cents: 1350,
      payment_method: 'card',
      item_count: 1,
      buyer_wallet_debit_cents: 0,
      everypay_payment_reference: paymentRef,
    };

    // First insert should succeed
    const { error: err1 } = await supabase
      .from('orders')
      .insert({
        ...baseOrder,
        order_number: orderNumber1,
        listing_id: listing1.id,
      });
    expect(err1).toBeNull();

    // Second insert with same payment reference should fail
    const { error: err2 } = await supabase
      .from('orders')
      .insert({
        ...baseOrder,
        order_number: orderNumber2,
        listing_id: listing2.id,
      });
    expect(err2).toBeTruthy();
    expect(err2!.message).toMatch(/unique|duplicate|idx_orders_payment_ref/i);
  });

  it('CHECK constraint prevents negative total_amount_cents', async () => {
    const listing = await createTestListing({ sellerId: seller.id, priceCents: 1500 });

    const { error } = await supabase
      .from('orders')
      .insert({
        order_number: `STG-NEG-${Date.now()}`,
        buyer_id: buyer.id,
        seller_id: seller.id,
        listing_id: listing.id,
        status: 'pending_seller',
        total_amount_cents: -100,
        items_total_cents: 0,
        shipping_cost_cents: 0,
        seller_country: 'LV',
        platform_commission_cents: 0,
        seller_wallet_credit_cents: 0,
        payment_method: 'card',
        item_count: 1,
        buyer_wallet_debit_cents: 0,
      });

    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/check|constraint|orders_total_amount_check/i);
  });
});
