'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireServerAuth } from '@/lib/auth/helpers';
import { notifyMany } from '@/lib/notifications';
import { logAuditEvent } from '@/lib/services/audit';
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

export async function publishAnnouncement(id: string): Promise<AnnouncementsActionResult> {
  try {
    const { user } = await requireStaffServerAuth();
    const supabase = await createClient();

    const { data: announcement } = await supabase
      .from('announcements')
      .select('id, slug, title, notified_at')
      .eq('id', id)
      .maybeSingle();
    if (!announcement) return { error: 'not_found' };

    const now = new Date().toISOString();
    const isFirstPublish = announcement.notified_at === null;

    const { error: publishErr } = await supabase
      .from('announcements')
      .update({
        published_at: now,
        ...(isFirstPublish ? { notified_at: now } : {}),
      })
      .eq('id', id);
    if (publishErr) {
      console.error('[announcements] publishAnnouncement update failed', publishErr);
      return { error: 'publish_failed' };
    }

    if (isFirstPublish) {
      // Fan out to every user_profiles row. notifyMany batches into a single
      // INSERT. Deleted users (anonymized + banned) keep their profile row;
      // the resulting notification is harmless (banned user can never read).
      const { data: profiles } = await supabase.from('user_profiles').select('id');
      const recipientCount = profiles?.length ?? 0;
      if (recipientCount > 0 && profiles) {
        void notifyMany(
          profiles.map((p) => ({
            userId: p.id,
            type: 'announcement.posted',
            context: {
              announcementId: id,
              slug: announcement.slug,
              announcementTitle: announcement.title,
            },
          })),
        );
      }

      void logAuditEvent(supabase, {
        actorId: user.id,
        actorType: 'user',
        action: 'announcement.published',
        resourceType: 'announcement',
        resourceId: id,
        metadata: {
          slug: announcement.slug,
          title: announcement.title,
          recipientsIntended: recipientCount,
        },
        retentionClass: 'operational',
      });
    }

    revalidatePath('/announcements');
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === 'forbidden') return { error: 'forbidden' };
    throw err;
  }
}

export async function updateAnnouncement(
  id: string,
  fields: { title?: string; slug?: string; bodyMarkdown?: string },
): Promise<AnnouncementsActionResult> {
  try {
    await requireStaffServerAuth();
    const supabase = await createClient();

    // Slug-lock invariant: once notifications have been fanned out, the
    // snapshotted slug in notification metadata must keep resolving.
    const { data: current } = await supabase
      .from('announcements')
      .select('notified_at')
      .eq('id', id)
      .maybeSingle();
    if (!current) return { error: 'not_found' };

    if (fields.slug !== undefined && current.notified_at !== null) {
      return { error: 'slug_locked_after_notify' };
    }

    const payload: Record<string, unknown> = {};
    if (fields.title !== undefined) {
      if (fields.title.length < 1 || fields.title.length > ANNOUNCEMENT_TITLE_MAX) {
        return { error: 'invalid_title' };
      }
      payload.title = fields.title;
    }
    if (fields.slug !== undefined) {
      const check = validateSlug(fields.slug);
      if (!check.ok) return { error: check.reason };
      payload.slug = fields.slug;
    }
    if (fields.bodyMarkdown !== undefined) {
      if (fields.bodyMarkdown.length < 1 || fields.bodyMarkdown.length > ANNOUNCEMENT_BODY_MAX) {
        return { error: 'invalid_body' };
      }
      payload.body_markdown = fields.bodyMarkdown;
    }

    if (Object.keys(payload).length === 0) return { success: true };

    const { error } = await supabase.from('announcements').update(payload).eq('id', id);
    if (error) {
      if (error.code === '23505') return { error: 'slug_taken' };
      console.error('[announcements] updateAnnouncement failed', error);
      return { error: 'update_failed' };
    }
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === 'forbidden') return { error: 'forbidden' };
    throw err;
  }
}
