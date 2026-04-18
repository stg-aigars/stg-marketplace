import { NextRequest, NextResponse } from 'next/server';

// PostHog reverse proxy. Replaces a next.config `rewrites()` entry because
// external rewrites in Next 16 / Turbopack do not reliably forward gzipped
// POST bodies — PostHog returns 200 to the browser but the ingest pipeline
// drops the event. This handler forwards the request body and query string
// intact, streams the response back, and keeps the ad-blocker avoidance
// property (client still posts to `/ingest/...` same-origin).

const INGEST_HOST = 'https://eu.i.posthog.com';
const STATIC_HOST = 'https://eu-assets.i.posthog.com';

// Headers that should not be forwarded to PostHog or streamed back to the
// browser. `host` would break the TLS handshake; hop-by-hop and encoding
// headers are managed by fetch. The client-IP headers are stripped so
// PostHog never sees real user IPs through this proxy — the "cookieless"
// privacy posture in the Privacy Policy is load-bearing on this.
const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'cookie',
  'x-forwarded-for',
  'x-real-ip',
  'forwarded',
  'cf-connecting-ip',
  'true-client-ip',
]);

const STRIP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
]);

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const segments = path.join('/');
  const baseHost = path[0] === 'static' ? STATIC_HOST : INGEST_HOST;

  const incoming = new URL(request.url);
  const targetUrl = `${baseHost}/${segments}${incoming.search}`;

  const forwardedHeaders = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) {
      forwardedHeaders.set(key, value);
    }
  });

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: forwardedHeaders,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const OPTIONS = proxy;
