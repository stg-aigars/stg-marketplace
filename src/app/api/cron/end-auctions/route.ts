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
  sendAuctionOutbidNotification,
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

        // Fetch profiles for emails
        const profiles = await fetchProfiles(supabase, [auction.highest_bidder_id]);
        const winner = profiles.get(auction.highest_bidder_id);

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

        // Notify seller that auction ended with a winner
        void notify(auction.seller_id, 'auction.won', {
          gameName: auction.game_name,
          listingId: auction.id,
        });

        // Notify + email all other bidders that they lost
        const { data: otherBids } = await supabase
          .from('bids')
          .select('bidder_id')
          .eq('listing_id', auction.id)
          .neq('bidder_id', auction.highest_bidder_id);

        if (otherBids?.length) {
          const uniqueBidders = Array.from(new Set(otherBids.map((b) => b.bidder_id)));
          const notifications = uniqueBidders.map((bidderId) => ({
            userId: bidderId,
            type: 'auction.outbid' as const,
            context: {
              gameName: auction.game_name,
              listingId: auction.id,
            },
          }));
          void notifyMany(notifications);

          // Email outbid bidders (fire-and-forget)
          const bidderProfiles = await fetchProfiles(supabase, uniqueBidders);
          bidderProfiles.forEach((bidder) => {
            if (bidder.email) {
              sendAuctionOutbidNotification({
                bidderName: bidder.full_name,
                bidderEmail: bidder.email,
                gameName: auction.game_name,
                currentBidCents: auction.current_bid_cents,
                listingId: auction.id,
              }).catch((err) => console.error('[Cron] Failed to email outbid bidder:', err));
            }
          });
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

        const sellerProfiles = await fetchProfiles(supabase, [auction.seller_id]);
        const seller = sellerProfiles.get(auction.seller_id);
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
