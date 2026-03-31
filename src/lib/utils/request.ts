const ALLOWED_HOSTS = new Set(['secondturn.games', 'www.secondturn.games']);

/**
 * Resolve the public origin from a request behind a reverse proxy.
 * Validates x-forwarded-host against an allowlist to prevent open redirects.
 */
export function getOrigin(request: Request): string {
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost && ALLOWED_HOSTS.has(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get('host');
  if (host && ALLOWED_HOSTS.has(host)) {
    return `${forwardedProto}://${host}`;
  }

  // Development fallback — only reached when no allowed host matches
  return new URL(request.url).origin;
}
