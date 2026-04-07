import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { UnavailableItem } from '@/lib/checkout/cart-types';

/**
 * POST /api/cart/validate
 * Checks which listings in the given array are still active,
 * and returns enriched unavailability reasons for non-active ones.
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

  const { data: listings } = await supabase
    .from('listings')
    .select('id, status')
    .in('id', listingIds);

  const statusMap = new Map<string, string>();
  for (const l of listings ?? []) {
    statusMap.set(l.id, l.status);
  }

  const available: string[] = [];
  const unavailable: UnavailableItem[] = [];

  for (const id of listingIds) {
    const status = statusMap.get(id);
    if (status === 'active') {
      available.push(id);
    } else if (status === 'reserved') {
      unavailable.push({ id, reason: 'reserved' });
    } else if (status === 'sold') {
      unavailable.push({ id, reason: 'sold' });
    } else {
      // Not found in DB or any other status (draft, cancelled, etc.)
      unavailable.push({ id, reason: 'cancelled' });
    }
  }

  return NextResponse.json({ available, unavailable });
}
