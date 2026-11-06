import { describe, it, expect, vi } from 'vitest';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

// Only `config` is under test. next-intl's middleware imports `next/server`
// without an extension, which Vitest's ESM resolver can't load — stub it so the
// module graph imports cleanly. The handler itself is never invoked here.
vi.mock('next-intl/middleware', () => ({ default: () => () => undefined }));

const { config } = await import('./middleware');

const BASE = 'https://secondturn.games';

function matches(path: string): boolean {
  return unstable_doesMiddlewareMatch({ config, url: `${BASE}${path}` });
}

describe('middleware config.matcher', () => {
  // These are served by Next as root-level files (app/robots.ts,
  // app/sitemap.ts, public/llms.txt, public/offline.html). If the middleware
  // runs on them, next-intl rewrites them to /en/<file> and they 404.
  // public/offline.html is also the service worker's install precache — a 404
  // there fails the whole service-worker install.
  it.each(['/robots.txt', '/sitemap.xml', '/llms.txt', '/offline.html'])(
    'skips root-level file %s',
    (path) => {
      expect(matches(path)).toBe(false);
    }
  );

  it.each([
    '/sw.js',
    '/manifest.webmanifest',
    '/og-image.png',
    '/api/cron/end-auctions',
    '/ingest/e',
    '/_next/static/chunks/app.js',
  ])('keeps skipping %s', (path) => {
    expect(matches(path)).toBe(false);
  });

  // Pages must keep running through auth redirects, intl routing and CSP.
  it.each([
    '/',
    '/browse',
    '/browse?q=catan',
    '/listings/7d609568-f5af-4471-b3ef-cb8faaf477a8',
    '/announcements',
    '/account',
    '/account/orders',
    '/staff',
    '/staff/accounting/pvn',
    '/auth/signin',
    '/sell',
    '/terms/lv',
  ])('runs on page %s', (path) => {
    expect(matches(path)).toBe(true);
  });

  // The exclusions are exact root-level names, not extension wildcards, so a
  // future route that happens to end in .xml/.txt still gets auth + CSP.
  it.each(['/staff/export.xml', '/account/notes.txt', '/en/sitemap.xml'])(
    'still runs on non-root %s',
    (path) => {
      expect(matches(path)).toBe(true);
    }
  );
});
