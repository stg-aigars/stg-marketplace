import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',

  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  beforeSend(event) {
    // Filter out Next.js navigation errors (not actual bugs)
    if (event.exception?.values?.some((e) => e.type === 'NEXT_NOT_FOUND')) {
      return null;
    }
    return event;
  },
});
