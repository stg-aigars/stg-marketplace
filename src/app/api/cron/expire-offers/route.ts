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
  sendWantedOfferExpiredToSeller,
} from '@/lib/email';
import { notify } from '@/lib/notifications';

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
      const ids = expiredOffers.map((o) => o.id);
      const { error: updateError } = await supabase
        .from('offers')
        .update({ status: 'expired' })
        .in('id', ids);

      if (updateError) {
        console.error('[Cron] TTL update failed:', updateError);
        errors.push('TTL update failed');
      }

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

        if (shelfItem?.game_name) {
          void notify(offer.buyer_id, 'offer.expired', {
            gameName: shelfItem.game_name,
          });
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
      const { error: updateError } = await supabase
        .from('offers')
        .update({ status: 'expired' })
        .in('id', ids);

      if (updateError) {
        console.error('[Cron] Deadline update failed:', updateError);
        errors.push('Deadline update failed');
      }

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

        if (shelfItem?.game_name) {
          void notify(offer.buyer_id, 'offer.deadline_expired', {
            gameName: shelfItem.game_name,
            sellerName: (offer.seller as unknown as { full_name: string } | null)?.full_name ?? 'Seller',
          });
        }
      }
    }
  }

  // ---- Job 3: Expire unanswered wanted offers (7-day TTL) ----
  let wantedExpiredCount = 0;
  {
    const { data: expiredWantedOffers, error: queryError } = await supabase
      .from('wanted_offers')
      .select(`
        id, seller_id, status,
        wanted_listings:wanted_listing_id (game_name),
        seller:seller_id (full_name, email)
      `)
      .in('status', ['pending', 'countered'])
      .lt('expires_at', new Date().toISOString())
      .limit(BATCH_LIMIT);

    if (queryError) {
      console.error('[Cron] Expire wanted offers query failed:', queryError);
      errors.push('Wanted TTL query failed');
    } else if (expiredWantedOffers?.length) {
      const ids = expiredWantedOffers.map((o) => o.id);
      const { error: updateError } = await supabase
        .from('wanted_offers')
        .update({ status: 'expired' })
        .in('id', ids);

      if (updateError) {
        console.error('[Cron] Wanted TTL update failed:', updateError);
        errors.push('Wanted TTL update failed');
      }

      wantedExpiredCount = ids.length;
      console.log(`[Cron] Expired ${wantedExpiredCount} wanted offers (${OFFER_TTL_DAYS}-day TTL)`);

      for (const offer of expiredWantedOffers) {
        const wantedListing = offer.wanted_listings as unknown as { game_name: string } | null;
        const seller = offer.seller as unknown as { full_name: string; email: string } | null;

        if (seller?.email && wantedListing?.game_name) {
          sendWantedOfferExpiredToSeller({
            sellerName: seller.full_name,
            sellerEmail: seller.email,
            gameName: wantedListing.game_name,
          }).catch((err) => console.error('[Cron] Failed to email wanted offer expired:', err));
        }

        if (wantedListing?.game_name) {
          void notify(offer.seller_id, 'wanted.offer_expired', {
            gameName: wantedListing.game_name,
          });
        }
      }
    }
  }

  // ---- Job 4: Revert accepted wanted offers past listing deadline ----
  let wantedDeadlineCount = 0;
  {
    const deadlineCutoff = new Date();
    deadlineCutoff.setDate(deadlineCutoff.getDate() - LISTING_DEADLINE_DAYS);

    const { data: deadlineWantedOffers, error: queryError } = await supabase
      .from('wanted_offers')
      .select(`
        id, buyer_id, seller_id, wanted_listing_id,
        wanted_listings:wanted_listing_id (game_name),
        seller:seller_id (full_name)
      `)
      .eq('status', 'accepted')
      .lt('updated_at', deadlineCutoff.toISOString())
      .limit(BATCH_LIMIT);

    if (queryError) {
      console.error('[Cron] Wanted deadline query failed:', queryError);
      errors.push('Wanted deadline query failed');
    } else if (deadlineWantedOffers?.length) {
      const ids = deadlineWantedOffers.map((o) => o.id);
      const { error: updateError } = await supabase
        .from('wanted_offers')
        .update({ status: 'expired' })
        .in('id', ids);

      if (updateError) {
        console.error('[Cron] Wanted deadline update failed:', updateError);
        errors.push('Wanted deadline update failed');
      }

      // Re-activate the wanted listings (seller didn't follow through)
      const wantedListingIds = Array.from(new Set(deadlineWantedOffers.map((o) => o.wanted_listing_id)));
      await supabase
        .from('wanted_listings')
        .update({ status: 'active' })
        .in('id', wantedListingIds)
        .eq('status', 'filled'); // Only revert if currently filled (not manually cancelled)

      wantedDeadlineCount = ids.length;
      console.log(`[Cron] Expired ${wantedDeadlineCount} wanted offers (${LISTING_DEADLINE_DAYS}-day listing deadline)`);

      for (const offer of deadlineWantedOffers) {
        const wantedListing = offer.wanted_listings as unknown as { game_name: string } | null;
        const seller = offer.seller as unknown as { full_name: string } | null;

        if (wantedListing?.game_name) {
          void notify(offer.buyer_id, 'wanted.offer_expired', {
            gameName: wantedListing.game_name,
            sellerName: seller?.full_name ?? 'Seller',
          });
        }
      }
    }
  }

  return NextResponse.json({
    expired: expiredCount,
    deadlineExpired: deadlineCount,
    wantedExpired: wantedExpiredCount,
    wantedDeadlineExpired: wantedDeadlineCount,
    hasMore: expiredCount === BATCH_LIMIT || deadlineCount === BATCH_LIMIT
      || wantedExpiredCount === BATCH_LIMIT || wantedDeadlineCount === BATCH_LIMIT,
    errors,
  });
}
