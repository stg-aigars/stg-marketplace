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

    const now = new Date().toISOString();

    // Atomic first-publish claim: attempt to set notified_at WHERE notified_at
    // IS NULL. Only the call that wins the race gets a non-empty result, so
    // only it fires the fan-out + audit. The TOCTOU race that bit a SELECT-
    // then-check-then-UPDATE pattern can't happen because the WHERE clause is
    // part of the same UPDATE statement.
    const { data: claim, error: claimErr } = await supabase
      .from('announcements')
      .update({ published_at: now, notified_at: now })
      .eq('id', id)
      .is('notified_at', null)
      .select('id, slug, title');
    if (claimErr) {
      console.error('[announcements] publishAnnouncement first-publish claim failed', claimErr);
      return { error: 'publish_failed' };
    }

    const claimed = (claim ?? [])[0];
    const isFirstPublish = !!claimed;

    let announcement = claimed;
    if (!isFirstPublish) {
      // Re-publish path: row may or may not exist; set published_at + read slug/title for audit hooks.
      const { data: rePub, error: rePubErr } = await supabase
        .from('announcements')
        .update({ published_at: now })
        .eq('id', id)
        .select('id, slug, title')
        .maybeSingle();
      if (rePubErr) {
        console.error('[announcements] publishAnnouncement re-publish failed', rePubErr);
        return { error: 'publish_failed' };
      }
      if (!rePub) return { error: 'not_found' };
      announcement = rePub;
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
              announcementSlug: announcement.slug,
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

/**
 * Mark this user's unread `announcement.posted` notification(s) for the given
 * announcement as read. Fired from the detail page's server component on view
 * (signed-in only) so opening an announcement clears the bell dot even when
 * the user didn't pass through the bell. Mirrors markThreadRead from messaging.
 */
export async function markAnnouncementRead(announcementId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('type', 'announcement.posted')
    .is('read_at', null)
    .eq('metadata->>announcementId', announcementId);
}

/**
 * Mark all unread `announcement.posted` notifications for this announcement
 * as read, across all recipients. Called after unpublish + soft-delete so the
 * bell dot clears for everyone — clicked bell rows then route to a 404 rather
 * than dangling on an unpublished URL.
 */
async function sweepAnnouncementNotifications(
  supabase: Awaited<ReturnType<typeof createClient>>,
  announcementId: string,
): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('type', 'announcement.posted')
    .is('read_at', null)
    .eq('metadata->>announcementId', announcementId);
}

export async function unpublishAnnouncement(id: string): Promise<AnnouncementsActionResult> {
  try {
    const { user } = await requireStaffServerAuth();
    const supabase = await createClient();

    const { data: announcement } = await supabase
      .from('announcements')
      .select('id, slug, title')
      .eq('id', id)
      .maybeSingle();
    if (!announcement) return { error: 'not_found' };

    const { error } = await supabase
      .from('announcements')
      .update({ published_at: null })
      .eq('id', id);
    if (error) {
      console.error('[announcements] unpublishAnnouncement failed', error);
      return { error: 'unpublish_failed' };
    }

    await sweepAnnouncementNotifications(supabase, id);

    void logAuditEvent(supabase, {
      actorId: user.id,
      actorType: 'user',
      action: 'announcement.unpublished',
      resourceType: 'announcement',
      resourceId: id,
      metadata: { slug: announcement.slug, title: announcement.title },
      retentionClass: 'operational',
    });

    revalidatePath('/announcements');
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === 'forbidden') return { error: 'forbidden' };
    throw err;
  }
}

export async function softDeleteAnnouncement(id: string): Promise<AnnouncementsActionResult> {
  try {
    const { user } = await requireStaffServerAuth();
    const supabase = await createClient();

    const { data: announcement } = await supabase
      .from('announcements')
      .select('id, slug, title')
      .eq('id', id)
      .maybeSingle();
    if (!announcement) return { error: 'not_found' };

    const { error } = await supabase
      .from('announcements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('[announcements] softDeleteAnnouncement failed', error);
      return { error: 'delete_failed' };
    }

    await sweepAnnouncementNotifications(supabase, id);

    void logAuditEvent(supabase, {
      actorId: user.id,
      actorType: 'user',
      action: 'announcement.deleted',
      resourceType: 'announcement',
      resourceId: id,
      metadata: { slug: announcement.slug, title: announcement.title },
      retentionClass: 'operational',
    });

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
    // /announcements is force-static; without this revalidation, edits to a
    // published announcement's title/body never reflect on the public list
    // until something else triggers revalidation.
    revalidatePath('/announcements');
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === 'forbidden') return { error: 'forbidden' };
    throw err;
  }
}
