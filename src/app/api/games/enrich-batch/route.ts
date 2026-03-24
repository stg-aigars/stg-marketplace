import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchGameThumbnails } from '@/lib/bgg/api';

const MAX_BATCH_SIZE = 20;

/**
 * POST /api/games/enrich-batch
 * Accepts up to 20 BGG game IDs. Enriches games that lack thumbnails
 * by fetching from BGG API and writing back to the games table.
 * Returns thumbnails for all requested IDs.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids: number[] = body?.ids;

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Provide 1-${MAX_BATCH_SIZE} game IDs` },
      { status: 400 }
    );
  }

  // Validate all IDs are positive integers
  const validIds = ids.filter((id) => Number.isInteger(id) && id > 0);
  if (validIds.length === 0) {
    return NextResponse.json({ error: 'No valid game IDs' }, { status: 400 });
  }

  // Find games missing thumbnails
  const { data: games } = await supabase
    .from('games')
    .select('id, thumbnail, image')
    .in('id', validIds);

  if (!games) {
    return NextResponse.json({ error: 'Failed to query games' }, { status: 500 });
  }

  const missingIds = games
    .filter((g) => !g.thumbnail)
    .map((g) => g.id);

  // Fetch thumbnails from BGG for missing ones
  if (missingIds.length > 0) {
    try {
      const thumbnails = await fetchGameThumbnails(missingIds);

      // Write back to games table (following ensureGameMetadata pattern)
      const entries = Array.from(thumbnails.entries());
      for (const [gameId, data] of entries) {
        await supabase
          .from('games')
          .update({
            thumbnail: data.thumbnail ?? null,
            image: data.image ?? null,
          })
          .eq('id', gameId);
      }

      // Merge fetched data into response
      for (const game of games) {
        if (!game.thumbnail && thumbnails.has(game.id)) {
          const fetched = thumbnails.get(game.id);
          game.thumbnail = fetched?.thumbnail ?? null;
          game.image = fetched?.image ?? null;
        }
      }
    } catch {
      // Non-fatal: return whatever we have
      console.error('[enrich-batch] BGG fetch failed for some games');
    }
  }

  // Build response map
  const result: Record<number, { thumbnail: string | null; image: string | null }> = {};
  for (const game of games) {
    result[game.id] = {
      thumbnail: game.thumbnail,
      image: game.image,
    };
  }

  return NextResponse.json({ games: result });
}
