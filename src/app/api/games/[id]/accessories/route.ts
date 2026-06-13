import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { ensureGameAccessories } from '@/lib/bgg';
import { BGGError } from '@/lib/bgg/errors';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const gameId = parseInt(id, 10);

  if (isNaN(gameId) || gameId <= 0) {
    return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    const accessories = await ensureGameAccessories(gameId, supabase);
    return NextResponse.json({ accessories });
  } catch (err) {
    if (err instanceof BGGError) {
      const isRetryable = err.code === 'RATE_LIMIT' || err.code === 'API_UNAVAILABLE' || err.code === 'TIMEOUT';
      const status = isRetryable ? 503 : 502;
      const headers: HeadersInit = {};
      if (err.retryAfter) {
        headers['Retry-After'] = String(err.retryAfter);
      }
      return NextResponse.json(
        { error: err.userMessage, accessories: [] },
        { status, headers }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch game accessories', accessories: [] },
      { status: 500 }
    );
  }
}
