import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';

const RETENTION_DAYS = 90;

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await serviceClient
    .from('notifications')
    .delete()
    .lt('created_at', cutoff)
    .select('id');

  if (error) {
    console.error('[Cron] Failed to clean up notifications:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(`[Cron] Deleted ${count} notifications older than ${RETENTION_DAYS} days`);
  }

  return NextResponse.json({ deleted: count });
}
