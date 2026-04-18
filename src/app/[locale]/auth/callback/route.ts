import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getOrigin } from '@/lib/utils/request';
import { safeReturnUrl } from '@/lib/auth/safe-return-url';
import { trackServer } from '@/lib/analytics/track-server';

// Hybrid signup detection:
// - Email path uses ?signup=true threaded through emailRedirectTo (survives the
//   email confirmation delay, which can be minutes-to-hours).
// - OAuth path uses a 30s created_at freshness check (no email gap, so tight
//   freshness is safe). Ignores ?signup=true on OAuth so clicking "Sign in with
//   Google" as a new user still counts, and clicking "Sign up with Google" as
//   an existing user does not false-fire.
async function maybeFireSignupCompleted(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: Awaited<ReturnType<typeof createClient>>,
  flow: 'oauth' | 'email_otp',
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const provider = user.app_metadata?.provider ?? 'email';
  const method: 'email' | 'google' | 'facebook' =
    provider === 'google' ? 'google' :
    provider === 'facebook' ? 'facebook' :
    'email';

  const url = new URL(request.url);
  const hasSignupParam = url.searchParams.get('signup') === 'true';
  const isFreshOauth =
    flow === 'oauth' && Date.now() - new Date(user.created_at).getTime() < 30_000;

  // Email: query param required (handles email confirmation delay).
  // OAuth: freshness check only — ignores the query param.
  const shouldFire = flow === 'oauth' ? isFreshOauth : hasSignupParam;
  if (!shouldFire) return;

  void trackServer('signup_completed', user.id, { method });
}

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
      console.error('[Auth] exchangeCodeForSession failed:', { type, message: error.message, status: error.status });
      return NextResponse.redirect(
        `${origin}/auth/signin?error=auth_error`
      );
    }
    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/auth/update-password`);
    }
    await maybeFireSignupCompleted(request, supabase, 'oauth');
    return NextResponse.redirect(`${origin}${returnUrl}`);
  }

  // Email verification or password recovery
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (error) {
      console.error('[Auth] verifyOtp failed:', { type, message: error.message, status: error.status });
      return NextResponse.redirect(
        `${origin}/auth/signin?error=auth_error`
      );
    }

    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/auth/update-password`);
    }

    await maybeFireSignupCompleted(request, supabase, 'email_otp');
    return NextResponse.redirect(`${origin}${returnUrl}`);
  }

  // No code or token — redirect to signin
  return NextResponse.redirect(`${origin}/auth/signin`);
}
