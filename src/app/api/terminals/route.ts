import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getTerminals } from '@/lib/services/unisend/client';
import { isTerminalCountry } from '@/lib/services/unisend/types';

export async function GET(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country')?.toUpperCase();

  if (!country || !isTerminalCountry(country)) {
    return NextResponse.json(
      { error: 'Valid country parameter required (LV, LT, EE)' },
      { status: 400 }
    );
  }

  try {
    const terminals = await getTerminals(country);

    // Sort by city then name for consistent display
    terminals.sort((a, b) => {
      const cityCompare = a.city.localeCompare(b.city);
      return cityCompare !== 0 ? cityCompare : a.name.localeCompare(b.name);
    });

    return NextResponse.json({ terminals });
  } catch (error) {
    console.error('[Terminals] Failed to fetch:', error);
    return NextResponse.json(
      { error: 'Failed to load terminals. Please try again.' },
      { status: 500 }
    );
  }
}
