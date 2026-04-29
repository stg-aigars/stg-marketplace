'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/services/audit';
import type { OssDeclaredAmounts } from '@/lib/oss/types';

interface MarkFiledInput {
  quarterStart: string; // ISO date (YYYY-MM-DD)
  quarterEnd: string;
  deadline: string;
  declaredAmounts: OssDeclaredAmounts;
  paymentReference?: string;
}

type ActionResult = { success: true; submissionId: string } | { error: string };

/**
 * Record an OSS quarterly submission.
 *
 * The `oss_submissions` row is the authoritative SUBMISSION EVENT — the
 * underlying transaction data is on `orders` and the per-MS aggregates are
 * computed at query time. Payment confirmation (payment_cleared_at,
 * confirmation_url) is filled in later via the recordOssPayment action.
 */
export async function recordOssSubmission(input: MarkFiledInput): Promise<ActionResult> {
  const { isStaff, user } = await requireServerAuth();
  if (!isStaff || !user) return { error: 'Not authorized' };

  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from('oss_submissions')
    .insert({
      quarter_start: input.quarterStart,
      quarter_end: input.quarterEnd,
      deadline: input.deadline,
      declared_amounts: input.declaredAmounts,
      payment_reference: input.paymentReference?.trim() || null,
      filed_by: user.id,
    })
    .select('id')
    .single();

  if (error || !row) {
    console.error('[OSS] recordOssSubmission failed:', error?.message);
    return { error: 'Could not record the submission. Please try again.' };
  }

  void logAuditEvent({
    actorType: 'user',
    actorId: user.id,
    action: 'oss.submission_recorded',
    resourceType: 'oss_submission',
    resourceId: row.id,
    metadata: {
      quarter_start: input.quarterStart,
      quarter_end: input.quarterEnd,
      declared_amounts: input.declaredAmounts,
      payment_reference: input.paymentReference?.trim() || null,
      source: 'mark_filed',
    },
    retentionClass: 'regulatory',
  });

  revalidatePath('/staff/oss');
  return { success: true, submissionId: row.id };
}
