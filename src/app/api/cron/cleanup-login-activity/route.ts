import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';

// 30-day retention for the security log per the privacy-policy disclosure
// (§9 retention table) and the lawyer-cleared GDPR Art. 6(1)(f) balancing
// test (legitimate-interest fraud prevention with strict retention).
// See migration 090 header for the full legal posture.
const RETENTION_DAYS = 30;

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await serviceClient
    .from('login_activity')
    .delete()
    .lt('created_at', cutoff)
    .select('id');

  if (error) {
    console.error('[Cron] Failed to clean up login_activity:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(`[Cron] Deleted ${count} login_activity entries older than ${RETENTION_DAYS} days`);
  }

  return NextResponse.json({ deleted: count });
}
