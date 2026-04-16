/**
 * Tracking sync cron endpoint.
 * Polls Unisend for tracking events on active orders and auto-transitions
 * shipped orders to delivered when PARCEL_DELIVERED is detected.
 *
 * Authenticated via Bearer token (matches other cron routes).
 * Called every 15 minutes from Coolify cron:
 *   curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/sync-tracking
 */

import { NextResponse } from 'next/server';
import { syncAllActiveOrders } from '@/lib/services/unisend/tracking-service';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await syncAllActiveOrders();

  console.log(
    `[Cron] Tracking sync: ${result.totalProcessed} processed, ` +
    `${result.successCount} ok, ${result.errorCount} errors, ` +
    `${result.newEventsTotal} events inserted, ${result.eventErrorsTotal} event errors, ` +
    `${result.statusChanges.length} transitions`
  );

  if (result.statusChanges.length > 0) {
    console.log(
      '[Cron] Status changes:',
      result.statusChanges.map((c) => `${c.orderNumber}: ${c.oldStatus} → ${c.newStatus}`)
    );
  }

  return NextResponse.json({
    processed: result.totalProcessed,
    success: result.successCount,
    errors: result.errorCount,
    eventsInserted: result.newEventsTotal,
    eventErrors: result.eventErrorsTotal,
    statusChanges: result.statusChanges.length,
  });
}
