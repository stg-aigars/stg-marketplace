'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/services/audit';

import type { SellerStatus } from '@/lib/auth/types';

type ActionResult = { success: true } | { error: string };

export type { SellerStatus };

/**
 * Staff-side mutation of seller_status. Captures from/to/reason in audit metadata,
 * plus the count of in-flight reserved and auction_ended listings — those are
 * deliberately not paused by the trigger (asymmetry #2 in pause_listings_on_suspension)
 * and the audit row preserves the count at decision time so a future review can
 * see what survived.
 */
export async function updateSellerStatus(
  userId: string,
  toStatus: SellerStatus,
  reason: string,
): Promise<ActionResult> {
  const { isStaff, user: actor } = await requireServerAuth();
  if (!isStaff || !actor) return { error: 'Not authorized' };

  if (!reason || reason.trim().length < 20) {
    return { error: 'Please add a reason (≥20 chars) — this lands in the audit log.' };
  }

  const service = createServiceClient();

  // Load current status + in-flight counts atomically (best-effort; the trigger fires
  // on commit either way).
  const { data: current, error: loadError } = await service
    .from('user_profiles')
    .select('seller_status')
    .eq('id', userId)
    .single();

  if (loadError || !current) {
    return { error: 'User not found' };
  }

  if (current.seller_status === toStatus) {
    return { error: `User is already ${toStatus}.` };
  }

  // Count in-flight listings before mutation for audit metadata.
  const [{ count: reservedCount }, { count: auctionEndedCount }] = await Promise.all([
    service
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .eq('status', 'reserved'),
    service
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .eq('status', 'auction_ended'),
  ]);

  const { error: updateError } = await service
    .from('user_profiles')
    .update({ seller_status: toStatus })
    .eq('id', userId);

  if (updateError) {
    console.error('[staff/users] updateSellerStatus failed:', updateError.message);
    return { error: 'Could not update status. Please try again.' };
  }

  void logAuditEvent({
    actorType: 'user',
    actorId: actor.id,
    action: 'seller.status_changed',
    resourceType: 'user',
    resourceId: userId,
    metadata: {
      from: current.seller_status,
      to: toStatus,
      reason: reason.trim(),
      actorStaffId: actor.id,
      inFlightReservedCount: reservedCount ?? 0,
      inFlightAuctionEndedCount: auctionEndedCount ?? 0,
    },
    retentionClass: 'regulatory',
  });

  revalidatePath(`/staff/users/${userId}`);
  return { success: true };
}
