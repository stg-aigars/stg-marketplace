import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { fetchGameMetadata } from '@/lib/bgg';
import { BGGError } from '@/lib/bgg/errors';
import { decodeHTMLEntities } from '@/lib/bgg/utils';
import { createServiceClient } from '@/lib/supabase';

export interface GameExpansion {
  id: number;
  name: string;
  year?: number;
  thumbnail?: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const gameId = parseInt(id, 10);

  if (isNaN(gameId) || gameId <= 0) {
    return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    const metadata = await fetchGameMetadata(gameId);
    if (!metadata) {
      return NextResponse.json({ expansions: [] });
    }

    // Extract outbound expansion links
    const expansionLinks = metadata.outboundLinks.filter(
      (link) => link.type === 'boardgameexpansion'
    );

    if (expansionLinks.length === 0) {
      return NextResponse.json({ expansions: [] });
    }

    // Upsert missing expansions into games table as lightweight stubs
    const expansionIds = expansionLinks.map((l) => parseInt(l.id));
    const { data: existingGames } = await supabase
      .from('games')
      .select('id, thumbnail, yearpublished')
      .in('id', expansionIds);

    const existingIds = new Set((existingGames ?? []).map((g) => g.id));
    const missingExpansions = expansionLinks.filter(
      (l) => !existingIds.has(parseInt(l.id))
    );

    if (missingExpansions.length > 0) {
      const stubs = missingExpansions.map((l) => ({
        id: parseInt(l.id),
        name: decodeHTMLEntities(l.value),
        is_expansion: true,
      }));

      // Batch upsert with ON CONFLICT DO NOTHING for concurrent safety
      await supabase
        .from('games')
        .upsert(stubs, { onConflict: 'id', ignoreDuplicates: true });
    }

    // Build response with decoded names + DB metadata (thumbnail, year)
    const dbLookup = new Map(
      (existingGames ?? []).map((g) => [g.id, g])
    );

    const expansions: GameExpansion[] = expansionLinks.map((link) => {
      const id = parseInt(link.id);
      const dbGame = dbLookup.get(id);
      return {
        id,
        name: decodeHTMLEntities(link.value),
        year: dbGame?.yearpublished ?? undefined,
        thumbnail: dbGame?.thumbnail ?? null,
      };
    });

    // Sort alphabetically for consistent UI
    expansions.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ expansions });
  } catch (err) {
    if (err instanceof BGGError) {
      const isRetryable =
        err.code === 'RATE_LIMIT' ||
        err.code === 'API_UNAVAILABLE' ||
        err.code === 'TIMEOUT';
      const status = isRetryable ? 503 : 502;
      const headers: HeadersInit = {};
      if (err.retryAfter) {
        headers['Retry-After'] = String(err.retryAfter);
      }
      return NextResponse.json(
        { error: err.userMessage, expansions: [] },
        { status, headers }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch expansions', expansions: [] },
      { status: 500 }
    );
  }
}
