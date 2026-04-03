import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { response, user } = await requireAuth();
  if (response) return response;

  const bggGameId = request.nextUrl.searchParams.get('bgg_game_id');
  const status = request.nextUrl.searchParams.get('status') ?? 'active';

  if (!bggGameId) {
    return NextResponse.json({ error: 'Missing bgg_game_id' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, game_name, price_cents, condition, listing_type')
    .eq('seller_id', user.id)
    .eq('bgg_game_id', parseInt(bggGameId, 10))
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }

  // Fetch expansion counts for each listing
  const listingIds = (listings ?? []).map((l) => l.id);
  let expansionCounts: Record<string, number> = {};

  if (listingIds.length > 0) {
    const { data: expansions } = await supabase
      .from('listing_expansions')
      .select('listing_id')
      .in('listing_id', listingIds);

    if (expansions) {
      expansionCounts = expansions.reduce((acc, e) => {
        acc[e.listing_id] = (acc[e.listing_id] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }
  }

  const enriched = (listings ?? []).map((l) => ({
    ...l,
    expansion_count: expansionCounts[l.id] ?? 0,
  }));

  return NextResponse.json({ listings: enriched });
}
