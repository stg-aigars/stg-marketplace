import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/filters/options
 *
 * Returns distinct categories and mechanics that have at least one active listing.
 * Cached for 5 minutes to avoid repeated DB hits.
 */
export async function GET() {
  const supabase = await createClient();

  // Get distinct bgg_game_ids that have active listings
  const { data: activeGameIds } = await supabase
    .from('listings')
    .select('bgg_game_id')
    .eq('status', 'active');

  if (!activeGameIds || activeGameIds.length === 0) {
    return NextResponse.json(
      { categories: [], mechanics: [] },
      { headers: { 'Cache-Control': 'public, max-age=300' } }
    );
  }

  const uniqueGameIds = Array.from(new Set(activeGameIds.map((r) => r.bgg_game_id)));

  // Fetch categories and mechanics for those games
  const { data: games } = await supabase
    .from('games')
    .select('categories, mechanics')
    .in('id', uniqueGameIds)
    .not('categories', 'is', null);

  const categorySet = new Set<string>();
  const mechanicSet = new Set<string>();

  for (const game of games ?? []) {
    if (Array.isArray(game.categories)) {
      for (const cat of game.categories) categorySet.add(cat);
    }
    if (Array.isArray(game.mechanics)) {
      for (const mech of game.mechanics) mechanicSet.add(mech);
    }
  }

  const categories = Array.from(categorySet).sort();
  const mechanics = Array.from(mechanicSet).sort();

  return NextResponse.json(
    { categories, mechanics },
    { headers: { 'Cache-Control': 'public, max-age=300' } }
  );
}
