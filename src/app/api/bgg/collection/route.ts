import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchBGGCollection } from '@/lib/bgg/collection';
import { rateLimit } from '@/lib/rate-limit';

// 1 collection fetch per user per 5 minutes (with automatic cleanup)
const collectionLimiter = rateLimit({ interval: 5 * 60 * 1000, maxRequests: 1 });

/**
 * GET /api/bgg/collection?username=xxx&poll=1
 * Fetches a BGG user's collection, matches against local games table,
 * and flags items already on the seller's shelf.
 *
 * Returns { status: 'generating' } when BGG needs time to prepare
 * the collection — client should poll every 3s, up to 5 retries (with poll=1).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const username = request.nextUrl.searchParams.get('username')?.trim();
  if (!username || username.length > 50) {
    return NextResponse.json({ error: 'Invalid BGG username' }, { status: 400 });
  }

  // Rate limit initial fetches (poll=1 bypasses for 202 retry)
  const isPolling = request.nextUrl.searchParams.get('poll') === '1';
  if (!isPolling) {
    const result = collectionLimiter.check(user.id);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Please wait a few minutes before fetching again' },
        { status: 429 }
      );
    }
  }

  // Fetch from BGG
  const bggResult = await fetchBGGCollection(username);

  if (bggResult.status === 'generating') {
    return NextResponse.json({ status: 'generating' });
  }

  if (bggResult.status === 'error') {
    return NextResponse.json({ error: bggResult.message }, { status: 502 });
  }

  // Filter out expansions
  const baseGames = bggResult.items.filter((item) => !item.isExpansion);
  if (!baseGames.length) {
    return NextResponse.json({ status: 'success', items: [] });
  }

  // Match against local games table + check shelf (parallel)
  const bggIds = baseGames.map((g) => g.bggGameId);

  const [{ data: localGames }, { data: existingShelf }] = await Promise.all([
    supabase.from('games').select('id').in('id', bggIds),
    supabase.from('shelf_items').select('bgg_game_id').eq('seller_id', user.id),
  ]);

  const localGameIds = new Set(localGames?.map((g) => g.id) ?? []);
  const onShelfIds = new Set(existingShelf?.map((s) => s.bgg_game_id) ?? []);

  const items = baseGames.map((game) => ({
    bggGameId: game.bggGameId,
    name: game.name,
    yearPublished: game.yearPublished,
    thumbnail: game.thumbnail,
    inLocalDb: localGameIds.has(game.bggGameId),
    alreadyOnShelf: onShelfIds.has(game.bggGameId),
  }));

  return NextResponse.json({ status: 'success', items });
}
