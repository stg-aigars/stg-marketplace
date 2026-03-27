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

  const supabase = await createClient();

  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, yearpublished, thumbnail, player_count')
    .ilike('name', `%${q}%`)
    .eq('is_expansion', false)
    .order('bayesaverage', { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: 'Failed to search games' }, { status: 500 });
  }

  return NextResponse.json({ games });
}
