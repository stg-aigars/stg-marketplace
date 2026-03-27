import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/cart/validate
 * Checks which listings in the given array are still active.
 */
export async function POST(request: Request) {
  let listingIds: string[];
  try {
    const body = await request.json();
    listingIds = body.listingIds;
    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ available: [], unavailable: [] });
    }
    if (listingIds.length > 20) {
      return NextResponse.json({ error: 'Too many items' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: activeListings } = await supabase
    .from('listings')
    .select('id')
    .in('id', listingIds)
    .eq('status', 'active');

  const activeIds = new Set((activeListings ?? []).map((l) => l.id));
  const available = listingIds.filter((id) => activeIds.has(id));
  const unavailable = listingIds.filter((id) => !activeIds.has(id));

  return NextResponse.json({ available, unavailable });
}
