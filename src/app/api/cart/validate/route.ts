import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { UnavailableItem } from '@/lib/checkout/cart-types';

/**
 * POST /api/cart/validate
 * Checks which listings in the given array are still active,
 * and returns enriched unavailability reasons for non-active ones.
 */
export async function POST(request: Request) {
  let listingIds: string[];
  try {
    const body = await request.json();
    listingIds = body.listingIds;
    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ available: [], unavailable: [], sellers: {} });
    }
    if (listingIds.length > 20) {
      return NextResponse.json({ error: 'Too many items' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const supabase = await createClient();

  // Get current user for auction winner check (optional — unauthenticated callers skip auction validation)
  const { data: { user } } = await supabase.auth.getUser();

  const { data: listings } = await supabase
    .from('listings')
    .select('id, status, seller_id, listing_type, highest_bidder_id')
    .in('id', listingIds);

  const listingMap = new Map<string, { status: string; seller_id: string; listing_type: string; highest_bidder_id: string | null }>();
  const sellerIds = new Set<string>();
  for (const l of listings ?? []) {
    listingMap.set(l.id, l);
    sellerIds.add(l.seller_id);
  }

  const available: string[] = [];
  const unavailable: UnavailableItem[] = [];

  for (const id of listingIds) {
    const listing = listingMap.get(id);
    if (!listing) {
      unavailable.push({ id, reason: 'cancelled' });
      continue;
    }

    if (listing.status === 'active') {
      available.push(id);
    } else if (listing.status === 'auction_ended' && listing.listing_type === 'auction' && user?.id === listing.highest_bidder_id) {
      // Auction winner can check out their won auction
      available.push(id);
    } else if (listing.status === 'reserved') {
      unavailable.push({ id, reason: 'reserved' });
    } else if (listing.status === 'sold') {
      unavailable.push({ id, reason: 'sold' });
    } else {
      unavailable.push({ id, reason: 'cancelled' });
    }
  }

  // Fetch seller profiles for cart display (name, avatar, country)
  const sellers: Record<string, { name: string; avatarUrl: string | null; country: string | null }> = {};
  if (sellerIds.size > 0) {
    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('id, full_name, avatar_url, country')
      .in('id', Array.from(sellerIds));

    for (const p of profiles ?? []) {
      sellers[p.id] = {
        name: p.full_name ?? 'Seller',
        avatarUrl: p.avatar_url ?? null,
        country: p.country ?? null,
      };
    }
  }

  return NextResponse.json({ available, unavailable, sellers });
}
