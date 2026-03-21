import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { isValidPhoneNumber } from '@/lib/phone-utils';
import { createServiceClient } from '@/lib/supabase';
import { profileUpdateLimiter, applyRateLimit } from '@/lib/rate-limit';

export async function PATCH(request: Request) {
  const rateLimitError = applyRateLimit(profileUpdateLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

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
