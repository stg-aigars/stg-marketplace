import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Announcement } from './types';

/**
 * Public list query — published, non-deleted announcements, newest first.
 * RLS allows anon to read; no auth check needed at this layer.
 */
export async function listPublishedAnnouncements(limit = 52): Promise<Announcement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('announcements')
    .select('id, slug, title, body_markdown, published_at, notified_at, deleted_at, created_by, created_at, updated_at')
    .not('published_at', 'is', null)
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(limit);
  return (data as Announcement[] | null) ?? [];
}

/**
 * Detail query — looks up by slug. RLS gates the SELECT to published_at
 * IS NOT NULL AND deleted_at IS NULL for every role (no separate staff
 * SELECT policy), so for unpublished or soft-deleted rows this returns null
 * regardless of who's asking; the page treats null as 404 via notFound().
 *
 * Wrapped in React `cache()` so generateMetadata + the page component share
 * a single DB fetch per request (Next.js doesn't dedupe arbitrary async
 * functions — only fetch() calls with identical URLs via the Request cache).
 */
export const getPublishedAnnouncementBySlug = cache(
  async (slug: string): Promise<Announcement | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    return (data as Announcement | null) ?? null;
  },
);
