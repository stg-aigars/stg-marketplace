'use server';

import { revalidatePath } from 'next/cache';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createServiceClient } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/services/audit';
import { aggregateVatByMS, type OrderFinancialData } from '@/lib/vat-aggregation';
import {
  OSS_MEMBER_STATES,
  projectToDeclared,
  quarterContaining,
  type OssDeclaredAmounts,
  type OssMemberState,
} from '@/lib/oss/types';

interface MarkFiledInput {
  /** ISO date (YYYY-MM-DD) — the quarter the staff is recording. */
  quarterStart: string;
  paymentReference?: string;
}

type ActionResult = { success: true; submissionId: string } | { error: string };

/**
 * Record an OSS quarterly submission.
 *
 * Server-side recomputation of `declared_amounts` from orders is load-bearing:
 * the audit row is the regulator-facing artefact, so the values must be
 * authoritative regardless of what the client sent. The form passes only
 * the quarter identifier + payment reference; the server fetches orders,
 * runs aggregateVatByMS({ excludeHomeCountry: 'LV' }), and writes the
 * recomputed projection. A tampered client cannot land different numbers
 * than the orders table actually supports.
 */
export async function recordOssSubmission(input: MarkFiledInput): Promise<ActionResult> {
  const { isStaff, user } = await requireServerAuth();
  if (!isStaff || !user) return { error: 'Not authorized' };

  // Validate the quarter param + recompute the canonical (start, end, deadline) tuple.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.quarterStart);
  if (!match) return { error: 'Invalid quarter identifier.' };
  const probeDate = new Date(`${input.quarterStart}T12:00:00Z`);
  if (Number.isNaN(probeDate.getTime())) return { error: 'Invalid quarter identifier.' };
  const quarter = quarterContaining(probeDate);
  if (quarter.quarterStart !== input.quarterStart) {
    return { error: 'quarterStart must align to a calendar quarter boundary.' };
  }

  const supabase = createServiceClient();

  // Fetch orders within the quarter window — same shape as /staff/oss/page.tsx.
  const quarterStartIso = `${quarter.quarterStart}T00:00:00Z`;
  const quarterEndExclusiveIso = nextDayIso(quarter.quarterEnd);

  const { data: orders } = await supabase
    .from('orders')
    .select('status, seller_country, items_total_cents, shipping_cost_cents, platform_commission_cents, total_amount_cents, commission_net_cents, commission_vat_cents, shipping_net_cents, shipping_vat_cents')
    .gte('created_at', quarterStartIso)
    .lt('created_at', quarterEndExclusiveIso);

  // Recompute the per-MS aggregate server-side. Client-supplied amounts are
  // never trusted — only the quarter identifier + payment reference cross
  // the trust boundary.
  const aggregates = aggregateVatByMS((orders ?? []) as OrderFinancialData[], { excludeHomeCountry: 'LV' });
  const declaredAmounts: OssDeclaredAmounts = {};
  for (const row of aggregates) {
    if (OSS_MEMBER_STATES.includes(row.ms as OssMemberState)) {
      declaredAmounts[row.ms as OssMemberState] = projectToDeclared(row);
    }
  }

  const { data: row, error } = await supabase
    .from('oss_submissions')
    .insert({
      quarter_start: quarter.quarterStart,
      quarter_end: quarter.quarterEnd,
      deadline: quarter.deadline,
      declared_amounts: declaredAmounts,
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
      quarter_start: quarter.quarterStart,
      quarter_end: quarter.quarterEnd,
      declared_amounts: declaredAmounts,
      payment_reference: input.paymentReference?.trim() || null,
      source: 'mark_filed',
    },
    retentionClass: 'regulatory',
  });

  revalidatePath('/staff/oss');
  return { success: true, submissionId: row.id };
}

function nextDayIso(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
