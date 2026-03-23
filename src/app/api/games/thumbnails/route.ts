import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { createServiceClient } from '@/lib/supabase';
import { fetchGameThumbnails } from '@/lib/bgg';
import { applyRateLimit, thumbnailLimiter } from '@/lib/rate-limit';

const MAX_IDS = 20;

export async function POST(request: NextRequest) {
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response } = await requireAuth();
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

  const ids = body.ids
    .filter((id: unknown): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ thumbnails: {} });
  }

  const serviceClient = createServiceClient();
  const thumbnails: Record<number, string> = {};

  const { data: cached } = await serviceClient
    .from('games')
    .select('id, thumbnail')
    .in('id', ids)
    .not('thumbnail', 'is', null);

  const cachedIds = new Set<number>();

  if (cached) {
    for (const game of cached) {
      if (game.thumbnail) {
        thumbnails[game.id] = game.thumbnail;
        cachedIds.add(game.id);
      }
    }
  }

  const missingIds = ids.filter((id) => !cachedIds.has(id));

  if (missingIds.length > 0) {
    try {
      const fetched = await fetchGameThumbnails(missingIds);

      const upsertRows: { id: number; thumbnail: string | null; image: string | null; updated_at: string }[] = [];
      const now = new Date().toISOString();

      fetched.forEach((data, id) => {
        const thumb = data.thumbnail ?? data.image;
        if (thumb) {
          thumbnails[id] = thumb;
          upsertRows.push({
            id,
            thumbnail: data.thumbnail ?? null,
            image: data.image ?? null,
            updated_at: now,
          });
        }
      });

      if (upsertRows.length > 0) {
        void serviceClient
          .from('games')
          .upsert(upsertRows, { onConflict: 'id' })
          .then(({ error }) => {
            if (error) console.error('Failed to persist thumbnails:', error);
          });
      }
    } catch (err) {
      console.error('Unexpected error fetching BGG thumbnails:', err);
    }
  }

  return NextResponse.json({ thumbnails });
}
