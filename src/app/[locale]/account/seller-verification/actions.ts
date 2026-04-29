'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/services/audit';

type ActionResult = { success: true } | { error: string };

export type VerificationResponse = 'collector' | 'trader' | 'unresponsive';

/**
 * Seller self-classification — writes verification_response + verification_responded_at,
 * fires seller.verification_responded.
 *
 * "I'd rather not say" maps to 'unresponsive' (same as the cron escalation
 * after 14 days). The seller is told upfront — no surprises.
 */
export async function submitSellerVerification(response: VerificationResponse): Promise<ActionResult> {
  const { user } = await requireServerAuth();
  if (!user) return { error: 'Not authorized' };

  const service = createServiceClient();

  const { data: profile, error: loadError } = await service
    .from('user_profiles')
    .select('verification_requested_at, verification_response')
    .eq('id', user.id)
    .single();

  if (loadError || !profile) {
    return { error: 'Could not load your profile.' };
  }

  if (!profile.verification_requested_at) {
    return { error: 'No verification request is pending on your account.' };
  }

  if (profile.verification_response) {
    return { error: 'You have already responded to this verification request.' };
  }

  const now = new Date();
  const respondedWithinDays = Math.floor(
    (now.getTime() - new Date(profile.verification_requested_at).getTime()) / (1000 * 60 * 60 * 24),
  );

  const { error: updateError } = await service
    .from('user_profiles')
    .update({
      verification_response: response,
      verification_responded_at: now.toISOString(),
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('[seller-verification] update failed:', updateError.message);
    return { error: 'Could not save your response. Please try again.' };
  }

  void logAuditEvent({
    actorType: 'user',
    actorId: user.id,
    action: 'seller.verification_responded',
    resourceType: 'user',
    resourceId: user.id,
    metadata: {
      response,
      responded_within_days: respondedWithinDays,
    },
  });

  revalidatePath('/account/seller-verification');
  return { success: true };
}
