/**
 * Auction end cron endpoint.
 * Finds active auctions past their end time and transitions them:
 * - With bids → auction_ended (winner gets 24h to pay)
 * - No bids → cancelled
 *
 * Should run every 1 minute for accurate auction endings.
 * curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/end-auctions
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { notify, notifyMany } from '@/lib/notifications';
import { fetchProfiles } from '@/lib/supabase/helpers';
import {
  sendAuctionWonToWinner,
  sendAuctionWonToSeller,
  sendAuctionLostNotification,
  sendAuctionEndedNoBidsToSeller,
} from '@/lib/email';

const BATCH_LIMIT = 50;

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  let endedWithBids = 0;
  let endedNoBids = 0;
  const errors: string[] = [];

  // Find active auctions past their end time
  const { data: expiredAuctions, error: queryError } = await supabase
    .from('listings')
    .select(`
      id, seller_id, game_name, bid_count, highest_bidder_id,
      current_bid_cents
    `)
    .eq('listing_type', 'auction')
    .eq('status', 'active')
    .lt('auction_end_at', new Date().toISOString())
    .limit(BATCH_LIMIT);

  if (queryError) {
    console.error('[Cron] End auctions query failed:', queryError);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  if (!expiredAuctions?.length) {
    return NextResponse.json({ endedWithBids: 0, endedNoBids: 0 });
  }

  // Pre-fetch all losing bidders so we can batch profile lookups
  const auctionsWithBids = expiredAuctions.filter(
    (a) => a.bid_count > 0 && a.highest_bidder_id
  );
  const losingBiddersMap = new Map<string, string[]>(); // listingId → unique bidder IDs

  if (auctionsWithBids.length) {
    const auctionIds = auctionsWithBids.map((a) => a.id);
    const winnerIds = new Set(auctionsWithBids.map((a) => a.highest_bidder_id!));

    const { data: allOtherBids } = await supabase
      .from('bids')
      .select('listing_id, bidder_id')
      .in('listing_id', auctionIds);

    if (allOtherBids?.length) {
      for (const bid of allOtherBids) {
        if (winnerIds.has(bid.bidder_id) && auctionsWithBids.find(
          (a) => a.id === bid.listing_id && a.highest_bidder_id === bid.bidder_id
        )) continue; // skip winner for their own auction
        const existing = losingBiddersMap.get(bid.listing_id);
        if (existing) {
          if (!existing.includes(bid.bidder_id)) existing.push(bid.bidder_id);
        } else {
          losingBiddersMap.set(bid.listing_id, [bid.bidder_id]);
        }
      }
    }
  }

  // Collect ALL unique user IDs across all auctions and fetch profiles in one call
  const allUserIds = new Set<string>();
  for (const auction of expiredAuctions) {
    allUserIds.add(auction.seller_id);
    if (auction.highest_bidder_id) allUserIds.add(auction.highest_bidder_id);
  }
  for (const bidderIds of losingBiddersMap.values()) {
    for (const id of bidderIds) allUserIds.add(id);
  }

  const allProfiles = await fetchProfiles(supabase, Array.from(allUserIds));

  for (const auction of expiredAuctions) {
    try {
      if (auction.bid_count > 0 && auction.highest_bidder_id) {
        // Auction with bids → auction_ended, set payment deadline
        const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { error: updateError } = await supabase
          .from('listings')
          .update({
            status: 'auction_ended',
            payment_deadline_at: paymentDeadline,
          })
          .eq('id', auction.id)
          .eq('status', 'active');

        if (updateError) {
          console.error(`[Cron] Failed to end auction ${auction.id}:`, updateError);
          errors.push(`Failed to end ${auction.id}`);
          continue;
        }

        endedWithBids++;

        const winner = allProfiles.get(auction.highest_bidder_id);
        const seller = allProfiles.get(auction.seller_id);

        // Notify + email winner
        void notify(auction.highest_bidder_id, 'auction.won', {
          gameName: auction.game_name,
          listingId: auction.id,
        });

        if (winner?.email) {
          sendAuctionWonToWinner({
            winnerName: winner.full_name,
            winnerEmail: winner.email,
            gameName: auction.game_name,
            winningBidCents: auction.current_bid_cents,
            listingId: auction.id,
          }).catch((err) => console.error('[Cron] Failed to email auction winner:', err));
        }

        // Notify + email seller that auction ended with a winner
        void notify(auction.seller_id, 'auction.won_seller', {
          gameName: auction.game_name,
          listingId: auction.id,
          buyerName: winner?.full_name,
        });
        if (seller?.email) {
          sendAuctionWonToSeller({
            sellerName: seller.full_name,
            sellerEmail: seller.email,
            gameName: auction.game_name,
            winningBidCents: auction.current_bid_cents,
            listingId: auction.id,
          }).catch((err) => console.error('[Cron] Failed to email auction-won seller:', err));
        }

        // Notify + email all other bidders that they lost
        const uniqueBidders = losingBiddersMap.get(auction.id);
        if (uniqueBidders?.length) {
          const notifications = uniqueBidders.map((bidderId) => ({
            userId: bidderId,
            type: 'auction.lost' as const,
            context: {
              gameName: auction.game_name,
              listingId: auction.id,
            },
          }));
          void notifyMany(notifications);

          // Email losing bidders (fire-and-forget)
          for (const bidderId of uniqueBidders) {
            const bidder = allProfiles.get(bidderId);
            if (bidder?.email) {
              sendAuctionLostNotification({
                bidderName: bidder.full_name,
                bidderEmail: bidder.email,
                gameName: auction.game_name,
              }).catch((err) => console.error('[Cron] Failed to email losing bidder:', err));
            }
          }
        }
      } else {
        // No bids → cancelled
        const { error: updateError } = await supabase
          .from('listings')
          .update({ status: 'cancelled' })
          .eq('id', auction.id)
          .eq('status', 'active');

        if (updateError) {
          console.error(`[Cron] Failed to cancel auction ${auction.id}:`, updateError);
          errors.push(`Failed to cancel ${auction.id}`);
          continue;
        }

        endedNoBids++;

        // Notify + email seller
        void notify(auction.seller_id, 'auction.ended_no_bids', {
          gameName: auction.game_name,
        });

        const seller = allProfiles.get(auction.seller_id);
        if (seller?.email) {
          sendAuctionEndedNoBidsToSeller({
            sellerName: seller.full_name,
            sellerEmail: seller.email,
            gameName: auction.game_name,
          }).catch((err) => console.error('[Cron] Failed to email no-bids seller:', err));
        }
      }
    } catch (err) {
      console.error(`[Cron] Error processing auction ${auction.id}:`, err);
      errors.push(`Error on ${auction.id}`);
    }
  }

  console.log(`[Cron] Ended ${endedWithBids} auctions with bids, ${endedNoBids} with no bids`);

  return NextResponse.json({
    endedWithBids,
    endedNoBids,
    hasMore: expiredAuctions.length === BATCH_LIMIT,
    errors,
  });
}
