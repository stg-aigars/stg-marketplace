import type { SupabaseClient } from '@supabase/supabase-js';
import type { ListingCondition } from '@/lib/listings/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Condition-based discount multipliers against retail price */
export const CONDITION_MULTIPLIERS: Record<ListingCondition, number> = {
  like_new: 0.85,
  very_good: 0.75,
  good: 0.65,
  acceptable: 0.50,
  for_parts: 0.30,
};

/** Auction starting bid = 30% of what fixed price would be */
export const AUCTION_BID_MULTIPLIER = 0.30;

/** Floor for any suggested price (€1.00) */
export const MIN_SUGGESTED_PRICE_CENTS = 100;

/** Cache TTL: 65 minutes (60-min ToS minimum + 5-min buffer) */
export const PRICING_CACHE_TTL_MS = 65 * 60 * 1000;

/** External API request timeout */
const BGP_API_TIMEOUT_MS = 5000;

/** Minimum completed sales before showing median */
export const MIN_SALES_FOR_MEDIAN = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriceSuggestionResponse {
  retailPriceCents: number | null;
  shopName: string | null;
  marketplace: MarketplaceStats;
  attributionUrl: string | null;
  cached: boolean;
}

interface RetailPriceResult {
  priceCents: number | null;
  shopName: string | null;
  attributionUrl: string | null;
  cached: boolean;
}

export interface MarketplaceStats {
  lowestActiveCents: number | null;
  lowestIsAuction: boolean;
  medianSoldCents: number | null;
  activeListingCount: number;
  completedSaleCount: number;
}

// ---------------------------------------------------------------------------
// BGP API fetch + cache
// ---------------------------------------------------------------------------

/**
 * Fetch retail price from BoardGamePrices.co.uk with database caching.
 * Returns null prices on API failure — never throws.
 */
export async function fetchRetailPrice(
  bggGameId: number,
  supabase: SupabaseClient,
): Promise<RetailPriceResult> {
  // Check cache first
  const { data: cached } = await supabase
    .from('external_pricing_cache')
    .select('cheapest_price_cents, shop_name, source_url, fetched_at')
    .eq('bgg_game_id', bggGameId)
    .single();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < PRICING_CACHE_TTL_MS) {
      return {
        priceCents: cached.cheapest_price_cents,
        shopName: cached.shop_name,
        attributionUrl: cached.source_url,
        cached: true,
      };
    }
  }

  // Cache miss or expired — fetch from BGP API
  // destination=DE is a required param but irrelevant — we use .product (base price excl. shipping)
  const url = new URL('https://boardgameprices.co.uk/api/info');
  url.searchParams.set('sitename', 'secondturn.games');
  url.searchParams.set('currency', 'EUR');
  url.searchParams.set('destination', 'DE');
  url.searchParams.set('delivery', 'PACKAGE,POSTOFFICE');
  url.searchParams.set('stock', 'Y');
  url.searchParams.set('sort', 'CHEAP2');
  url.searchParams.set('eid', String(bggGameId));

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(BGP_API_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error(`[pricing] BGP API returned ${res.status} for game ${bggGameId}`);
      return { priceCents: null, shopName: null, attributionUrl: null, cached: false };
    }

    const data = await res.json();

    const item = data?.items?.[0];
    const offer = item?.prices?.[0];
    // .product is base price (excl. shipping), fallback to .price
    const priceEur = offer?.product ?? offer?.price;
    const priceCents = typeof priceEur === 'number' ? Math.round(priceEur * 100) : null;
    const shopName = offer?.shop_name ?? offer?.name ?? null;
    const attributionUrl = item?.id
      ? `https://boardgameprices.co.uk/item/show/${item.id}/secondturn.games`
      : null;

    // Upsert cache (service role bypasses RLS)
    await supabase.from('external_pricing_cache').upsert(
      {
        bgg_game_id: bggGameId,
        cheapest_price_cents: priceCents,
        shop_name: shopName,
        source_url: attributionUrl,
        offer_count: item?.prices?.length ?? 0,
        response_json: data,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'bgg_game_id' },
    );

    return { priceCents, shopName, attributionUrl, cached: false };
  } catch (err) {
    console.error(`[pricing] BGP API error for game ${bggGameId}:`, err);
    return { priceCents: null, shopName: null, attributionUrl: null, cached: false };
  }
}

// ---------------------------------------------------------------------------
// Internal marketplace stats
// ---------------------------------------------------------------------------

export async function fetchMarketplaceStats(
  bggGameId: number,
  supabase: SupabaseClient,
): Promise<MarketplaceStats> {
  const empty: MarketplaceStats = {
    lowestActiveCents: null,
    lowestIsAuction: false,
    medianSoldCents: null,
    activeListingCount: 0,
    completedSaleCount: 0,
  };

  try {
    // Run both queries in parallel
    const [activeResult, salesResult] = await Promise.all([
      // Active listings stats
      supabase
        .from('listings')
        .select('price_cents, listing_type')
        .eq('bgg_game_id', bggGameId)
        .eq('status', 'active')
        .order('price_cents', { ascending: true }),

      // Completed sales prices
      supabase
        .from('order_items')
        .select('price_cents, orders!inner(status), listings!inner(bgg_game_id)')
        .eq('listings.bgg_game_id', bggGameId)
        .eq('orders.status', 'completed')
        .eq('active', true),
    ]);

    const activeListings = activeResult.data ?? [];
    const salesData = salesResult.data ?? [];

    const lowestListing = activeListings[0] ?? null;
    const salePrices = salesData.map((s: { price_cents: number }) => s.price_cents);

    return {
      lowestActiveCents: lowestListing?.price_cents ?? null,
      lowestIsAuction: lowestListing?.listing_type === 'auction',
      medianSoldCents:
        salePrices.length >= MIN_SALES_FOR_MEDIAN
          ? computeMedian(salePrices)
          : null,
      activeListingCount: activeListings.length,
      completedSaleCount: salePrices.length,
    };
  } catch (err) {
    console.error(`[pricing] Marketplace stats error for game ${bggGameId}:`, err);
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Suggested price calculation
// ---------------------------------------------------------------------------

/**
 * Calculate a suggested price based on retail, condition, and listing type.
 * Returns null if no retail price is available.
 */
export function calculateSuggestedPrice(
  retailPriceCents: number | null,
  condition: ListingCondition,
  isAuction: boolean,
): number | null {
  if (retailPriceCents == null || retailPriceCents <= 0) return null;

  const multiplier = CONDITION_MULTIPLIERS[condition];
  let suggested = Math.round(retailPriceCents * multiplier);

  if (isAuction) {
    suggested = Math.round(suggested * AUCTION_BID_MULTIPLIER);
  }

  return Math.max(suggested, MIN_SUGGESTED_PRICE_CENTS);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Compute median of a number array. Returns null for empty arrays. */
export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}
