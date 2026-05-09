'use server';

/**
 * Period state-transition server actions (PR #4, Task 6).
 *
 * Three transitions on the periods state machine:
 *   open         → soft_locked   (softLockPeriod)
 *   soft_locked  → hard_locked   (hardLockPeriod)
 *   soft_locked  → open          (unsoftLockPeriod, requires reason)
 *
 * No `unhardLockPeriod`: hard-locked is permanent by design (DB trigger
 * trg_je_period_status enforces immutability). Corrections post as reversal
 * entries to a different open period.
 *
 * Gating logic lives in the Task 5 checklist module — these actions consume
 * the can_* flags rather than re-deriving the invariants. Actions write to
 * periods.status and fire a regulatory audit event per transition.
 */

import { revalidatePath } from 'next/cache';

import { requireServerAuth } from '@/lib/auth/helpers';
import { logAuditEvent } from '@/lib/services/audit';

import { getPeriodCloseChecklist } from './checklist';
import { getEntriesPostedSince, getPeriodRow } from './queries';

export type PeriodActionResult = { success: true } | { error: string };

/**
 * Find the failing checklist item with the most actionable detail string. Used
 * to surface a useful error to the staff UI when can_soft_lock=false. Falls
 * back to a generic message if no item is failing (shouldn't happen — gate
 * went false for some other reason; defensive).
 */
function describeChecklistGate(
  items: ReadonlyArray<{ status: string; label: string; detail: string }>
): string {
  const failing = items.find((it) => it.status === 'fail');
  if (failing) {
    return `${failing.label}: ${failing.detail}`;
  }
  const pending = items.find((it) => it.status === 'manual_pending');
  if (pending) {
    return `${pending.label}: ${pending.detail}`;
  }
  return 'Checklist not all green; cannot soft-lock.';
}

/**
 * Transition a period from `open` to `soft_locked`.
 *
 * Preconditions: caller is staff, period exists with status='open', and the
 * 9-item checklist's `can_soft_lock` flag is true (Σ debits = Σ credits, all
 * clearing accounts at zero, etc.).
 */
export async function softLockPeriod(periodKey: string): Promise<PeriodActionResult> {
  const { isStaff, user, serviceClient } = await requireServerAuth();
  if (!isStaff || !user) return { error: 'Not authorized' };

  let period;
  try {
    period = await getPeriodRow(serviceClient, periodKey, 'month');
  } catch (err) {
    console.error('[accounting] softLockPeriod period read failed:', err);
    return { error: 'Could not load period. Please try again.' };
  }

  if (!period) return { error: `Period ${periodKey} not found.` };
  if (period.status !== 'open') {
    return { error: `Period ${periodKey} is ${period.status}; only open periods can be soft-locked.` };
  }

  let checklist;
  try {
    checklist = await getPeriodCloseChecklist(serviceClient, periodKey);
  } catch (err) {
    console.error('[accounting] softLockPeriod checklist failed:', err);
    return { error: 'Could not compose period-close checklist. Please try again.' };
  }

  if (!checklist.can_soft_lock) {
    return { error: `Cannot soft-lock: ${describeChecklistGate(checklist.items)}` };
  }

  const { error } = await serviceClient
    .from('periods')
    .update({
      status: 'soft_locked',
      locked_at: new Date().toISOString(),
      locked_by: user.id,
    })
    .eq('period_key', periodKey)
    .eq('period_type', 'month');

  if (error) {
    console.error('[accounting] softLockPeriod update failed:', error.message);
    return { error: 'Could not soft-lock period. Please try again.' };
  }

  void logAuditEvent({
    actorType: 'user',
    actorId: user.id,
    action: 'accounting.period_status_changed',
    resourceType: 'period',
    resourceId: periodKey,
    metadata: {
      period_type: 'month',
      from_status: 'open',
      to_status: 'soft_locked',
    },
    retentionClass: 'regulatory',
  });

  revalidatePath('/staff/accounting/period-close');
  revalidatePath('/staff/accounting');
  return { success: true };
}

/**
 * Transition a period from `soft_locked` to `hard_locked`.
 *
 * Preconditions: caller is staff, period exists with status='soft_locked',
 * and no journal entries have been posted (created_at) since the soft-lock
 * timestamp. Hard-lock is irreversible — the DB trigger blocks all subsequent
 * INSERTs and there is no symmetric un-hard-lock action.
 *
 * locked_at and locked_by are intentionally not updated — they record the
 * lock-chain origin (when the close started), which is more useful for
 * audit-trail clarity than overwriting on each step.
 */
