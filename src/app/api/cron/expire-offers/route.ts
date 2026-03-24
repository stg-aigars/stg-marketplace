/**
 * Offer expiry cron endpoint.
 * Two jobs in one route:
 * 1. Expire unanswered offers past 7-day TTL
 * 2. Revert accepted offers where seller didn't create listing within 3 days
 *
 * Called every 6 hours from Coolify cron:
 *   curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/expire-offers
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { OFFER_TTL_DAYS, LISTING_DEADLINE_DAYS } from '@/lib/shelves/types';
import {
  sendOfferExpiredToBuyer,
  sendOfferDeadlineExpiredToBuyer,
} from '@/lib/email';

const BATCH_LIMIT = 100;

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  let expiredCount = 0;
  let deadlineCount = 0;
  const errors: string[] = [];

  // ---- Job 1: Expire unanswered offers (7-day TTL) ----
  {
    const { data: expiredOffers, error: queryError } = await supabase
      .from('offers')
      .select(`
        id, buyer_id, status,
        shelf_items:shelf_item_id (game_name),
        buyer:buyer_id (full_name, email)
      `)
      .in('status', ['pending', 'countered'])
      .lt('expires_at', new Date().toISOString())
      .limit(BATCH_LIMIT);

    if (queryError) {
      console.error('[Cron] Expire offers query failed:', queryError);
      errors.push('TTL query failed');
    } else if (expiredOffers?.length) {
      // Batch update status
      const ids = expiredOffers.map((o) => o.id);
      await supabase
        .from('offers')
        .update({ status: 'expired' })
        .in('id', ids);

      expiredCount = ids.length;
      console.log(`[Cron] Expired ${expiredCount} offers (${OFFER_TTL_DAYS}-day TTL)`);

      // Email buyers (non-blocking)
      for (const offer of expiredOffers) {
        const buyer = offer.buyer as unknown as { full_name: string; email: string } | null;
        const shelfItem = offer.shelf_items as unknown as { game_name: string } | null;

        if (buyer?.email && shelfItem?.game_name) {
          sendOfferExpiredToBuyer({
            buyerName: buyer.full_name,
            buyerEmail: buyer.email,
            gameName: shelfItem.game_name,
          }).catch((err) => console.error('[Cron] Failed to email expired offer:', err));
        }
      }
    }
  }

  // ---- Job 2: Revert accepted offers past listing deadline ----
  {
    const deadlineCutoff = new Date();
    deadlineCutoff.setDate(deadlineCutoff.getDate() - LISTING_DEADLINE_DAYS);

    const { data: deadlineOffers, error: queryError } = await supabase
      .from('offers')
      .select(`
        id, buyer_id, seller_id,
        shelf_items:shelf_item_id (game_name),
        buyer:buyer_id (full_name, email),
        seller:seller_id (full_name)
      `)
      .eq('status', 'accepted')
      .lt('updated_at', deadlineCutoff.toISOString())
      .limit(BATCH_LIMIT);

    if (queryError) {
      console.error('[Cron] Deadline offers query failed:', queryError);
      errors.push('Deadline query failed');
    } else if (deadlineOffers?.length) {
      const ids = deadlineOffers.map((o) => o.id);
      await supabase
        .from('offers')
        .update({ status: 'expired' })
        .in('id', ids);

      deadlineCount = ids.length;
      console.log(`[Cron] Expired ${deadlineCount} offers (${LISTING_DEADLINE_DAYS}-day listing deadline)`);

      // Email buyers (non-blocking)
      for (const offer of deadlineOffers) {
        const buyer = offer.buyer as unknown as { full_name: string; email: string } | null;
        const seller = offer.seller as unknown as { full_name: string } | null;
        const shelfItem = offer.shelf_items as unknown as { game_name: string } | null;

        if (buyer?.email && seller?.full_name && shelfItem?.game_name) {
          sendOfferDeadlineExpiredToBuyer({
            buyerName: buyer.full_name,
            buyerEmail: buyer.email,
            sellerName: seller.full_name,
            gameName: shelfItem.game_name,
          }).catch((err) => console.error('[Cron] Failed to email deadline offer:', err));
        }
      }
    }
  }

  return NextResponse.json({
    expired: expiredCount,
    deadlineExpired: deadlineCount,
    errors,
  });
}
