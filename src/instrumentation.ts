export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');

    // Surface silent Turnstile misconfig in production. Both keys are declared
    // as optional in env.ts because dev/CI run without them, but in production
    // a missing secret means bot protection passes everyone through, and a
    // missing site key means every form gated on `!!turnstileToken` stays
    // permanently disabled. Both are alert-worthy on their own.
    if (process.env.NODE_ENV === 'production') {
      const Sentry = await import('@sentry/nextjs');
      if (!process.env.TURNSTILE_SECRET_KEY) {
        Sentry.captureMessage(
          'Turnstile secret key missing in production — bot protection silently disabled',
          { level: 'error' }
        );
      }
      if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
        Sentry.captureMessage(
          'Turnstile site key missing in production — gated forms will be permanently disabled',
          { level: 'error' }
        );
      }
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
