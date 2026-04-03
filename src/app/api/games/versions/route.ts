import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { fetchBatchVersions } from '@/lib/bgg';
import { BGGError } from '@/lib/bgg/errors';
import { createServiceClient } from '@/lib/supabase';

const MAX_IDS = 20;

export async function GET(request: NextRequest) {
  const { response } = await requireAuth();
  if (response) return response;

  const idsParam = request.nextUrl.searchParams.get('ids')?.trim() ?? '';
  if (!idsParam) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
  }

  const gameIds = idsParam
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

  if (gameIds.length === 0) {
    return NextResponse.json({ error: 'No valid game IDs provided' }, { status: 400 });
  }

  if (gameIds.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_IDS} game IDs per request` },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  try {
    const versions = await fetchBatchVersions(gameIds, supabase);
    return NextResponse.json({ versions });
  } catch (err) {
    if (err instanceof BGGError) {
      const isRetryable =
        err.code === 'RATE_LIMIT' ||
        err.code === 'API_UNAVAILABLE' ||
        err.code === 'TIMEOUT';
      const status = isRetryable ? 503 : 502;
      const headers: HeadersInit = {};
      if (err.retryAfter) {
        headers['Retry-After'] = String(err.retryAfter);
      }
      return NextResponse.json(
        { error: err.userMessage, versions: {} },
        { status, headers }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch game versions', versions: {} },
      { status: 500 }
    );
  }
}
