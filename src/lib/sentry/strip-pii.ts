import type { ErrorEvent, Event } from '@sentry/nextjs';

/** Strip PII from Sentry error reports before transmission (GDPR compliance). */
export function stripPii<T extends Event | ErrorEvent>(event: T): T {
  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
  }

  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
  }

  return event;
}
