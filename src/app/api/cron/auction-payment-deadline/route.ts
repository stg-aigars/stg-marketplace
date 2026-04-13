/**
 * Auction payment deadline cron endpoint.
 * Two jobs:
 * 1. Send 12h payment reminder to winners who haven't paid yet
 * 2. Cancel auctions where the winner didn't pay within 24h
 *
 * Should run every 30 minutes.
 * curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/auction-payment-deadline
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { notify } from '@/lib/notifications';
import { fetchProfiles } from '@/lib/supabase/helpers';
import {
  sendAuctionPaymentReminderToWinner,
  sendAuctionPaymentExpired,
} from '@/lib/email';

const BATCH_LIMIT = 50;

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  let remindersSent = 0;
  let expired = 0;
  const errors: string[] = [];

  // ---- Job 1: 12h payment reminder ----
  {
    const twelveHoursFromNow = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    const { data: reminderAuctions, error: queryError } = await supabase
      .from('listings')
      .select('id, game_name, highest_bidder_id, payment_deadline_at')
      .eq('status', 'auction_ended')
      .eq('auction_payment_reminder_sent', false)
      .lt('payment_deadline_at', twelveHoursFromNow)
      .gt('payment_deadline_at', new Date().toISOString())
      .limit(BATCH_LIMIT);

    if (queryError) {
      console.error('[Cron] Auction reminder query failed:', queryError);
      errors.push('Reminder query failed');
    } else if (reminderAuctions?.length) {
      for (const auction of reminderAuctions) {
        if (!auction.highest_bidder_id) continue;

        // Optimistic lock: only update if still false (prevents duplicate notifications on re-run)
        const { data: updated } = await supabase
          .from('listings')
          .update({ auction_payment_reminder_sent: true })
          .eq('id', auction.id)
          .eq('auction_payment_reminder_sent', false)
          .select('id');

        // If 0 rows affected, another run already handled this listing — skip
        if (!updated?.length) continue;

        void notify(auction.highest_bidder_id, 'auction.payment_reminder', {
          gameName: auction.game_name,
          listingId: auction.id,
        });

        // Email winner
        const profiles = await fetchProfiles(supabase, [auction.highest_bidder_id]);
        const winner = profiles.get(auction.highest_bidder_id);
        if (winner?.email) {
          sendAuctionPaymentReminderToWinner({
            winnerName: winner.full_name,
            winnerEmail: winner.email,
            gameName: auction.game_name,
            listingId: auction.id,
          }).catch((err) => console.error('[Cron] Failed to email payment reminder:', err));
        }

        remindersSent++;
      }

      console.log(`[Cron] Sent ${remindersSent} auction payment reminders`);
    }
  }

  // ---- Job 2: Payment deadline expiry ----
  {
    const { data: expiredAuctions, error: queryError } = await supabase
      .from('listings')
      .select('id, seller_id, game_name, highest_bidder_id')
      .eq('status', 'auction_ended')
      .lt('payment_deadline_at', new Date().toISOString())
      .limit(BATCH_LIMIT);

    if (queryError) {
      console.error('[Cron] Auction deadline query failed:', queryError);
      errors.push('Deadline query failed');
    } else if (expiredAuctions?.length) {
      const ids = expiredAuctions.map((a) => a.id);

      const { data: cancelledRows, error: updateError } = await supabase
        .from('listings')
        .update({ status: 'cancelled' })
        .in('id', ids)
        .eq('status', 'auction_ended')
        .select('id');

      if (updateError) {
        console.error('[Cron] Auction deadline update failed:', updateError);
        errors.push('Deadline update failed');
      }

      const cancelledIds = new Set((cancelledRows ?? []).map((r) => r.id));
      expired = cancelledIds.size;
      console.log(`[Cron] Cancelled ${expired} auctions (payment deadline expired)`);

      // Notify + email both parties (only for actually-cancelled rows)
      for (const auction of expiredAuctions) {
        if (!cancelledIds.has(auction.id)) continue;
        const profileIds = [auction.seller_id];
        if (auction.highest_bidder_id) profileIds.push(auction.highest_bidder_id);
        const profiles = await fetchProfiles(supabase, profileIds);

        if (auction.highest_bidder_id) {
          void notify(auction.highest_bidder_id, 'auction.payment_expired', {
            gameName: auction.game_name,
            listingId: auction.id,
          });

          const winner = profiles.get(auction.highest_bidder_id);
          if (winner?.email) {
            sendAuctionPaymentExpired({
              recipientName: winner.full_name,
              recipientEmail: winner.email,
              gameName: auction.game_name,
              isSeller: false,
            }).catch((err) => console.error('[Cron] Failed to email payment expired to winner:', err));
          }
        }

        void notify(auction.seller_id, 'auction.payment_expired_seller', {
          gameName: auction.game_name,
          listingId: auction.id,
        });

        const seller = profiles.get(auction.seller_id);
        if (seller?.email) {
          sendAuctionPaymentExpired({
            recipientName: seller.full_name,
            recipientEmail: seller.email,
            gameName: auction.game_name,
            isSeller: true,
          }).catch((err) => console.error('[Cron] Failed to email payment expired to seller:', err));
        }
      }
    }
  }

  return NextResponse.json({
    remindersSent,
    expired,
    errors,
  });
}
