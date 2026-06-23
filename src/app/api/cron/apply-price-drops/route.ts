import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { computeDecliningPrice } from '@/lib/listings/declining-price';

/**
 * Materializes scheduled price drops for declining-price listings.
 *
 * WHERE status = 'active' (the literal value, not a looser "available"
 * predicate) is load-bearing: it's the exact same gate
 * src/lib/listings/actions.ts uses to allow price mutation at all, and the
 * same value reserve_listings_atomic flips away from on reservation. Listings
 * mid-checkout ('reserved') are never touched here, which is what keeps the
 * price a buyer sees at cart-create identical to the price re-read live at
 * EveryPay confirmation — no snapshot column needed.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const now = new Date();

  const { data: listings, error } = await serviceClient
    .from('listings')
    .select('id, price_cents, starting_price_cents, floor_price_cents, decrement_cents, drop_interval_days, schedule_start_at, next_drop_at')
    .eq('listing_type', 'declining')
    .eq('status', 'active')
    .lte('next_drop_at', now.toISOString());

  if (error) {
    console.error('[Cron] Failed to fetch declining listings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updated = 0;

  for (const listing of listings ?? []) {
    if (
      listing.starting_price_cents == null ||
      listing.floor_price_cents == null ||
      listing.decrement_cents == null ||
      listing.drop_interval_days == null ||
      listing.schedule_start_at == null
    ) {
      console.error(`[Cron] Declining listing ${listing.id} is missing schedule fields, skipping`);
      continue;
    }

    const { currentPriceCents, nextDropAt } = computeDecliningPrice({
      startingPriceCents: listing.starting_price_cents,
      floorPriceCents: listing.floor_price_cents,
      decrementCents: listing.decrement_cents,
      dropIntervalDays: listing.drop_interval_days,
      scheduleStartAt: new Date(listing.schedule_start_at),
      now,
    });

    if (currentPriceCents === listing.price_cents) continue;

    const { error: updateError } = await serviceClient
      .from('listings')
      .update({
        price_cents: currentPriceCents,
        next_drop_at: nextDropAt ? nextDropAt.toISOString() : null,
      })
      .eq('id', listing.id)
      .eq('status', 'active');

    if (updateError) {
      console.error(`[Cron] Failed to apply price drop for listing ${listing.id}:`, updateError);
      continue;
    }

    updated++;
  }

  return NextResponse.json({ updated });
}
