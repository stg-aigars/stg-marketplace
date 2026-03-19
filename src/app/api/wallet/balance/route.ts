import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getWalletBalance } from '@/lib/services/wallet';

export async function GET() {
  const { response, user } = await requireAuth();
  if (response) return response;

  const balanceCents = await getWalletBalance(user.id);

  return NextResponse.json({ balanceCents });
}
