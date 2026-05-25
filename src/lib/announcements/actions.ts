'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerAuth } from '@/lib/auth/helpers';
import { validateSlug, slugifyTitle } from './slug';
import {
  ANNOUNCEMENT_TITLE_MAX,
  ANNOUNCEMENT_BODY_MAX,
  type AnnouncementsActionResult,
} from './types';

/**
 * Staff-only gate. requireStaffAuth is the API-route helper (returns
 * NextResponse on unauthorized); server actions use requireServerAuth +
 * manual is_staff check on the profile it already loads.
 */
async function requireStaffServerAuth() {
  const { user, profile } = await requireServerAuth();
  if (!profile?.is_staff) {
    throw new Error('forbidden');
  }
  return { user, profile };
}

export async function createAnnouncement(args: {
  title: string;
  slug?: string;
  bodyMarkdown: string;
}): Promise<AnnouncementsActionResult & { id?: string }> {
  try {
    const { user } = await requireStaffServerAuth();

    if (args.title.length < 1 || args.title.length > ANNOUNCEMENT_TITLE_MAX) {
      return { error: 'invalid_title' };
    }
    if (args.bodyMarkdown.length < 1 || args.bodyMarkdown.length > ANNOUNCEMENT_BODY_MAX) {
      return { error: 'invalid_body' };
    }

    const slug = args.slug?.trim() || slugifyTitle(args.title);
    const slugCheck = validateSlug(slug);
    if (!slugCheck.ok) return { error: slugCheck.reason };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        slug,
        title: args.title,
        body_markdown: args.bodyMarkdown,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') return { error: 'slug_taken' };
      console.error('[announcements] createAnnouncement insert failed', error);
      return { error: 'create_failed' };
    }
    return { success: true, id: data.id };
  } catch (err) {
    if (err instanceof Error && err.message === 'forbidden') return { error: 'forbidden' };
    throw err;
  }
}
