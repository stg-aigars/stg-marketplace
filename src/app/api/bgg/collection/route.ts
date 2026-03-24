import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchBGGCollection } from '@/lib/bgg/collection';

/**
 * GET /api/bgg/collection?username=xxx
 * Fetches a BGG user's collection, matches against local games table,
 * and flags items already on the seller's shelf.
 *
 * Returns { status: 'generating' } when BGG needs time to prepare
 * the collection — client should poll every 3s, up to 5 retries.
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

  // Fetch from BGG
  const result = await fetchBGGCollection(username);

  if (result.status === 'generating') {
    return NextResponse.json({ status: 'generating' });
  }

  if (result.status === 'error') {
    return NextResponse.json({ error: result.message }, { status: 502 });
  }

  // Filter out expansions
  const baseGames = result.items.filter((item) => !item.isExpansion);
  if (!baseGames.length) {
    return NextResponse.json({ status: 'success', items: [] });
  }

  // Match against local games table
  const bggIds = baseGames.map((g) => g.bggGameId);

  const { data: localGames } = await supabase
    .from('games')
    .select('id')
    .in('id', bggIds);

  const localGameIds = new Set(localGames?.map((g) => g.id) ?? []);

  // Check which are already on the seller's shelf
  const { data: existingShelf } = await supabase
    .from('shelf_items')
    .select('bgg_game_id')
    .eq('seller_id', user.id);

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
