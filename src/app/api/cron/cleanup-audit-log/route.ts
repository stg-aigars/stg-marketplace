import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';

// Operational events get 30-day retention. Regulatory events (compliance,
// financial, legal — see audit.ts RetentionClass + CLAUDE.md "Audit Events"
// register) are excluded from this cleanup and live for 10 years per their
// originating obligations (DAC7 Art. 25 of Directive 2011/16/EU, OSS Art. 369k
// of Directive 2006/112/EC, accountant retention under PVN likums Art. 133 +
// Grāmatvedības likums §10).
const RETENTION_DAYS = 30;

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await serviceClient
    .from('audit_log')
    .delete()
    .eq('retention_class', 'operational')
    .lt('created_at', cutoff)
    .select('id');

  if (error) {
    console.error('[Cron] Failed to clean up audit log:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(`[Cron] Deleted ${count} operational audit log entries older than ${RETENTION_DAYS} days`);
  }

  return NextResponse.json({ deleted: count });
}
