import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';
import type { ListingCondition } from '@/lib/listings/types';
import { LISTING_CONDITIONS } from '@/lib/listings/types';
import {
  fetchRetailPrice,
  fetchMarketplaceStats,
  calculateSuggestedPrice,
  CONDITION_MULTIPLIERS,
  type PriceSuggestionResponse,
} from '@/lib/pricing/suggestions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const gameId = parseInt(id, 10);

  if (isNaN(gameId) || gameId <= 0) {
    return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
  }

  const { searchParams } = request.nextUrl;
  const condition = searchParams.get('condition') as ListingCondition | null;
  const isAuction = searchParams.get('isAuction') === 'true';

  if (condition && !LISTING_CONDITIONS.includes(condition)) {
    return NextResponse.json({ error: 'Invalid condition' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch external retail price and internal marketplace stats in parallel
  const [retail, marketplace] = await Promise.all([
    fetchRetailPrice(gameId, supabase),
    fetchMarketplaceStats(gameId, supabase),
  ]);

  const suggestedPriceCents = condition
    ? calculateSuggestedPrice(retail.priceCents, condition, isAuction)
    : null;

  const result: PriceSuggestionResponse = {
    retailPriceCents: retail.priceCents,
    shopName: retail.shopName,
    suggestedPriceCents,
    conditionMultiplier: condition ? CONDITION_MULTIPLIERS[condition] : 0,
    marketplace,
    attributionUrl: retail.attributionUrl,
    cached: retail.cached,
  };

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'private, max-age=300',
    },
  });
}
