import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServiceClient } from '../helpers/supabase';
import {
  createTestUser,
  createTestListing,
  createTestOrder,
  cleanupTestData,
} from '../helpers/factories';

const supabase = createTestServiceClient();

describe('reservation race conditions', () => {
  let seller: Awaited<ReturnType<typeof createTestUser>>;
  let buyer1: Awaited<ReturnType<typeof createTestUser>>;
  let buyer2: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    seller = await createTestUser({ fullName: 'Seller' });
    buyer1 = await createTestUser({ fullName: 'Buyer 1' });
    buyer2 = await createTestUser({ fullName: 'Buyer 2' });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it('concurrent reserve: only one buyer wins the reservation', async () => {
    const listing = await createTestListing({
      sellerId: seller.id,
      status: 'active',
      priceCents: 2000,
    });

    const reserve = (buyerId: string) =>
      supabase.rpc('reserve_listings_atomic', {
        p_listing_ids: [listing.id],
        p_buyer_id: buyerId,
      });

    const [result1, result2] = await Promise.allSettled([
      reserve(buyer1.id),
      reserve(buyer2.id),
    ]);

    // Both should resolve (PostgREST returns error in response, not rejection)
    expect(result1.status).toBe('fulfilled');
    expect(result2.status).toBe('fulfilled');

    const r1 =
      result1.status === 'fulfilled' ? result1.value : { data: null, error: result1.reason };
    const r2 =
      result2.status === 'fulfilled' ? result2.value : { data: null, error: result2.reason };

    // One should return empty array (success), the other should return the listing ID (failed)
    const r1Failed = r1.error || (Array.isArray(r1.data) && r1.data.length > 0);
    const r2Failed = r2.error || (Array.isArray(r2.data) && r2.data.length > 0);

    // Exactly one should succeed (empty array = success, non-empty = failed)
    expect(r1Failed !== r2Failed).toBe(true);

    // Listing should be reserved
    const { data: listingAfter } = await supabase
      .from('listings')
      .select('status, reserved_by')
      .eq('id', listing.id)
      .single();
    expect(listingAfter?.status).toBe('reserved');
    // The winner should be one of the two buyers
    expect([buyer1.id, buyer2.id]).toContain(listingAfter?.reserved_by);
  });

  it('expire_stale_reservations skips listing with active order_items', async () => {
    const listing = await createTestListing({
      sellerId: seller.id,
      status: 'active',
      priceCents: 1500,
    });

    // Reserve the listing
    const { error: reserveErr } = await supabase.rpc('reserve_listings_atomic', {
      p_listing_ids: [listing.id],
      p_buyer_id: buyer1.id,
    });
    expect(reserveErr).toBeNull();

    // Set reserved_at to 1 hour ago so it qualifies as stale
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await supabase
      .from('listings')
      .update({ reserved_at: oneHourAgo })
      .eq('id', listing.id);

    // Create an order with order_items referencing this listing
    await createTestOrder({
      buyerId: buyer1.id,
      sellerId: seller.id,
      items: [{ listingId: listing.id, priceCents: 1500 }],
      status: 'pending_seller',
    });

    // Call expire_stale_reservations with cutoff = now (listing was reserved 1h ago)
    const { data: expired } = await supabase.rpc('expire_stale_reservations', {
      cutoff: new Date().toISOString(),
    });

    // Listing should NOT be expired because it has an active order
    expect(expired ?? []).not.toContain(listing.id);

    // Verify listing is still reserved
    const { data: listingAfter } = await supabase
      .from('listings')
      .select('status')
      .eq('id', listing.id)
      .single();
    expect(listingAfter?.status).toBe('reserved');
  });
});
