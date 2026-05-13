import { NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { isAccountingEngineEnabled } from '@/lib/accounting/feature-flag';
import { withdrawalCompletionWithGL } from '@/lib/accounting/lifecycle-wraps';
import { PostingComplianceGateError } from '@/lib/accounting/errors';
import { creditBackRejectedWithdrawal } from '@/lib/services/wallet';
import { createServiceClient } from '@/lib/supabase';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireStaffAuth();
  if (response) return response;

  let action: string;
  let staffNotes: string | undefined;
  // Optional bank-side confirmation reference for the outbound SEPA wire.
  // Only consumed by the flag-ON path; lands in the C.4 GL entry's
  // posting_context per commit-10 Q1 Option B (no withdrawal_requests column
  // mutation). Empty / absent → undefined → field skipped in posting_context.
  let bankConfirmationRef: string | undefined;
  try {
    const body = await request.json();
    action = body.action;
    staffNotes = body.staffNotes;
    bankConfirmationRef =
      typeof body.bankConfirmationRef === 'string' && body.bankConfirmationRef.trim().length > 0
        ? body.bankConfirmationRef.trim()
        : undefined;

    if (!['approve', 'reject', 'complete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const withdrawalId = params.id;

  // Fetch current withdrawal
  const { data: withdrawal, error: fetchError } = await serviceClient
    .from('withdrawal_requests')
    .select('*')
    .eq('id', withdrawalId)
    .single();

  if (fetchError || !withdrawal) {
    return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
  }

  // Validate action against current status
  if (action === 'approve' && withdrawal.status !== 'pending') {
    return NextResponse.json({ error: 'Can only approve pending withdrawals' }, { status: 400 });
  }
  if (action === 'reject' && !['pending', 'approved'].includes(withdrawal.status)) {
    return NextResponse.json({ error: 'Can only reject pending or approved withdrawals' }, { status: 400 });
  }
  if (action === 'complete' && withdrawal.status !== 'approved') {
    return NextResponse.json({ error: 'Can only complete approved withdrawals' }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (action === 'approve') {
    // Atomically update status with optimistic lock to prevent races
    const { data: updated } = await serviceClient
      .from('withdrawal_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: now,
        staff_notes: staffNotes ?? withdrawal.staff_notes,
      })
      .eq('id', withdrawalId)
      .eq('status', 'pending') // Optimistic lock — only approve if still pending
      .select('id')
      .single();

    if (!updated) {
      return NextResponse.json({ error: 'Withdrawal status has already changed' }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'reject') {
    // Atomically update status FIRST to prevent double-credit from concurrent rejects
    const { data: updated } = await serviceClient
      .from('withdrawal_requests')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: now,
        staff_notes: staffNotes ?? withdrawal.staff_notes,
      })
      .eq('id', withdrawalId)
      .in('status', ['pending', 'approved']) // Optimistic lock
      .select('id')
      .single();

    if (!updated) {
      return NextResponse.json({ error: 'Withdrawal status has already changed' }, { status: 409 });
    }

    // Credit back the held funds AFTER status is confirmed rejected
    await creditBackRejectedWithdrawal(withdrawalId);

    return NextResponse.json({ success: true });
  }

  if (action === 'complete') {
    // Two-level cutover gate:
    //   - ACCOUNTING_ENGINE_ENABLED=false → legacy path (default)
    //   - flag-ON + withdrawal.is_staff_test=false → legacy path (stage 2
    //     real seller traffic)
    //   - flag-ON + withdrawal.is_staff_test=true → engine path; wrap runs
    //     TS-layer KYC gate via assertPayoutAllowed, parent RPC composes
    //     status flip + completed_at stamp + C.4 emit atomically.
    // Stage 3 transition: drop the `&& withdrawal.is_staff_test` clause so
    // the engine path runs unconditionally. See lifecycle-cutover-runbook.md §4.
    if (isAccountingEngineEnabled() && withdrawal.is_staff_test) {
      try {
        await withdrawalCompletionWithGL(serviceClient, {
          withdrawal_request_id: withdrawalId,
          seller_user_id: withdrawal.user_id,
          withdrawal_cents: withdrawal.amount_cents,
          withdrawal_ref: withdrawal.reference_number,
          seller_iban: withdrawal.bank_iban,
          bank_confirmation_ref: bankConfirmationRef,
          staff_notes: staffNotes,
          staff_user_id: user.id,
          is_staff_test: true,
        });
        return NextResponse.json({ success: true });
      } catch (err) {
        if (err instanceof PostingComplianceGateError) {
          // Compliance gate blocked the payout. The status name is internal;
          // surface the engine's error code (kyc_gate / dac7_blocked /
          // negative_wallet / suspended) so the UI can render a status-aware
          // message rather than a generic 403.
          return NextResponse.json(
            { error: 'Withdrawal blocked by compliance gate', code: err.code },
            { status: 403 }
          );
        }
        if (err instanceof Error) {
          if (err.message.includes('LIFECYCLE:INVALID_WITHDRAWAL_STATUS')) {
            return NextResponse.json(
              { error: 'Withdrawal status has already changed' },
              { status: 409 }
            );
          }
          if (err.message.includes('LIFECYCLE:WITHDRAWAL_NOT_FOUND')) {
            return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
          }
        }
        throw err;
      }
    }

    const { data: updated } = await serviceClient
      .from('withdrawal_requests')
      .update({
        status: 'completed',
        completed_at: now,
        staff_notes: staffNotes ?? withdrawal.staff_notes,
      })
      .eq('id', withdrawalId)
      .eq('status', 'approved') // Optimistic lock
      .select('id')
      .single();

    if (!updated) {
      return NextResponse.json({ error: 'Withdrawal status has already changed' }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
