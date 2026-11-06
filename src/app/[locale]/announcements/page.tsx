import type { Metadata } from 'next';
import Link from 'next/link';
import { Megaphone } from '@phosphor-icons/react/ssr';
import { Card, CardBody, EmptyState } from '@/components/ui';
import { listPublishedAnnouncements } from '@/lib/announcements/queries';
import { markdownExcerpt } from '@/lib/announcements/excerpt';
import { formatDate } from '@/lib/date-utils';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

// Anon-readable list of platform updates. Must render per request: the CSP
// header carries a fresh nonce on every request (src/middleware.ts), and a
// prerendered page bakes in the build-time nonce instead. With force-static
// the browser blocked every script on this page (dead header, cart, mobile
// menu). Do not switch back to force-static / ISR while the CSP is
// nonce-based. The revalidatePath calls in the announcement actions are
// harmless no-ops for a dynamic page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildPageMetadata({
  title: 'Announcements',
  description:
    "What's new on Second Turn Games — platform updates, feature launches, and policy changes.",
  path: '/announcements',
});

export default async function AnnouncementsListPage() {
  const announcements = await listPublishedAnnouncements();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-6">Announcements</h1>

      {announcements.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={Megaphone}
              title="No announcements yet"
              description="We’ll post platform updates here as they ship."
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li key={a.id}>
              <Link href={`/announcements/${a.slug}`} className="block">
                <Card hoverable>
                  <CardBody>
                    <h2 className="text-base font-semibold text-semantic-text-heading mb-1">
                      {a.title}
                    </h2>
                    <p className="text-sm text-semantic-text-secondary mb-2">
                      {markdownExcerpt(a.body_markdown, 200)}
                    </p>
                    {a.published_at && (
                      <time
                        className="text-xs text-semantic-text-muted"
                        dateTime={a.published_at}
                      >
                        {formatDate(a.published_at)}
                      </time>
                    )}
                  </CardBody>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
