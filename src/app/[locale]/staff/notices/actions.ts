'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/services/audit';
import { notify } from '@/lib/notifications';

type ActionResult = { success: true } | { error: string };

/**
 * Mark a notice as 'reviewing' — staff has picked it up but hasn't decided yet.
 */
export async function markNoticeReviewing(noticeId: string, staffNote?: string): Promise<ActionResult> {
  const { isStaff, user } = await requireServerAuth();
  if (!isStaff || !user) return { error: 'Not authorized' };

  const service = createServiceClient();
  const { error } = await service
    .from('dsa_notices')
    .update({ status: 'reviewing', staff_note: staffNote ?? null })
    .eq('id', noticeId);

  if (error) {
    console.error('[staff/notices] markNoticeReviewing failed:', error.message);
    return { error: 'Could not update notice. Please try again.' };
  }

  revalidatePath('/staff/notices');
  return { success: true };
}

/**
 * Dismiss a notice — staff reviewed and decided not to act.
 */
export async function dismissNotice(noticeId: string, staffNote: string): Promise<ActionResult> {
  const { isStaff, user } = await requireServerAuth();
  if (!isStaff || !user) return { error: 'Not authorized' };

  if (!staffNote || staffNote.trim().length < 20) {
    return { error: 'Please add a short note explaining why this notice was dismissed (≥20 chars).' };
  }

  const service = createServiceClient();
  const { error } = await service
    .from('dsa_notices')
    .update({
      status: 'dismissed',
      staff_note: staffNote.trim(),
      resolved_at: new Date().toISOString(),
    })
    .eq('id', noticeId);

  if (error) {
    console.error('[staff/notices] dismissNotice failed:', error.message);
    return { error: 'Could not update notice. Please try again.' };
  }

  revalidatePath('/staff/notices');
  return { success: true };
}

/**
 * Take action on a notice — sets the bound listing to 'cancelled' (soft-delete),
 * fires the seller-facing DSA Art. 17 notification, and logs the staff decision
 * as a peer audit event to `dsa_notice.received`.
 */
export async function actionListingFromNotice(
  noticeId: string,
  reasonCategory: 'tos_violation' | 'illegal' | 'misleading' | 'ip_infringement' | 'other',
  reasonText: string,
): Promise<ActionResult> {
  const { isStaff, user } = await requireServerAuth();
  if (!isStaff || !user) return { error: 'Not authorized' };

  if (!reasonText || reasonText.trim().length < 20) {
    return { error: 'Please give the seller a clear reason (≥20 chars).' };
  }

  const service = createServiceClient();

  // Load the notice + bound listing
  const { data: notice, error: noticeError } = await service
    .from('dsa_notices')
    .select('id, listing_id, status')
    .eq('id', noticeId)
    .single();

  if (noticeError || !notice) {
    return { error: 'Notice not found' };
  }
  if (!notice.listing_id) {
    return { error: 'This notice is not bound to a listing — pick Dismiss instead.' };
  }
  if (notice.status === 'actioned' || notice.status === 'dismissed') {
    return { error: 'This notice has already been resolved.' };
  }

  // Load the listing to capture seller_id and game_name for the Art. 17 notification
  const { data: listing, error: listingError } = await service
    .from('listings')
    .select('id, seller_id, game_name, status')
    .eq('id', notice.listing_id)
    .single();

  if (listingError || !listing) {
    return { error: 'Bound listing no longer exists.' };
  }

  // Soft-delete the listing — same path the seller uses for self-removal
  if (listing.status !== 'cancelled' && listing.status !== 'sold') {
    const { error: updateError } = await service
      .from('listings')
      .update({ status: 'cancelled' })
      .eq('id', listing.id);
    if (updateError) {
      console.error('[staff/notices] listing soft-delete failed:', updateError.message);
      return { error: 'Could not act on the listing. Please try again.' };
    }
  }

  // Mark the notice resolved
  const statementOfReasonsSentAt = new Date().toISOString();
  const { error: noticeUpdateError } = await service
    .from('dsa_notices')
    .update({
      status: 'actioned',
      staff_note: reasonText.trim(),
      resolved_at: statementOfReasonsSentAt,
    })
    .eq('id', noticeId);

  if (noticeUpdateError) {
    // Listing is already cancelled. If we proceed past this point we'd send the
    // seller their Art. 17 notification and write a `listing.actioned_by_staff`
    // audit row — and the next staff retry would re-send the same notification
    // (notify is not idempotent), giving the seller two emails for one decision.
    // Stop here. Listing stays cancelled (the cancel is what the buyer sees);
    // staff sees the notice still in 'open'/'reviewing' and can investigate.
    console.error(
      '[staff/notices] notice status update failed; aborting Art. 17 notify to avoid duplicate-on-retry:',
      noticeUpdateError.message,
    );
    return {
      error:
        'The listing was cancelled, but the notice could not be marked actioned. Please retry — the notification will fire on a successful retry.',
    };
  }

  // Fire the DSA Art. 17 statement-of-reasons to the affected seller
  void notify(listing.seller_id, 'listing.actioned', {
    listingId: listing.id,
    gameName: listing.game_name ?? undefined,
    reason: reasonText.trim(),
    restrictionType: 'soft_delete',
    redressMechanism: '/terms#cancellations-refunds',
  });

  // Internal audit pair to `dsa_notice.received` — the staff-side decision
  void logAuditEvent({
    actorType: 'user',
    actorId: user.id,
    action: 'listing.actioned_by_staff',
    resourceType: 'listing',
    resourceId: listing.id,
    metadata: {
      noticeId,
      action: 'soft_delete',
      reasonCategory,
      reasonText: reasonText.trim(),
      statementOfReasonsSentAt,
    },
    retentionClass: 'regulatory',
  });

  revalidatePath('/staff/notices');
  return { success: true };
}
