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

async function requireStaff(): Promise<
  | { ok: true; userId: string }
  | { ok: false; result: AnnouncementsActionResult }
> {
  const { user, profile } = await requireServerAuth();
  if (!profile?.is_staff) {
    return { ok: false, result: { error: 'forbidden' } };
  }
  return { ok: true, userId: user.id };
}

export async function createAnnouncement(args: {
  title: string;
  slug?: string;
  bodyMarkdown: string;
}): Promise<AnnouncementsActionResult & { id?: string }> {
  const auth = await requireStaff();
  if (!auth.ok) return auth.result;

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
      created_by: auth.userId,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'slug_taken' };
    console.error('[announcements] createAnnouncement insert failed', error);
    return { error: 'create_failed' };
  }
  return { success: true, id: data.id };
}

export async function publishAnnouncement(id: string): Promise<AnnouncementsActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth.result;
  const supabase = await createClient();

  const now = new Date().toISOString();

  // Atomic first-publish claim: only the call that wins the
  // WHERE notified_at IS NULL race fans out + audits.
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
      actorId: auth.userId,
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

  revalidatePath('/[locale]/announcements', 'page');
  return { success: true };
}

export async function updateAnnouncement(
  id: string,
  fields: { title?: string; slug?: string; bodyMarkdown?: string },
): Promise<AnnouncementsActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth.result;
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
  revalidatePath('/[locale]/announcements', 'page');
  return { success: true };
}

/**
 * Mark this user's unread `announcement.posted` notification(s) for the given
 * announcement as read. Fired from the detail page's server component on view
 * (signed-in only) so opening an announcement clears the bell dot even when
 * the user didn't pass through the bell. Mirrors markThreadRead from messaging.
 *
 * Accepts an authed supabase client to avoid the redundant auth round-trip
 * the caller already paid; falls back to creating its own if absent.
 */
export async function markAnnouncementRead(
  announcementId: string,
  userId: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('type', 'announcement.posted')
    .is('read_at', null)
    .eq('metadata->>announcementId', announcementId);
}

/**
 * Shared body for unpublishAnnouncement + softDeleteAnnouncement. Both:
 *   1. Atomically UPDATE the target column + RETURN slug/title for audit
 *   2. Sweep notifications for everyone so bell dots clear
 *   3. Audit-log the staff action
 *   4. Revalidate the public list
 */
async function applyAnnouncementStateChange(
  id: string,
  patch: Record<string, string | null>,
  auditAction: 'announcement.unpublished' | 'announcement.deleted',
  errorCode: 'unpublish_failed' | 'delete_failed',
): Promise<AnnouncementsActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth.result;
  const supabase = await createClient();

  const { data: announcement, error } = await supabase
    .from('announcements')
    .update(patch)
    .eq('id', id)
    .select('id, slug, title')
    .maybeSingle();
  if (error) {
    console.error(`[announcements] ${auditAction} failed`, error);
    return { error: errorCode };
  }
  if (!announcement) return { error: 'not_found' };

  await sweepAnnouncementNotifications(id);

  void logAuditEvent(supabase, {
    actorId: auth.userId,
    actorType: 'user',
    action: auditAction,
    resourceType: 'announcement',
    resourceId: id,
    metadata: { slug: announcement.slug, title: announcement.title },
    retentionClass: 'operational',
  });

  revalidatePath('/[locale]/announcements', 'page');
  return { success: true };
}

export async function unpublishAnnouncement(id: string): Promise<AnnouncementsActionResult> {
  return applyAnnouncementStateChange(
    id,
    { published_at: null },
    'announcement.unpublished',
    'unpublish_failed',
  );
}

export async function softDeleteAnnouncement(id: string): Promise<AnnouncementsActionResult> {
  return applyAnnouncementStateChange(
    id,
    { deleted_at: new Date().toISOString() },
    'announcement.deleted',
    'delete_failed',
  );
}

/**
 * Mark all unread `announcement.posted` notifications for this announcement
 * as read, across all recipients. Bell dots clear; clicked bell rows route
 * to 404 rather than dangling on an unpublished URL.
 */
async function sweepAnnouncementNotifications(announcementId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('type', 'announcement.posted')
    .is('read_at', null)
    .eq('metadata->>announcementId', announcementId);
}
