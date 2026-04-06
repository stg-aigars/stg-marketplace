import * as Sentry from '@sentry/nextjs';
import { stripPii } from '@/lib/sentry/strip-pii';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',

  tracesSampleRate: 0.1,

  beforeSend: stripPii,
});
