import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';
import { pricingLimiter, applyRateLimit } from '@/lib/rate-limit';
import {
  fetchRetailPrice,
  fetchMarketplaceStats,
} from '@/lib/pricing/suggestions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitError = applyRateLimit(pricingLimiter, request);
  if (rateLimitError) return rateLimitError;

  const { response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const gameId = parseInt(id, 10);

  if (isNaN(gameId) || gameId <= 0) {
    return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Parse expansion IDs if provided
  const expansionIdsParam = request.nextUrl.searchParams.get('expansionIds')?.trim() ?? '';
  const expansionIds = expansionIdsParam
    ? expansionIdsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0)
    : [];

  // Fetch external retail price and internal marketplace stats in parallel
  const [retail, marketplace] = await Promise.all([
    fetchRetailPrice(gameId, supabase),
    fetchMarketplaceStats(gameId, supabase),
  ]);

  // If expansion IDs provided, fetch their retail prices in parallel
  let bundleFields: Record<string, unknown> = {};
  if (expansionIds.length > 0) {
    const allIds = [gameId, ...expansionIds];
    const retailResults = await Promise.all(
      allIds.map(async (id) => {
        const r = await fetchRetailPrice(id, supabase);
        return { bggGameId: id, retailPriceCents: r.priceCents, shopName: r.shopName };
      })
    );

    const withData = retailResults.filter((r) => r.retailPriceCents !== null);
    const bundleTotal = withData.reduce((sum, r) => sum + (r.retailPriceCents ?? 0), 0);

    bundleFields = {
      bundleRetailPriceCents: withData.length > 0 ? bundleTotal : null,
      breakdown: retailResults,
      gamesWithRetailData: withData.length,
      totalGames: allIds.length,
    };
  }

  return NextResponse.json(
    {
      retailPriceCents: retail.priceCents,
      shopName: retail.shopName,
      marketplace,
      attributionUrl: retail.attributionUrl,
      cached: retail.cached,
      ...bundleFields,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=300',
      },
    },
  );
}
