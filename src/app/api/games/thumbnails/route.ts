import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';
import { fetchGameThumbnails } from '@/lib/bgg';
import { BGGError } from '@/lib/bgg/errors';
import { rateLimit, applyRateLimit } from '@/lib/rate-limit';

const thumbnailLimiter = rateLimit({ interval: 10_000, maxRequests: 5 });

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth();
  if (response) return response;

  const rateLimitError = applyRateLimit(thumbnailLimiter, request);
  if (rateLimitError) return rateLimitError;

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.ids)) {
    return NextResponse.json({ error: 'ids must be an array' }, { status: 400 });
  }

  // Validate and truncate to 20
  const ids = body.ids
    .filter((id: unknown): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
    .slice(0, 20);

  if (ids.length === 0) {
    return NextResponse.json({ thumbnails: {} });
  }

  const serviceClient = createServiceClient();
  const thumbnails: Record<number, string> = {};

  // Check DB for cached thumbnails
  const { data: cached } = await serviceClient
    .from('games')
    .select('id, thumbnail')
    .in('id', ids)
    .not('thumbnail', 'is', null);

  const missingIds: number[] = [];
  const cachedIds = new Set<number>();

  if (cached) {
    for (const game of cached) {
      if (game.thumbnail) {
        thumbnails[game.id] = game.thumbnail;
        cachedIds.add(game.id);
      }
    }
  }

  for (const id of ids) {
    if (!cachedIds.has(id)) {
      missingIds.push(id);
    }
  }

  // Fetch missing thumbnails from BGG in a single batch request
  if (missingIds.length > 0) {
    try {
      const fetched = await fetchGameThumbnails(missingIds);

      // Persist to DB and include in response
      fetched.forEach((data, id) => {
        const thumb = data.thumbnail ?? data.image;
        if (thumb) {
          thumbnails[id] = thumb;

          // Fire-and-forget — don't block response on DB write
          serviceClient
            .from('games')
            .update({
              thumbnail: data.thumbnail ?? null,
              image: data.image ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .then(({ error }) => {
              if (error) console.error(`Failed to persist thumbnail for game ${id}:`, error);
            });
        }
      });
    } catch (err) {
      // BGG failures are silent — return whatever cached thumbnails we have
      if (!(err instanceof BGGError)) {
        console.error('Unexpected error fetching BGG thumbnails:', err);
      }
    }
  }

  // Suppress unused variable warning — user is validated but only needed for auth gate
  void user;

  return NextResponse.json({ thumbnails });
}
