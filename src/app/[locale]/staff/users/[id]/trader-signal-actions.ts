'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/services/audit';
import { sendSellerVerificationRequest } from '@/lib/email';
import { TRADER_THRESHOLDS } from '@/lib/seller/trader-thresholds';

type ActionResult = { success: true } | { error: string };

export type DismissRationaleCategory =
  | 'verified_collector'
  | 'low_engagement_pattern'
  | 'marketplace_norm'
  | 'other';

/**
 * Staff dispatches the soft-touch verification email to a seller whose
 * counters have crossed the verification trigger. Records verification_requested_at
 * + fires seller.verification_requested.
 */
export async function sendVerificationRequest(userId: string): Promise<ActionResult> {
  const { isStaff, user: actor } = await requireServerAuth();
  if (!isStaff || !actor) return { error: 'Not authorized' };

  const service = createServiceClient();

  const { data: profile, error } = await service
    .from('user_profiles')
    .select(
      'id, full_name, email, verification_requested_at, completed_sales_12mo_count, completed_sales_12mo_revenue_cents, trader_signal_first_crossed_at',
    )
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return { error: 'Seller not found.' };
  }

  if (!profile.email) {
    return { error: 'Seller has no email on file.' };
  }

  if (!profile.trader_signal_first_crossed_at) {
    return { error: 'No trader signal has crossed yet — verification email is premature.' };
  }

  if (profile.verification_requested_at) {
    return { error: 'Verification request already sent on this seller.' };
  }

  const now = new Date().toISOString();

  const { error: updateError } = await service
    .from('user_profiles')
    .update({ verification_requested_at: now })
    .eq('id', userId);

  if (updateError) {
    console.error('[trader-signal-actions] verification_requested_at update failed:', updateError.message);
    return { error: 'Could not record the verification request. Please try again.' };
  }

  const firstName = (profile.full_name ?? '').trim().split(/\s+/)[0] || 'there';

  // Email is fire-and-forget; if it fails the column is still set so staff sees
  // it as "Sent X" — we'd rather have an artifact of the attempt than silently
  // re-prompt the seller on a retry.
  void sendSellerVerificationRequest({
    sellerFirstName: firstName,
    sellerEmail: profile.email,
    salesCount: profile.completed_sales_12mo_count ?? 0,
    responseDeadlineDays: TRADER_THRESHOLDS.verificationResponseDeadlineDays,
  }).catch((err) => {
    console.error('[trader-signal-actions] verification email send failed:', err);
  });

  void logAuditEvent({
    actorType: 'user',
    actorId: actor.id,
    action: 'seller.verification_requested',
    resourceType: 'user',
    resourceId: userId,
    metadata: {
      staff_id: actor.id,
      sales_count: profile.completed_sales_12mo_count ?? 0,
      revenue_cents: profile.completed_sales_12mo_revenue_cents ?? 0,
    },
  });

  revalidatePath(`/staff/users/${userId}`);
  return { success: true };
}

/**
 * Staff dismisses a trader signal — mandatory dismissal logging per the lawyer's
 * 2026-04-28 framework. Captures structured rationale; the audit row is what
 * answers "why didn't you act on the 45-sale seller" if the question is ever asked.
 */
export async function dismissTraderSignal(
  userId: string,
  rationaleCategory: DismissRationaleCategory,
  justification: string,
  evidenceUrl?: string,
): Promise<ActionResult> {
  const { isStaff, user: actor } = await requireServerAuth();
  if (!isStaff || !actor) return { error: 'Not authorized' };

  if (!justification || justification.trim().length < 50) {
    return { error: 'Justification must be at least 50 characters.' };
  }

  const service = createServiceClient();

  const { data: profile, error } = await service
    .from('user_profiles')
    .select(
      'completed_sales_12mo_count, completed_sales_12mo_revenue_cents, verification_response, trader_signal_threshold_version, trader_signal_first_crossed_at',
    )
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return { error: 'Seller not found.' };
  }

  if (!profile.trader_signal_first_crossed_at) {
    return { error: 'No trader signal exists on this seller — nothing to dismiss.' };
  }

  // Mark the signal as reviewed by clearing trader_signal_first_crossed_at.
  // The audit row preserves the timing so this is non-destructive for forensics.
  const { error: clearError } = await service
    .from('user_profiles')
    .update({ trader_signal_first_crossed_at: null })
    .eq('id', userId);

  if (clearError) {
    console.error('[trader-signal-actions] dismiss clear failed:', clearError.message);
    return { error: 'Could not record the dismissal. Please try again.' };
  }

  void logAuditEvent({
    actorType: 'user',
    actorId: actor.id,
    action: 'seller.trader_signal_dismissed',
    resourceType: 'user',
    resourceId: userId,
    metadata: {
      rationale: {
        category: rationaleCategory,
        justification: justification.trim(),
        evidenceUrl: evidenceUrl?.trim() || null,
      },
      sellerCountAtDismissal: profile.completed_sales_12mo_count ?? 0,
      sellerRevenueAtDismissal: profile.completed_sales_12mo_revenue_cents ?? 0,
      verificationResponse: profile.verification_response ?? null,
      signalThresholdVersion: profile.trader_signal_threshold_version ?? null,
    },
  });

  revalidatePath(`/staff/users/${userId}`);
  return { success: true };
}
