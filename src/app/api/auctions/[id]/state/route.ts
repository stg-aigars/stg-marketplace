import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Lightweight GET endpoint for polling auction state.
 * Used by BidPanel every 10 seconds — avoids server action overhead.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
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

  return NextResponse.json({
    currentBidCents: data.current_bid_cents,
    startingPriceCents: data.starting_price_cents,
    bidCount: data.bid_count,
    highestBidderId: data.highest_bidder_id,
    auctionEndAt: data.auction_end_at,
    status: data.status,
  });
}
