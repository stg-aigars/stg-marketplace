import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getGameVersions } from '@/lib/bgg';

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

  const versions = await getGameVersions(gameId);

  return NextResponse.json({ versions });
}
