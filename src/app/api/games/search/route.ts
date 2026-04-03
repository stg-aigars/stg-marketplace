import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { gameSearchLimiter, applyRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const rateLimitError = applyRateLimit(gameSearchLimiter, request);
  if (rateLimitError) return rateLimitError;

  const q = (request.nextUrl.searchParams.get('q')?.trim() ?? '').slice(0, 100);

  if (q.length < 2) {
    return NextResponse.json({ games: [] });
  }

  const includeExpansions = request.nextUrl.searchParams.get('includeExpansions') === 'true';

  const supabase = await createClient();

  let query = supabase
    .from('games')
    .select('id, name, yearpublished, thumbnail, player_count, is_expansion')
    .ilike('name', `%${q}%`);

  if (!includeExpansions) {
    query = query.eq('is_expansion', false);
  }

  const { data: games, error } = await query
    .order('is_expansion', { ascending: true })
    .order('bayesaverage', { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: 'Failed to search games' }, { status: 500 });
  }

  return NextResponse.json({ games });
}
