import { markdownExcerpt } from '@/lib/announcements/excerpt';
import type { Announcement } from '@/lib/announcements/types';

/**
 * Article schema for a published announcement. Used on /announcements/[slug].
 * articleBody is the plain-text excerpt (no markdown syntax leaks into the
 * schema) capped at 5000 chars — generous for a weekly post; the canonical
 * source remains the page itself.
 */
export function buildAnnouncementJsonLd(a: Announcement, baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    datePublished: a.published_at,
    dateModified: a.updated_at,
    author: { '@type': 'Organization', name: 'Second Turn Games' },
    articleBody: markdownExcerpt(a.body_markdown, 5000),
    url: `${baseUrl}/announcements/${a.slug}`,
  };
}
