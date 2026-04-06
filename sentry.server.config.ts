import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',

  tracesSampleRate: 0.1,

  // Strip PII from error reports (GDPR compliance)
  beforeSend(event) {
    // Remove user identity
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }

    // Remove IP from request
    if (event.request) {
      delete event.request.headers;
      delete event.request.cookies;
    }

    return event;
  },
});
