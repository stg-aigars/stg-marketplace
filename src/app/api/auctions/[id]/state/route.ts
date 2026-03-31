import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enrichBidsWithProfiles } from '@/lib/auctions/actions';

/**
 * Lightweight GET endpoint for polling auction state.
 * Used by BidPanel every 10 seconds — avoids server action overhead.
 * Pass ?bids=1 to include the 10 most recent bids with bidder names.
 */
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('listings')
    .select('current_bid_cents, starting_price_cents, bid_count, highest_bidder_id, auction_end_at, status')
    .eq('id', params.id)
    .eq('listing_type', 'auction')
    .single();

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const result: Record<string, unknown> = {
    currentBidCents: data.current_bid_cents,
    startingPriceCents: data.starting_price_cents,
    bidCount: data.bid_count,
    highestBidderId: data.highest_bidder_id,
    auctionEndAt: data.auction_end_at,
    status: data.status,
  };

  const url = new URL(request.url);
  if (url.searchParams.get('bids') === '1') {
    const { data: bids } = await supabase
      .from('bids')
      .select('id, listing_id, bidder_id, amount_cents, created_at')
      .eq('listing_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10);

    result.bids = await enrichBidsWithProfiles(supabase, bids ?? []);
  }

  return NextResponse.json(result);
}
