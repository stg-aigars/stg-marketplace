/**
 * Verification escalation cron (Phase 7 of PTAC plan).
 * Runs daily. Flips verification_response to 'unresponsive' for sellers who
 * haven't responded within TRADER_THRESHOLDS.verificationResponseDeadlineDays
 * (14 days at launch) and surfaces them back to the staff dashboard.
 *
 * Idempotent: re-running on the same day does not double-set verification_response
 * because the WHERE clause filters on `verification_response IS NULL`.
 *
 * Coolify cron:
 *   curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/verification-escalation
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { logAuditEvent } from '@/lib/services/audit';
import { TRADER_THRESHOLDS } from '@/lib/seller/trader-thresholds';

interface CronResult {
  escalated: number;
  errors: string[];
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const result: CronResult = { escalated: 0, errors: [] };

  const deadline = new Date();
  deadline.setDate(deadline.getDate() - TRADER_THRESHOLDS.verificationResponseDeadlineDays);

  try {
    const { data: candidates, error } = await supabase
      .from('user_profiles')
      .select('id, verification_requested_at')
      .not('verification_requested_at', 'is', null)
      .is('verification_response', null)
      .lt('verification_requested_at', deadline.toISOString());

    if (error) {
      result.errors.push(`load candidates: ${error.message}`);
      return NextResponse.json({ ok: false, result }, { status: 500 });
    }

    const now = new Date().toISOString();

    for (const candidate of candidates ?? []) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          verification_response: 'unresponsive',
          verification_responded_at: now,
        })
        .eq('id', candidate.id);

      if (updateError) {
        result.errors.push(`escalate ${candidate.id}: ${updateError.message}`);
        continue;
      }

      result.escalated += 1;
      void logAuditEvent({
        actorType: 'cron',
        action: 'seller.verification_unresponsive',
        resourceType: 'user',
        resourceId: candidate.id,
        metadata: {
          requested_at: candidate.verification_requested_at,
          escalation_days: TRADER_THRESHOLDS.verificationResponseDeadlineDays,
        },
      });
    }

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`unexpected: ${message}`);
    return NextResponse.json({ ok: false, result }, { status: 500 });
  }
}
