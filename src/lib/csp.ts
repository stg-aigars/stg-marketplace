/**
 * Content Security Policy (CSP) with per-request nonce.
 *
 * Uses CSP Level 3 "strict-dynamic" pattern:
 * - Modern browsers: nonce + strict-dynamic (ignores 'unsafe-inline' and 'self')
 * - Older browsers: fall back to 'unsafe-inline' + 'self'
 */

const NONCE_PLACEHOLDER = '__NONCE__';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const isDev = process.env.NODE_ENV === 'development';

const scriptSrc = [
  "'self'",
  `'nonce-${NONCE_PLACEHOLDER}'`,
  "'strict-dynamic'",
  "'unsafe-inline'",
  isDev ? "'unsafe-eval'" : '',
]
  .filter(Boolean)
  .join(' ');

const CSP_TEMPLATE = [
  'upgrade-insecure-requests',
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' ${SUPABASE_URL} https://cf.geekdo-images.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://*.every-pay.com https://*.every-pay.eu data: blob:`,
  "font-src 'self'",
  `connect-src 'self' ${SUPABASE_URL} https://*.everypay.co https://*.unisend.com https://*.sentry.io https://challenges.cloudflare.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com`,
  "frame-src 'self' https://*.everypay.co https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
].join('; ');

export function buildCspHeader(nonce: string): string {
  return CSP_TEMPLATE.replace(NONCE_PLACEHOLDER, nonce);
}
