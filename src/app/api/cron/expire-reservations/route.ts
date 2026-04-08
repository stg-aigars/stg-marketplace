import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { RESERVATION_TTL_MS } from '@/lib/listings/constants';

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const cutoff = new Date(Date.now() - RESERVATION_TTL_MS).toISOString();

  // Use the atomic DB function to revert expired reservations
  // that have no active order (prevents reverting listings with pending_seller+ orders)
  const { data: expiredIds, error } = await serviceClient
    .rpc('expire_stale_reservations', { cutoff });

  if (error) {
    console.error('[Cron] Failed to expire reservations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = expiredIds?.length ?? 0;
  if (count > 0) {
    console.log(`[Cron] Expired ${count} stale reservations`);
  }

  return NextResponse.json({ expired: count });
}
