'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { verifyTurnstileToken, getServerActionIp } from '@/lib/turnstile';
import { notify } from '@/lib/notifications';
import { fetchProfiles } from '@/lib/supabase/helpers';
import {
  sendAuctionBidReceivedToSeller,
  sendAuctionOutbidNotification,
} from '@/lib/email';
import type { PlaceBidResult } from './types';

// ============================================================================
// Place bid (calls atomic RPC)
// ============================================================================

export async function placeBid(
  listingId: string,
  amountCents: number,
  turnstileToken?: string
): Promise<{ success: true; newEndAt: string; bidCount: number } | { error: string }> {
  const turnstile = await verifyTurnstileToken(turnstileToken, await getServerActionIp());
  if (!turnstile.success) return { error: turnstile.error };

  if (!Number.isInteger(amountCents) || amountCents < 50) {
    return { error: 'Invalid bid amount' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'You must be signed in' };

  // Call atomic RPC
  const { data, error } = await supabase.rpc('place_bid', {
    p_listing_id: listingId,
    p_bidder_id: user.id,
    p_amount_cents: amountCents,
  });

  if (error) {
    console.error('place_bid RPC error:', error);
    return { error: 'Failed to place bid. Please try again.' };
  }

  const result = data as PlaceBidResult;

  if (!result.success) {
    return { error: result.error ?? 'Failed to place bid' };
  }

  // Fetch listing info for notifications
  const { data: listing } = await supabase
    .from('listings')
    .select('seller_id, game_name')
    .eq('id', listingId)
    .single();

  if (listing) {
    const profileIds = [user.id, listing.seller_id];
    if (result.prev_bidder_id && result.prev_bidder_id !== user.id) {
      profileIds.push(result.prev_bidder_id);
    }
    const profiles = await fetchProfiles(supabase, profileIds);
    const bidder = profiles.get(user.id);
    const seller = profiles.get(listing.seller_id);

    // Notify + email seller of new bid
    void notify(listing.seller_id, 'auction.bid_placed', {
      gameName: listing.game_name,
      listingId,
      buyerName: bidder?.full_name ?? 'A bidder',
    });

    if (seller?.email) {
      sendAuctionBidReceivedToSeller({
        sellerName: seller.full_name,
        sellerEmail: seller.email,
        bidderName: bidder?.full_name ?? 'A bidder',
        gameName: listing.game_name,
        bidAmountCents: amountCents,
        bidCount: result.bid_count ?? 0,
        listingId,
      }).catch(() => {});
    }

    // Notify + email previous highest bidder they've been outbid
    if (result.prev_bidder_id && result.prev_bidder_id !== user.id) {
      void notify(result.prev_bidder_id, 'auction.outbid', {
        gameName: listing.game_name,
        listingId,
      });

      const prevBidder = profiles.get(result.prev_bidder_id);
      if (prevBidder?.email) {
        sendAuctionOutbidNotification({
          bidderName: prevBidder.full_name,
          bidderEmail: prevBidder.email,
          gameName: listing.game_name,
          currentBidCents: amountCents,
          listingId,
        }).catch(() => {});
      }
    }
  }

  revalidatePath(`/listings/${listingId}`);

  return {
    success: true,
    newEndAt: result.new_end_at ?? '',
    bidCount: result.bid_count ?? 0,
  };
}
