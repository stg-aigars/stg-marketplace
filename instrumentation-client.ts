import * as Sentry from '@sentry/nextjs';
import { stripPii } from '@/lib/sentry/strip-pii';

// Required by Sentry to instrument client-side navigations in App Router
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',

  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  ignoreErrors: [
    // Browser extensions modifying DOM between SSR and hydration
    "Failed to execute 'removeChild' on 'Node'",
    "Failed to execute 'insertBefore' on 'Node'",
    "Failed to execute 'appendChild' on 'Node'",
    // Common browser extension noise
    'ResizeObserver loop',
    // Third-party scripts (browser extensions, scrapers) that parse our
    // application/ld+json blocks and assume a single node object. Thrown from
    // injected inline script, not from our bundles — see the JsonLd component
    // for the shape fix. Sentry STG-MARKETPLACE-1P / -1R / -1S.
    /@context.*\.toLowerCase/,
  ],

  beforeSend(event) {
    // Filter out Next.js navigation errors (not actual bugs)
    if (event.exception?.values?.some((e) => e.type === 'NEXT_NOT_FOUND')) {
      return null;
    }

    // Filter out transient CDN load failures (external network issues, not bugs)
    // and aborted RSC streams (user navigated mid-prefetch — surfaced as
    // "Error in input stream" by Next.js's RSC decoder; handled, no user impact).
    if (
      event.exception?.values?.some(
        (e) =>
          e.type === 'TypeError' &&
          (e.value?.includes('Load failed') ||
            e.value?.includes('Error in input stream'))
      )
    ) {
      return null;
    }

    return stripPii(event);
  },
});
