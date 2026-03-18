import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
      disableLogger: true,
    })
  : config;
