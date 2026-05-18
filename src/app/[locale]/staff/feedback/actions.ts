'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';

type ActionResult = { success: true } | { error: string };
type FeedbackStatus = 'new' | 'triaged' | 'resolved';

const VALID_STATUSES: readonly FeedbackStatus[] = ['new', 'triaged', 'resolved'];

export async function setFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
): Promise<ActionResult> {
  const { isStaff, user } = await requireServerAuth();
  if (!isStaff || !user) return { error: 'Not authorized' };

  if (!VALID_STATUSES.includes(status)) {
    return { error: 'Invalid status' };
  }

  const service = createServiceClient();
  const { error } = await service
    .from('site_feedback')
    .update({ status })
    .eq('id', feedbackId);

  if (error) {
    console.error('[staff/feedback] setFeedbackStatus failed:', error.message);
    return { error: 'Could not update status. Please try again.' };
  }

  revalidatePath('/staff/feedback');
  return { success: true };
}
