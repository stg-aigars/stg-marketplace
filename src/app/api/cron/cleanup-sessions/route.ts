import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour — generous, covers slow payments

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const cutoff = new Date(Date.now() - SESSION_TTL_MS).toISOString();

  // Skip sessions with a payment reference — those are handled by reconcile-payments cron
  const { data, error } = await serviceClient
    .from('checkout_sessions')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .is('everypay_payment_reference', null)
    .select('id');

  if (error) {
    console.error('[Cron] Failed to clean up sessions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(`[Cron] Expired ${count} orphan checkout sessions`);
  }

  // Also expire old cart checkout groups (skip those with payment references)
  const { data: cartData, error: cartError } = await serviceClient
    .from('cart_checkout_groups')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .is('everypay_payment_reference', null)
    .select('id, listing_ids, buyer_id');

  let cartCount = 0;
  if (cartError) {
    console.error('[Cron] Failed to clean up cart groups:', cartError);
  } else if (cartData && cartData.length > 0) {
    cartCount = cartData.length;
    console.log(`[Cron] Expired ${cartCount} orphan cart checkout groups`);

    // Unreserve listings from expired cart groups (parallel — independent operations)
    await Promise.all(
      cartData.map((group) =>
        serviceClient.rpc('unreserve_listings', {
          p_listing_ids: group.listing_ids,
          p_buyer_id: group.buyer_id,
        })
      )
    );
  }

  return NextResponse.json({ expired: count, cartExpired: cartCount });
}
