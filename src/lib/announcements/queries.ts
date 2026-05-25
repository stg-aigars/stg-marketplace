import 'server-only';
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
    .select('*')
    .not('published_at', 'is', null)
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(limit);
  return (data as Announcement[] | null) ?? [];
}

/**
 * Detail query — looks up by slug. Returns the row even if unpublished /
 * soft-deleted so the page can render the tombstone instead of 404.
 * (RLS allows anon SELECT only for published rows, so for unpublished /
 * deleted rows this returns null for anon visitors; the page treats null
 * the same as the row-not-found case and renders 404 via notFound().
 * Staff-authenticated calls also can't see deleted rows via this query;
 * that's intentional — staff use the dashboard list, not the public URL.)
 */
export async function getPublishedAnnouncementBySlug(slug: string): Promise<Announcement | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return (data as Announcement | null) ?? null;
}
