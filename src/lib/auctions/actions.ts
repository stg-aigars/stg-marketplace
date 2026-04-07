'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import { fetchPublicProfiles } from '@/lib/supabase/helpers';
import type { BidWithBidder, AuctionState } from './types';

// ============================================================================
// Cancel auction (seller only, no bids)
// ============================================================================

export async function cancelAuctionListing(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_id, listing_type, status, bid_count')
    .eq('id', id)
    .single();

  if (!listing) return { error: 'Listing not found' };
  if (listing.seller_id !== user.id) return { error: 'You can only cancel your own auctions' };
  if (listing.listing_type !== 'auction') return { error: 'This is not an auction' };
  if (listing.status !== 'active') return { error: 'Can only cancel active auctions' };
  if (listing.bid_count > 0) return { error: 'Cannot cancel an auction that has bids' };

  const service = createServiceClient();
  const { error } = await service
    .from('listings')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'active')
    .eq('bid_count', 0);

  if (error) return { error: 'Failed to cancel auction' };

  revalidatePath('/account/listings');
  revalidatePath(`/listings/${id}`);
  return { success: true };
}

// ============================================================================
// Queries
// ============================================================================

/** Enrich raw bid rows with bidder names + country from public_profiles. */
export async function enrichBidsWithProfiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  bids: Array<{ id: string; listing_id: string; bidder_id: string; amount_cents: number; created_at: string }>
): Promise<BidWithBidder[]> {
  if (!bids.length) return [];
  const bidderIds = [...new Set(bids.map((b) => b.bidder_id))];
  const profileMap = await fetchPublicProfiles(supabase, bidderIds);
  return bids.map((row) => {
    const p = profileMap.get(row.bidder_id);
    return { ...row, bidder_name: p?.full_name ?? 'Anonymous', bidder_avatar_url: p?.avatar_url ?? null, bidder_country: p?.country ?? null };
  });
}

/** Get bid history for a listing (newest first, with bidder names + country).
 *  Uses public_profiles view so anonymous visitors see real names. */
export async function getBidHistory(
  listingId: string,
  limit = 50
): Promise<BidWithBidder[]> {
  const supabase = await createClient();
  const { data: bids } = await supabase
    .from('bids')
    .select('id, listing_id, bidder_id, amount_cents, created_at')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return enrichBidsWithProfiles(supabase, bids ?? []);
}

/** Get current auction state (for polling) */
export async function getAuctionState(
  listingId: string
): Promise<AuctionState | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('listings')
    .select('current_bid_cents, starting_price_cents, bid_count, highest_bidder_id, auction_end_at, status')
    .eq('id', listingId)
    .eq('listing_type', 'auction')
    .single();

  if (!data) return null;

  return {
    currentBidCents: data.current_bid_cents,
    startingPriceCents: data.starting_price_cents,
    bidCount: data.bid_count,
    highestBidderId: data.highest_bidder_id,
    auctionEndAt: data.auction_end_at,
    status: data.status,
  };
}

/** Get auctions the user won but hasn't paid for yet (auction_ended status) */
export async function getWonAuctionsAwaitingPayment(): Promise<Array<{
  id: string;
  game_name: string;
  game_year: number | null;
  thumbnail: string | null;
  current_bid_cents: number;
  payment_deadline_at: string | null;
  condition: string;
  seller_id: string;
  seller_country: string;
  seller_name: string;
  seller_avatar_url: string | null;
}>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from('listings')
    .select(`
      id, game_name, game_year, condition, current_bid_cents, payment_deadline_at,
      seller_id, country,
      games:bgg_game_id (thumbnail),
      user_profiles!listings_seller_id_fkey (full_name, avatar_url, country)
    `)
    .eq('listing_type', 'auction')
    .eq('status', 'auction_ended')
    .eq('highest_bidder_id', user.id)
    .order('payment_deadline_at', { ascending: true });

  if (!data) return [];

  return data.map((row) => {
    const games = row.games as unknown as { thumbnail: string | null } | null;
    const profile = row.user_profiles as unknown as { full_name: string | null; avatar_url: string | null; country: string } | null;
    return {
      id: row.id,
      game_name: row.game_name,
      game_year: row.game_year,
      thumbnail: games?.thumbnail ?? null,
      current_bid_cents: row.current_bid_cents,
      payment_deadline_at: row.payment_deadline_at,
      condition: row.condition,
      seller_id: row.seller_id,
      seller_country: profile?.country ?? row.country,
      seller_name: profile?.full_name ?? 'Seller',
      seller_avatar_url: profile?.avatar_url ?? null,
    };
  });
}

/** Get user's bid history across all auctions */
export async function getMyBids(): Promise<Array<{
  id: string;
  listing_id: string;
  amount_cents: number;
  created_at: string;
  game_name: string;
  game_year: number | null;
  thumbnail: string | null;
  listing_status: string;
  current_bid_cents: number | null;
  highest_bidder_id: string | null;
  auction_end_at: string | null;
  payment_deadline_at: string | null;
  condition: string;
  seller_id: string;
  seller_country: string;
  seller_name: string;
  seller_avatar_url: string | null;
}>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  // Get the user's highest bid per listing (most relevant)
  const { data } = await supabase
    .from('bids')
    .select(`
      id, listing_id, amount_cents, created_at,
      listings:listing_id (
        game_name, game_year, condition, status, current_bid_cents, highest_bidder_id,
        auction_end_at, payment_deadline_at, seller_id, country,
        games:bgg_game_id (thumbnail),
        user_profiles!listings_seller_id_fkey (full_name, avatar_url, country)
      )
    `)
    .eq('bidder_id', user.id)
    .order('created_at', { ascending: false });

  if (!data) return [];

  // Deduplicate: keep only highest bid per listing
  const seen = new Set<string>();
  return data
    .filter((row) => {
      if (seen.has(row.listing_id)) return false;
      seen.add(row.listing_id);
      return true;
    })
    .map((row) => {
      const listing = row.listings as unknown as {
        game_name: string;
        game_year: number | null;
        condition: string;
        status: string;
        current_bid_cents: number | null;
        highest_bidder_id: string | null;
        auction_end_at: string | null;
        payment_deadline_at: string | null;
        seller_id: string;
        country: string;
        games: { thumbnail: string | null } | null;
        user_profiles: { full_name: string | null; avatar_url: string | null; country: string } | null;
      } | null;

      return {
        id: row.id,
        listing_id: row.listing_id,
        amount_cents: row.amount_cents,
        created_at: row.created_at,
        game_name: listing?.game_name ?? '',
        game_year: listing?.game_year ?? null,
        thumbnail: listing?.games?.thumbnail ?? null,
        listing_status: listing?.status ?? 'cancelled',
        current_bid_cents: listing?.current_bid_cents ?? null,
        highest_bidder_id: listing?.highest_bidder_id ?? null,
        auction_end_at: listing?.auction_end_at ?? null,
        payment_deadline_at: listing?.payment_deadline_at ?? null,
        condition: listing?.condition ?? 'good',
        seller_id: listing?.seller_id ?? '',
        seller_country: listing?.user_profiles?.country ?? listing?.country ?? '',
        seller_name: listing?.user_profiles?.full_name ?? 'Seller',
        seller_avatar_url: listing?.user_profiles?.avatar_url ?? null,
      };
    });
}
