import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { fetchBatchMetadata } from '@/lib/bgg/api';
import type { GameMetadataUpdate } from '@/lib/bgg/api';
import { thumbnailLimiter, applyRateLimit } from '@/lib/rate-limit';

const MAX_BATCH_SIZE = 20;

/**
 * POST /api/games/enrich-batch
 * Accepts up to 20 BGG game IDs. Enriches games that lack full metadata
 * by fetching from BGG API and writing back to the games table.
 * Returns thumbnails and alternate names for all requested IDs.
 */
export async function POST(request: NextRequest) {
  const rateLimitError = applyRateLimit(thumbnailLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

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

  const { data: games } = await supabase
    .from('games')
    .select('id, name, thumbnail, image, alternate_names, metadata_fetched_at')
    .in('id', validIds);

  if (!games) {
    return NextResponse.json({ error: 'Failed to query games' }, { status: 500 });
  }

  const missingIds = games
    .filter((g) => !g.metadata_fetched_at)
    .map((g) => g.id);

  if (missingIds.length > 0) {
    try {
      const batchData = await fetchBatchMetadata(missingIds);

      const service = createServiceClient();
      const gamesById = new Map(games.map((g) => [g.id, g]));
      const upsertRows = Array.from(batchData.entries()).map(
        ([gameId, data]: [number, GameMetadataUpdate]) => ({
          id: gameId,
          name: gamesById.get(gameId)?.name ?? `Game ${gameId}`,
          thumbnail: data.thumbnail,
          image: data.image,
          alternate_names: data.alternate_names,
          description: data.description,
          player_count: data.player_count,
          min_players: data.min_players,
          max_players: data.max_players,
          min_age: data.min_age,
          playing_time: data.playing_time,
          designers: data.designers,
          bayesaverage: data.bayesaverage,
          weight: data.weight,
          categories: data.categories,
          mechanics: data.mechanics,
          versions: data.versions,
          versions_fetched_at: data.versions_fetched_at,
          metadata_fetched_at: data.metadata_fetched_at,
        })
      );

      if (upsertRows.length > 0) {
        const { error: upsertError } = await service.from('games').upsert(upsertRows, { onConflict: 'id' });
        if (upsertError) {
          console.error('[enrich-batch] Failed to save metadata:', upsertError.message);
        }
      }

      // Merge fetched data into response
      for (const game of games) {
        if (batchData.has(game.id)) {
          const fetched = batchData.get(game.id)!;
          game.thumbnail = fetched.thumbnail ?? game.thumbnail;
          game.image = fetched.image ?? game.image;
          game.alternate_names = fetched.alternate_names ?? game.alternate_names;
        }
      }
    } catch {
      // Non-fatal: return whatever we have from DB
      console.error('[enrich-batch] BGG fetch failed for some games');
    }
  }

  const result: Record<number, { thumbnail: string | null; image: string | null; alternate_names: string[] | null }> = {};
  for (const game of games) {
    result[game.id] = {
      thumbnail: game.thumbnail,
      image: game.image,
      alternate_names: game.alternate_names,
    };
  }

  return NextResponse.json({ games: result });
}