export async function hardLockPeriod(periodKey: string): Promise<PeriodActionResult> {
  const { isStaff, user, serviceClient } = await requireServerAuth();
  if (!isStaff || !user) return { error: 'Not authorized' };

  let period;
  try {
    period = await getPeriodRow(serviceClient, periodKey, 'month');
  } catch (err) {
    console.error('[accounting] hardLockPeriod period read failed:', err);
    return { error: 'Could not load period. Please try again.' };
  }

  if (!period) return { error: `Period ${periodKey} not found.` };
  if (period.status !== 'soft_locked') {
    return { error: `Period ${periodKey} is ${period.status}; only soft-locked periods can be hard-locked.` };
  }
  if (!period.locked_at) {
    // A soft_locked row with no locked_at is a corrupted state we can't safely
    // hard-lock from — the entries-since check below has nothing to compare
    // against. Refuse loudly rather than silently passing.
    return { error: `Period ${periodKey} is soft-locked but has no locked_at timestamp; refusing to hard-lock corrupted state.` };
  }

  let entriesSince;
  try {
    entriesSince = await getEntriesPostedSince(serviceClient, periodKey, period.locked_at);
  } catch (err) {
    console.error('[accounting] hardLockPeriod entries-since read failed:', err);
    return { error: 'Could not check for entries posted since soft-lock. Please try again.' };
  }

  if (entriesSince.length > 0) {
    const noun = entriesSince.length === 1 ? 'entry' : 'entries';
    return {
      error: `${entriesSince.length} ${noun} posted since soft-lock; revert to open and re-soft-lock before hard-locking.`,
    };
  }

  const { error } = await serviceClient
    .from('periods')
    .update({ status: 'hard_locked' })
    .eq('period_key', periodKey)
    .eq('period_type', 'month');

  if (error) {
    console.error('[accounting] hardLockPeriod update failed:', error.message);
    return { error: 'Could not hard-lock period. Please try again.' };
  }

  void logAuditEvent({
    actorType: 'user',
    actorId: user.id,
    action: 'accounting.period_status_changed',
    resourceType: 'period',
    resourceId: periodKey,
    metadata: {
      period_type: 'month',
      from_status: 'soft_locked',
      to_status: 'hard_locked',
    },
    retentionClass: 'regulatory',
  });

  revalidatePath('/staff/accounting/period-close');
  revalidatePath('/staff/accounting');
  return { success: true };
}

/**
 * Transition a period from `soft_locked` back to `open`. Required for
 * after-the-fact corrections (catch a bad entry post-soft-lock; staff
 * unlocks, fixes, re-runs checklist, re-soft-locks).
 *
 * Requires a non-empty reason — captured in the audit event so the unlock
 * trail is defensible. Clears locked_at and locked_by since the period is
 * leaving the lock chain.
 */
export async function unsoftLockPeriod(
  periodKey: string,
  reason: string
): Promise<PeriodActionResult> {
  const { isStaff, user, serviceClient } = await requireServerAuth();
  if (!isStaff || !user) return { error: 'Not authorized' };

  const trimmedReason = reason?.trim() ?? '';
  if (trimmedReason.length === 0) {
    return { error: 'Reason is required to unsoft-lock a period.' };
  }

  let period;
  try {
    period = await getPeriodRow(serviceClient, periodKey, 'month');
  } catch (err) {
    console.error('[accounting] unsoftLockPeriod period read failed:', err);
    return { error: 'Could not load period. Please try again.' };
  }

  if (!period) return { error: `Period ${periodKey} not found.` };
  if (period.status !== 'soft_locked') {
    return { error: `Period ${periodKey} is ${period.status}; only soft-locked periods can be reopened.` };
  }

  const { error } = await serviceClient
    .from('periods')
    .update({ status: 'open', locked_at: null, locked_by: null })
    .eq('period_key', periodKey)
    .eq('period_type', 'month');

  if (error) {
    console.error('[accounting] unsoftLockPeriod update failed:', error.message);
    return { error: 'Could not reopen period. Please try again.' };
  }

  void logAuditEvent({
    actorType: 'user',
    actorId: user.id,
    action: 'accounting.period_status_changed',
    resourceType: 'period',
    resourceId: periodKey,
    metadata: {
      period_type: 'month',
      from_status: 'soft_locked',
      to_status: 'open',
      transition_reason: trimmedReason,
    },
    retentionClass: 'regulatory',
  });

  revalidatePath('/staff/accounting/period-close');
  revalidatePath('/staff/accounting');
  return { success: true };
}
