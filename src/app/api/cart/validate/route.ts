import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import type { CartSuggestion, UnavailableItem } from '@/lib/checkout/cart-types';
import { buildSuggestionsMap } from '@/lib/cart/suggestions';
import { getListingCardCounts } from '@/lib/listings/queries';
import { cartValidateLimiter, applyRateLimit } from '@/lib/rate-limit';

/**
 * Column set for cross-sell suggestions — matches `ListingSectionItem` so the
 * client can render through the shared `ListingSection` component (same shape
 * the listing-detail "More from {seller}" rail uses; see RelatedListings.tsx).
 */
const SUGGESTION_SELECT =
  'id, game_name, price_cents, previous_price_cents, price_changed_at, photos, country, version_thumbnail, listing_type, games(image, is_expansion)' as const;

/** Per-request rotation: fetch the newest POOL_SIZE, shuffle, return DISPLAY_SIZE. */
const SUGGESTION_POOL_SIZE = 12;
const SUGGESTION_DISPLAY_SIZE = 4;

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
      return NextResponse.json({
        available: [],
        unavailable: [],
        sellers: {},
        suggestions: {},
        suggestionExpansionCounts: {},
        suggestionCommentCounts: {},
      });
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
  // Rows match `ListingSectionItem` so the client can render through the same
  // `ListingSection` component the listing detail page uses for "More from
  // {seller}" (see RelatedListings.tsx). Count maps decorate IDs flat across
  // all sellers — the client looks them up per render.
  let suggestions: Record<string, CartSuggestion[]> = {};
  let suggestionExpansionCounts: Record<string, number> = {};
  let suggestionCommentCounts: Record<string, number> = {};
  try {
    // Group cart's listing IDs by seller so we can exclude them from their own
    // seller's suggestion strip. Cart items keep status='active' until
    // checkout-create flips them to 'reserved' (see reserve_listings_atomic RPC
    // call in src/app/api/payments/cart-create/route.ts), so the explicit
    // exclusion below is LOAD-BEARING, not defensive.
    const excludeBySeller = new Map<string, string[]>();
    for (const l of listings ?? []) {
      if (!excludeBySeller.has(l.seller_id)) excludeBySeller.set(l.seller_id, []);
      excludeBySeller.get(l.seller_id)!.push(l.id);
    }

    const orderedSellerIds = Array.from(excludeBySeller.keys());

    const fetchOne = async (sellerId: string): Promise<CartSuggestion[]> => {
      const excludeIds = excludeBySeller.get(sellerId) ?? [];
      let q = supabase
        .from('listings')
        .select(SUGGESTION_SELECT)
        .eq('seller_id', sellerId)
        .eq('status', 'active')
        .eq('listing_type', 'fixed_price')
        .order('created_at', { ascending: false })
        .limit(SUGGESTION_POOL_SIZE);

      if (excludeIds.length > 0) {
        // PostgREST `not.in.()` rejects empty parens; guard accordingly.
        q = q.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data, error } = await q.returns<CartSuggestion[]>();
      if (error) throw error;

      // Fisher-Yates shuffle the pool, then take the first DISPLAY_SIZE.
      // Rotates which cards a returning visitor sees without a full random()
      // ORDER BY (which would need an RPC). Pool stays skewed toward recent
      // inventory, which is fine — old listings shouldn't surface here.
      const pool = [...(data ?? [])];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, SUGGESTION_DISPLAY_SIZE);
    };

    const logError = (sellerId: string, err: unknown) => {
      Sentry.captureException(err, {
        level: 'warning',
        tags: { surface: 'cart_suggestions' },
        extra: { sellerId },
      });
    };

    suggestions = await buildSuggestionsMap(orderedSellerIds, fetchOne, logError);

    // Decorate expansion + comment counts via the existing helper used by RelatedListings.
    const allListingIds = Object.values(suggestions).flatMap((rows) => rows.map((r) => r.id));
    if (allListingIds.length > 0) {
      const counts = await getListingCardCounts(supabase, allListingIds);
      suggestionExpansionCounts = counts.expansionCounts;
      suggestionCommentCounts = counts.commentCounts;
    }
  } catch (err) {
    Sentry.captureException(err, {
      level: 'warning',
      tags: { surface: 'cart_suggestions_outer' },
    });
    // Wipe any partial state from a mid-loop throw — the type contract requires full maps.
    suggestions = {};
    suggestionExpansionCounts = {};
    suggestionCommentCounts = {};
  }

  return NextResponse.json({
    available,
    unavailable,
    sellers,
    suggestions,
    suggestionExpansionCounts,
    suggestionCommentCounts,
  });
}
