import { NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { creditBackRejectedWithdrawal } from '@/lib/services/wallet';
import { createServiceClient } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireStaffAuth();
  if (response) return response;

  let action: string;
  let staffNotes: string | undefined;
  try {
    const body = await request.json();
    action = body.action;
    staffNotes = body.staffNotes;

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
