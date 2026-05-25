import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink, Breadcrumb, Card, CardBody, ShareButtons } from '@/components/ui';
import { AnnouncementMarkdown } from '@/components/announcements/AnnouncementMarkdown';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildAnnouncementJsonLd } from '@/lib/seo/announcement-json-ld';
import { buildBreadcrumbJsonLd } from '@/lib/seo/breadcrumb-json-ld';
import { getPublishedAnnouncementBySlug } from '@/lib/announcements/queries';
import { markdownExcerpt } from '@/lib/announcements/excerpt';
import { markAnnouncementRead } from '@/lib/announcements/actions';
import { formatDate } from '@/lib/date-utils';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedAnnouncementBySlug(slug);
  if (!a || a.deleted_at || !a.published_at) {
    return {
      title: 'Announcement unavailable',
      robots: { index: false, follow: false },
    };
  }
  const description = markdownExcerpt(a.body_markdown, 160);
  return {
    title: a.title,
    description,
    openGraph: { title: a.title, description, type: 'article' },
  };
}

export default async function AnnouncementDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const a = await getPublishedAnnouncementBySlug(slug);

  // Row truly missing → 404. Row present but unpublished or soft-deleted →
  // tombstone (200). Note: anon callers cannot see unpublished/deleted rows
  // via RLS, so for them this also routes to 404. The tombstone branch fires
  // for signed-in staff or for anyone who hits the URL with a cached value.
  if (!a) notFound();
  if (a.deleted_at || !a.published_at) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <BackLink href="/announcements" label="All announcements" />
        <div className="mt-4">
          <Card>
            <CardBody>
              <p className="text-sm text-semantic-text-muted">
                This announcement is no longer available.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  // Mark-read on view for signed-in viewers. Mirrors markThreadRead from
  // messaging — clears the bell dot + Messages-style dropdown unread dot
  // when the user opens the page directly (no bell pass-through).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) void markAnnouncementRead(a.id);

  const url = `${env.app.url}/announcements/${a.slug}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <JsonLd data={buildAnnouncementJsonLd(a, env.app.url)} />
      <JsonLd
        data={buildBreadcrumbJsonLd(
          [
            { name: 'Home', url: env.app.url },
            { name: 'Announcements', url: `${env.app.url}/announcements` },
            { name: a.title, url },
          ],
          env.app.url,
        )}
      />

      <Breadcrumb
        items={[
          { label: 'Announcements', href: '/announcements' },
          { label: a.title },
        ]}
      />

      <article className="mt-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">{a.title}</h1>
        {a.published_at && (
          <time
            className="text-sm text-semantic-text-muted block mb-6"
            dateTime={a.published_at}
          >
            {formatDate(a.published_at)}
          </time>
        )}

        <AnnouncementMarkdown body={a.body_markdown} />

        <div className="mt-6">
          <ShareButtons url={url} title={a.title} />
        </div>
      </article>
    </div>
  );
}

// Tombstone branch's robots:noindex is set inside generateMetadata above when
// the row is unpublished or deleted; published rows inherit default robots.
