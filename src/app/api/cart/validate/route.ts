import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import type { CartSuggestion, UnavailableItem } from '@/lib/checkout/cart-types';
import { buildSuggestionsMap, type SuggestionListing } from '@/lib/cart/suggestions';
import { getListingCardCounts } from '@/lib/listings/queries';
import { cartValidateLimiter, applyRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/cart/validate
 * Checks which listings in the given array are still active,
 * and returns enriched unavailability reasons for non-active ones.
 */
export async function POST(request: Request) {
  const rateLimitError = applyRateLimit(cartValidateLimiter, request);
  if (rateLimitError) return rateLimitError;

  let listingIds: string[];
  try {
    const body = await request.json();
    listingIds = body.listingIds;
    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ available: [], unavailable: [], sellers: {}, suggestions: {} });
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

  // Per-seller cross-sell suggestions. Wrapped in its own try/catch so a failure
  // here NEVER breaks the core validation response.
  //
  // Type split:
  //   - SuggestionListing = bare DB row shape returned by per-seller queries
  //   - CartSuggestion    = SuggestionListing + expansionCount, decorated below
  //                          via getListingCardCounts and returned to the client
  let suggestions: Record<string, CartSuggestion[]> = {};
  try {
    // Group cart's listing IDs by seller so we can exclude them from their own
    // seller's suggestion strip. Cart items keep status='active' until checkout-create
    // flips them to 'reserved' (see src/app/api/payments/cart-create/route.ts:254),
    // so the explicit exclusion below is LOAD-BEARING, not defensive.
    const excludeBySeller = new Map<string, string[]>();
    for (const l of listings ?? []) {
      if (!excludeBySeller.has(l.seller_id)) excludeBySeller.set(l.seller_id, []);
      excludeBySeller.get(l.seller_id)!.push(l.id);
    }

    const orderedSellerIds = Array.from(excludeBySeller.keys());

    const fetchOne = async (sellerId: string): Promise<SuggestionListing[]> => {
      const excludeIds = excludeBySeller.get(sellerId) ?? [];
      // NB: deviations from the plan's spec, both verified against the live schema:
      //   - listings has no `primary_photo_url` column; first photo comes from
      //     `photos TEXT[]` (canonical column per migration 001 + every
      //     listing-rendering query in the codebase).
      //   - `listing_type` enum is `fixed_price` | `auction` (see
      //     `@/lib/listings/types`); there is no `'regular'` value.
      let q = supabase
        .from('listings')
        .select('id, game_name, price_cents, condition, photos, games(thumbnail)')
        .eq('seller_id', sellerId)
        .eq('status', 'active')
        .eq('listing_type', 'fixed_price')
        .order('created_at', { ascending: false })
        .limit(8);

      if (excludeIds.length > 0) {
        // PostgREST `not.in.()` rejects empty parens; guard accordingly.
        q = q.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data, error } = await q;
      if (error) throw error;

      return (data ?? []).map((row) => ({
        listingId: row.id as string,
        gameTitle: row.game_name as string,
        gameThumbnail: (row.games as unknown as { thumbnail: string | null } | null)?.thumbnail ?? null,
        firstPhoto: ((row.photos as string[] | null) ?? [])[0] ?? null,
        condition: row.condition as SuggestionListing['condition'],
        priceCents: row.price_cents as number,
      }));
    };

    const logError = (sellerId: string, err: unknown) => {
      Sentry.captureException(err, {
        level: 'warning',
        tags: { surface: 'cart_suggestions' },
        extra: { sellerId },
      });
    };

    const bareMap = await buildSuggestionsMap(orderedSellerIds, fetchOne, logError);

    // Decorate with expansion counts via the existing helper.
    const allListingIds = Object.values(bareMap).flatMap((rows) => rows.map((r) => r.listingId));
    const { expansionCounts } = await getListingCardCounts(supabase, allListingIds);

    for (const [sellerId, rows] of Object.entries(bareMap)) {
      suggestions[sellerId] = rows.map((r) => ({
        listingId: r.listingId,
        gameTitle: r.gameTitle,
        gameThumbnail: r.gameThumbnail,
        firstPhoto: r.firstPhoto,
        condition: r.condition,
        priceCents: r.priceCents,
        expansionCount: expansionCounts[r.listingId] ?? 0,
      }));
    }
  } catch (err) {
    Sentry.captureException(err, {
      level: 'warning',
      tags: { surface: 'cart_suggestions_outer' },
    });
    suggestions = {};
  }

  return NextResponse.json({ available, unavailable, sellers, suggestions });
}
