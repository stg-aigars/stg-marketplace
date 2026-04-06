import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getPendingActions } from '@/lib/services/pending-actions';

export async function GET() {
  const { response, user } = await requireAuth();
  if (response) return response;

  const actions = await getPendingActions(user.id);

  return NextResponse.json(actions, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
