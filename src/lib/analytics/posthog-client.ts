import posthog from 'posthog-js';
import { env } from '@/lib/env';

let initialized = false;

export function getPostHogClient() {
  if (typeof window === 'undefined') return null;
  if (!env.posthog.key) return null;
  if (!initialized) {
    posthog.init(env.posthog.key, {
      api_host: '/ingest',
      ui_host: 'https://eu.posthog.com',
      cookieless_mode: 'always',
      capture_pageview: false,
      defaults: '2026-01-30',
    });
    initialized = true;
  }
  return posthog;
}

export { posthog };
