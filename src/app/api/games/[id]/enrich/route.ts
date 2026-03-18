import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { createServiceClient } from '@/lib/supabase';
import { ensureGameMetadata } from '@/lib/bgg';
import { BGGError } from '@/lib/bgg/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const gameId = parseInt(id, 10);

  if (isNaN(gameId) || gameId <= 0) {
    return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Verify the game exists in our database before hitting BGG
  const { data: existing, error: lookupError } = await serviceClient
    .from('games')
    .select('id')
    .eq('id', gameId)
    .single();

  if (lookupError || !existing) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  try {
    await ensureGameMetadata(gameId, serviceClient);
  } catch (err) {
    if (err instanceof BGGError) {
      const isRetryable = err.code === 'RATE_LIMIT' || err.code === 'API_UNAVAILABLE' || err.code === 'TIMEOUT';
      const status = isRetryable ? 503 : 502;
      const headers: HeadersInit = {};
      if (err.retryAfter) {
        headers['Retry-After'] = String(err.retryAfter);
      }
      return NextResponse.json(
        { error: err.userMessage },
        { status, headers }
      );
    }
    return NextResponse.json(
      { error: 'Failed to enrich game metadata' },
      { status: 500 }
    );
  }

  const { data: game, error } = await serviceClient
    .from('games')
    .select('id, name, yearpublished, thumbnail, image, player_count, description, designers')
    .eq('id', gameId)
    .single();

  if (error || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  return NextResponse.json({ game });
}
