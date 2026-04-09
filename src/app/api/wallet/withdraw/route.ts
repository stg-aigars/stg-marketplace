import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { createWithdrawalRequest, InsufficientBalanceError } from '@/lib/services/wallet';
import { withdrawalLimiter, applyRateLimit } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase';

// Basic IBAN validation for Baltic countries
const IBAN_REGEX = /^(LV|LT|EE)\d{2}[A-Z0-9]{4,30}$/;

export async function POST(request: Request) {
  const rateLimitError = applyRateLimit(withdrawalLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireAuth();
  if (response) return response;

  // DAC7 gate: blocked sellers cannot withdraw
  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('dac7_status')
    .eq('id', user.id)
    .single();

  if (profile?.dac7_status === 'blocked') {
    return NextResponse.json(
      { error: 'Withdrawals are paused until you provide required tax information. Go to Settings > Tax information.' },
      { status: 403 }
    );
  }

  let amountCents: number;
  let bankAccountHolder: string;
  let bankIban: string;
  try {
    const body = await request.json();
    amountCents = body.amountCents;
    bankAccountHolder = body.bankAccountHolder?.trim();
    bankIban = body.bankIban?.trim().toUpperCase().replace(/\s/g, '');

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json({ error: 'Please enter a valid withdrawal amount' }, { status: 400 });
    }
    if (!bankAccountHolder) {
      return NextResponse.json({ error: 'Please enter the bank account holder name' }, { status: 400 });
    }
    if (!bankIban || !IBAN_REGEX.test(bankIban)) {
      return NextResponse.json({ error: 'Please enter a valid Baltic IBAN (LV, LT, or EE)' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const withdrawal = await createWithdrawalRequest(user.id, amountCents, bankAccountHolder, bankIban);
    return NextResponse.json({ withdrawal });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
    }
    console.error('[Wallet] Withdrawal request failed:', error);
    return NextResponse.json({ error: 'Failed to create withdrawal request' }, { status: 500 });
  }
}
