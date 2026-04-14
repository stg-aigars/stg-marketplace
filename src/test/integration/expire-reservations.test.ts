import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServiceClient } from '../helpers/supabase';
import {
  createTestUser,
  createTestListing,
  createTestOrder,
  cleanupTestData,
} from '../helpers/factories';

const supabase = createTestServiceClient();

describe('expire_stale_reservations RPC', () => {
  let seller: Awaited<ReturnType<typeof createTestUser>>;
  let buyer: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    seller = await createTestUser({ fullName: 'Seller' });
    buyer = await createTestUser({ fullName: 'Buyer' });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it('expires stale reservation with no order', async () => {
    const listing = await createTestListing({
      sellerId: seller.id,
      status: 'reserved',
      priceCents: 1500,
    });

    // Set reserved_at to 1 hour ago and reserved_by
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await supabase
      .from('listings')
      .update({ reserved_at: oneHourAgo, reserved_by: buyer.id })
      .eq('id', listing.id);

    // Call with cutoff = 30 min ago (listing reserved 1h ago, so it's past cutoff)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: expired } = await supabase.rpc('expire_stale_reservations', {
      cutoff: thirtyMinAgo,
    });

    // Listing should be expired
    expect(expired).toContain(listing.id);

    // Verify listing is back to active
    const { data: listingAfter } = await supabase
      .from('listings')
      .select('status, reserved_at, reserved_by')
      .eq('id', listing.id)
      .single();
    expect(listingAfter?.status).toBe('active');
    expect(listingAfter?.reserved_at).toBeNull();
    expect(listingAfter?.reserved_by).toBeNull();
  });

  it('does not expire reservation with active order', async () => {
    const listing = await createTestListing({
      sellerId: seller.id,
      status: 'reserved',
      priceCents: 1500,
    });

    // Set reserved_at to 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await supabase
      .from('listings')
      .update({ reserved_at: oneHourAgo, reserved_by: buyer.id })
      .eq('id', listing.id);

    // Create an active order with order_items for this listing
    await createTestOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      items: [{ listingId: listing.id, priceCents: 1500 }],
      status: 'pending_seller',
    });

    // Call with cutoff = now
    const { data: expired } = await supabase.rpc('expire_stale_reservations', {
      cutoff: new Date().toISOString(),
    });

    // Listing should NOT be expired
    expect(expired ?? []).not.toContain(listing.id);

    // Verify listing is still reserved
    const { data: listingAfter } = await supabase
      .from('listings')
      .select('status')
      .eq('id', listing.id)
      .single();
    expect(listingAfter?.status).toBe('reserved');
  });

  it('expires reservation when order is cancelled', async () => {
    const listing = await createTestListing({
      sellerId: seller.id,
      status: 'reserved',
      priceCents: 1500,
    });

    // Set reserved_at to 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await supabase
      .from('listings')
      .update({ reserved_at: oneHourAgo, reserved_by: buyer.id })
      .eq('id', listing.id);

    // Create a cancelled order with order_items for this listing
    await createTestOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      items: [{ listingId: listing.id, priceCents: 1500 }],
      status: 'cancelled',
      cancellationReason: 'declined',
    });

    // Call with cutoff = now
    const { data: expired } = await supabase.rpc('expire_stale_reservations', {
      cutoff: new Date().toISOString(),
    });

    // Listing should be expired because the order is cancelled
    expect(expired).toContain(listing.id);

    // Verify listing is back to active
    const { data: listingAfter } = await supabase
      .from('listings')
      .select('status')
      .eq('id', listing.id)
      .single();
    expect(listingAfter?.status).toBe('active');
  });
});
