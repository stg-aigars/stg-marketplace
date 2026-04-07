/**
 * Auction ending soon cron endpoint.
 * Finds active auctions ending within 30 minutes that haven't been notified yet,
 * and sends a single "ending soon" notification + email to all bidders and the seller.
 *
 * Should run every 5 minutes.
 * curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/auction-ending-soon
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { notifyMany } from '@/lib/notifications';
import { fetchProfiles } from '@/lib/supabase/helpers';
import { sendAuctionEndingSoon } from '@/lib/email';
import { QUIET_WINDOW_MS } from '@/lib/auctions/types';

const BATCH_LIMIT = 50;

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  let notified = 0;
  const errors: string[] = [];

  const now = new Date();
  const windowEnd = new Date(now.getTime() + QUIET_WINDOW_MS);

  // Find active auctions ending within 30 minutes that haven't been notified
  const { data: auctions, error: queryError } = await supabase
    .from('listings')
    .select('id, seller_id, game_name, bid_count')
    .eq('listing_type', 'auction')
    .eq('status', 'active')
    .gt('auction_end_at', now.toISOString())
    .lte('auction_end_at', windowEnd.toISOString())
    .is('auction_ending_soon_notified_at', null)
    .gt('bid_count', 0)
    .limit(BATCH_LIMIT);

  if (queryError) {
    console.error('[Cron] Auction ending soon query failed:', queryError);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  if (!auctions?.length) {
    return NextResponse.json({ notified: 0 });
  }

  for (const auction of auctions) {
    try {
      // Get all unique bidders for this auction
      const { data: bids } = await supabase
        .from('bids')
        .select('bidder_id')
        .eq('listing_id', auction.id);

      const uniqueBidderIds = Array.from(new Set(bids?.map((b) => b.bidder_id) ?? []));

      if (!uniqueBidderIds.length) continue;

      // Send in-app notifications to all bidders
      const notifications = uniqueBidderIds.map((bidderId) => ({
        userId: bidderId,
        type: 'auction.ending_soon' as const,
        context: {
          gameName: auction.game_name,
          listingId: auction.id,
        },
      }));

      // Also notify the seller
      notifications.push({
        userId: auction.seller_id,
        type: 'auction.ending_soon' as const,
        context: {
          gameName: auction.game_name,
          listingId: auction.id,
        },
      });

      void notifyMany(notifications);

      // Send emails to all bidders + seller
      const allRecipientIds = [...uniqueBidderIds, auction.seller_id];
      const profiles = await fetchProfiles(supabase, allRecipientIds);

      profiles.forEach((profile) => {
        if (profile.email) {
          sendAuctionEndingSoon({
            recipientName: profile.full_name,
            recipientEmail: profile.email,
            gameName: auction.game_name,
            listingId: auction.id,
          }).catch((err) => console.error('[Cron] Failed to email auction ending soon:', err));
        }
      });

      // Mark as notified to prevent duplicates
      const { error: updateError } = await supabase
        .from('listings')
        .update({ auction_ending_soon_notified_at: now.toISOString() })
        .eq('id', auction.id);

      if (updateError) {
        console.error(`[Cron] Failed to mark auction ${auction.id} as notified:`, updateError);
        errors.push(`Failed to mark ${auction.id}`);
        continue;
      }

      notified++;
    } catch (err) {
      console.error(`[Cron] Error processing auction ${auction.id}:`, err);
      errors.push(`Error on ${auction.id}`);
    }
  }

  console.log(`[Cron] Sent ending-soon notifications for ${notified} auctions`);

  return NextResponse.json({
    notified,
    hasMore: auctions.length === BATCH_LIMIT,
    errors,
  });
}
