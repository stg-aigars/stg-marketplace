import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getTransactionHistory } from '@/lib/services/wallet';

export async function GET(request: Request) {
  const { response, user } = await requireAuth();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

  const result = await getTransactionHistory(user.id, page, limit);

  return NextResponse.json(result);
}
