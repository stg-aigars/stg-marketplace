import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  output: 'standalone',
  // Required so /ingest/decide (no trailing slash) resolves cleanly through the
  // PostHog reverse-proxy rewrite below instead of redirecting.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // PostHog reverse proxy (EU / Frankfurt). Client SDK is configured with
    // api_host: '/ingest', so all analytics traffic originates same-origin and
    // is not blocked by ad blockers. Order matters: specific routes before the
    // catch-all.
    return [
      { source: '/ingest/static/:path*', destination: 'https://eu-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/decide', destination: 'https://eu.i.posthog.com/decide' },
      { source: '/ingest/:path*', destination: 'https://eu.i.posthog.com/:path*' },
    ];
  },
  async headers() {
    return [
      {
        // Security headers for all routes
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=(), usb=(), bluetooth=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          // CSP for pages is set dynamically in middleware.ts with per-request nonce
        ],
      },
      {
        // Authenticated routes: no caching (user-specific content)
        source: '/:locale(en|lv)/(account|sell|orders|checkout|cart|staff)(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        // Public pages: allow Cloudflare edge caching, revalidate every 60s
        source: '/:locale(en|lv)/(browse|listings|sellers|wanted|privacy|terms|seller-terms|help|contact)(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
        ],
      },
      {
        // Homepage: short edge cache
        source: '/:locale(en|lv)',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
        ],
      },
      {
        // Auth pages: no caching
        source: '/:locale(en|lv)/auth(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        // Minimal CSP for API routes (middleware matcher excludes /api/*)
        source: '/api/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; frame-ancestors 'none'",
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },
  images: {
    minimumCacheTTL: 2592000, // 30 days — reduce CPU pressure on VPS
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cf.geekdo-images.com', // BGG game images
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co', // Supabase storage (listing photos)
      },
    ],
  },
};

const config = withNextIntl(nextConfig);

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
      },
    })
  : config;
