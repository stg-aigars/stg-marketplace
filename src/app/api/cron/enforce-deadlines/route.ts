import { NextResponse } from 'next/server';
import { enforceOrderDeadlines } from '@/lib/services/order-deadlines';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await enforceOrderDeadlines();

  const total =
    result.pendingSellerAutoDeclined +
    result.pendingSellerReminders +
    result.shippingAutoCancelled +
    result.shippingReminders +
    result.deliveryReminders +
    result.deliveryEscalations;

  if (total > 0 || result.errors.length > 0) {
    console.log('[Cron] Deadline enforcement:', result);
  }

  return NextResponse.json(result);
}
