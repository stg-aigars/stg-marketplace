import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  output: 'standalone',
  async headers() {
    return [
      {
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
