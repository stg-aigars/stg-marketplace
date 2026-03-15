import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { isValidPhoneNumber } from '@/lib/phone-utils';
import { createServiceClient } from '@/lib/supabase';

export async function PATCH(request: Request) {
  const { response, user } = await requireAuth();
  if (response) return response;

  try {
    const body = await request.json();
    const phone = body.phone as string;

    if (!phone || !isValidPhoneNumber(phone)) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number (e.g. +37061234567)' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('user_profiles')
      .update({ phone })
      .eq('id', user.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to update phone number' }, { status: 500 });
    }

    return NextResponse.json({ success: true, phone });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
