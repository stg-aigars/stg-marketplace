import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getOrigin } from '@/lib/utils/request';
import { safeReturnUrl } from '@/lib/auth/safe-return-url';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getOrigin(request);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const returnUrl = safeReturnUrl(searchParams.get('returnUrl'));

  const supabase = await createClient();

  // OAuth PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/auth/signin?error=auth_error`
      );
    }
    return NextResponse.redirect(`${origin}${returnUrl}`);
  }

  // Email verification or password recovery
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (error) {
      return NextResponse.redirect(
        `${origin}/auth/signin?error=auth_error`
      );
    }

    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/auth/update-password`);
    }

    return NextResponse.redirect(`${origin}${returnUrl}`);
  }

  // No code or token — redirect to signin
  return NextResponse.redirect(`${origin}/auth/signin`);
}
