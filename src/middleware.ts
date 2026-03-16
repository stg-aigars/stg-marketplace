import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/middleware';

const intlMiddleware = createIntlMiddleware(routing);

// Routes that require authentication
const PROTECTED_PREFIXES = ['/account', '/sell', '/orders', '/messages', '/checkout'];

// Routes that should never be blocked (prevent redirect loops)
const AUTH_PREFIX = '/auth/';

function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
    if (pathname === `/${locale}`) {
      return '/';
    }
  }
  return pathname;
}

function copySupabaseCookies(
  from: NextResponse,
  to: NextResponse
): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
  return to;
}

export default async function middleware(request: NextRequest) {
  // 1. Refresh Supabase session (reads/writes cookies on request)
  const { supabase, response: supabaseResponse } = createClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = stripLocalePrefix(request.nextUrl.pathname);

  // 2. Skip all protection for auth routes
  if (!pathname.startsWith(AUTH_PREFIX)) {
    // 3. Redirect unauthenticated users from protected routes
    if (!user && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      const signinUrl = new URL('/auth/signin', request.url);
      signinUrl.searchParams.set('returnUrl', request.nextUrl.pathname);
      return copySupabaseCookies(supabaseResponse, NextResponse.redirect(signinUrl));
    }

    // 4. Redirect OAuth users who haven't confirmed their country
    if (user) {
      const provider = user.app_metadata?.provider;
      const providers = user.app_metadata?.providers as string[] | undefined;
      const isOAuthUser =
        provider === 'google' ||
        (Array.isArray(providers) && providers.includes('google'));

      if (isOAuthUser) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('country_confirmed')
          .eq('id', user.id)
          .single();

        if (profile && !profile.country_confirmed) {
          const completeProfileUrl = new URL('/auth/complete-profile', request.url);
          return copySupabaseCookies(supabaseResponse, NextResponse.redirect(completeProfileUrl));
        }
      }
    }
  }

  // 5. Run next-intl locale routing
  const intlResponse = intlMiddleware(request);

  // 6. Copy Supabase auth cookies onto the intl response
  copySupabaseCookies(supabaseResponse, intlResponse);

  return intlResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
