import * as Sentry from '@sentry/nextjs';
import { env, assertEnv } from '@/lib/env';

// Reports errors thrown in Server Components, Server Actions, and Route
// Handlers to Sentry. Without this hook those errors only reach stdout; the
// browser receives a digest-only "error in the Server Components render"
// message that carries no stack or cause.
export const onRequestError = Sentry.captureRequestError;

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');

    // Centralized env validation at boot: console.warn for missing optional
    // keys (visible in Coolify logs), throw for missing required keys (fail
    // fast rather than crash on first request). Runs after Sentry init so
    // the throw is captured with full context.
    assertEnv();

    // Surface silent Turnstile misconfig in production. Both keys are declared
    // as optional in env.ts because dev/CI run without them, but in production
    // a missing secret means bot protection passes everyone through, and a
    // missing site key means every form gated on `!!turnstileToken` stays
    // permanently disabled. Both are alert-worthy on their own.
    if (process.env.NODE_ENV === 'production') {
      if (!env.turnstile.secretKey) {
        Sentry.captureMessage(
          'Turnstile secret key missing in production — bot protection silently disabled',
          { level: 'error' }
        );
      }
      if (!env.turnstile.siteKey) {
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
