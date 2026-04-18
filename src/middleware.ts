import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/middleware';
import { buildCspHeader } from '@/lib/csp';
import { isOAuthUser } from '@/lib/auth/oauth-providers';

const intlMiddleware = createIntlMiddleware(routing);

// Routes that require authentication
const PROTECTED_PREFIXES = ['/account', '/sell', '/orders', '/checkout', '/staff'];

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

function setCspHeader(response: NextResponse, csp: string): void {
  response.headers.set('Content-Security-Policy', csp);
}

export default async function middleware(request: NextRequest) {
  // 0. Generate per-request nonce for CSP
  const nonce = crypto.randomUUID();
  const csp = buildCspHeader(nonce);

  // Propagate nonce via request header — available to Server Components via headers()
  // if inline <Script nonce={...}> components are added in the future
  request.headers.set('x-nonce', nonce);

  // 1. Refresh Supabase session (reads/writes cookies on request)
  const { supabase, response: supabaseResponse } = createClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = stripLocalePrefix(request.nextUrl.pathname);

  // 2. Redirect authenticated users away from signin/signup
  if (user && (pathname === '/auth/signin' || pathname === '/auth/signup')) {
    const homeUrl = new URL('/', request.url);
    const redirect = copySupabaseCookies(supabaseResponse, NextResponse.redirect(homeUrl));
    setCspHeader(redirect, csp);
    return redirect;
  }

  // 3. Skip remaining protection for auth routes
  if (!pathname.startsWith(AUTH_PREFIX)) {
    // 3. Redirect unauthenticated users from protected routes
    if (!user && PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))) {
      const signinUrl = new URL('/auth/signin', request.url);
      signinUrl.searchParams.set('returnUrl', request.nextUrl.pathname);
      const redirect = copySupabaseCookies(supabaseResponse, NextResponse.redirect(signinUrl));
      setCspHeader(redirect, csp);
      return redirect;
    }

    // 4. Redirect OAuth users who haven't confirmed their country
    if (user) {
      if (isOAuthUser(user.app_metadata)) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('country_confirmed')
          .eq('id', user.id)
          .single();

        if (profile && !profile.country_confirmed) {
          const completeProfileUrl = new URL('/auth/complete-profile', request.url);
          completeProfileUrl.searchParams.set('returnUrl', request.nextUrl.pathname);
          const redirect = copySupabaseCookies(supabaseResponse, NextResponse.redirect(completeProfileUrl));
          setCspHeader(redirect, csp);
          return redirect;
        }
      }
    }
  }

  // 5. Run next-intl locale routing
  const intlResponse = intlMiddleware(request);

  // 6. Copy Supabase auth cookies onto the intl response
  copySupabaseCookies(supabaseResponse, intlResponse);

  // 7. Set CSP header with per-request nonce
  setCspHeader(intlResponse, csp);

  return intlResponse;
}

// /ingest/ is excluded because it's the PostHog reverse-proxy Route Handler
// (src/app/ingest/[...path]/route.ts). Removing it from this negative lookahead
// would run intl middleware and CSP nonce injection on analytics traffic,
// breaking the proxy and throwing locale redirects into the capture pipeline.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|ingest/|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
