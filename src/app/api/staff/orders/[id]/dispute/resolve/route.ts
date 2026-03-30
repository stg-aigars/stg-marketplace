import { NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { staffResolveDispute } from '@/lib/services/dispute';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireStaffAuth();
  if (response) return response;

  let decision: 'refund' | 'no_refund';
  let notes: string | undefined;
  try {
    const body = await request.json();
    decision = body.decision;
    notes = body.notes;

    if (!['refund', 'no_refund'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision. Must be "refund" or "no_refund"' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const order = await staffResolveDispute(params.id, user.id, decision, notes);

    return NextResponse.json({
      success: true,
      order: { id: order.id, status: order.status },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve dispute';
    console.error('[Staff] Resolve dispute failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
