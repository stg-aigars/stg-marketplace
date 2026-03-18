import { NextResponse } from 'next/server';

/**
 * Validates that a request originated from our own browser app, not a cross-origin form.
 * Requires the X-Requested-With header on state-changing requests.
 * Browsers enforce CORS preflight on custom headers, preventing cross-origin CSRF.
 */
export function requireBrowserOrigin(request: Request): NextResponse | null {
  const xRequestedWith = request.headers.get('x-requested-with');
  if (xRequestedWith === 'XMLHttpRequest') return null;

  return NextResponse.json(
    { error: 'Missing required X-Requested-With header' },
    { status: 403 }
  );
}
