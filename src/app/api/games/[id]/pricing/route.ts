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

  // Fetch external retail price and internal marketplace stats in parallel
  const [retail, marketplace] = await Promise.all([
    fetchRetailPrice(gameId, supabase),
    fetchMarketplaceStats(gameId, supabase),
  ]);

  return NextResponse.json(
    {
      retailPriceCents: retail.priceCents,
      shopName: retail.shopName,
      marketplace,
      attributionUrl: retail.attributionUrl,
      cached: retail.cached,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=300',
      },
    },
  );
}
