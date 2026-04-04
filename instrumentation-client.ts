import * as Sentry from '@sentry/nextjs';

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
  ],

  beforeSend(event) {
    // Filter out Next.js navigation errors (not actual bugs)
    if (event.exception?.values?.some((e) => e.type === 'NEXT_NOT_FOUND')) {
      return null;
    }

    // Filter out transient CDN load failures (external network issues, not bugs)
    if (
      event.exception?.values?.some(
        (e) => e.type === 'TypeError' && e.value?.includes('Load failed')
      )
    ) {
      return null;
    }

    return event;
  },
});
