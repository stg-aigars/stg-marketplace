import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { disputeOrder } from '@/lib/services/order-transitions';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireAuth();
  if (response) return response;

  try {
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // No body is fine
    }

    const order = await disputeOrder(params.id, user.id, reason);

    return NextResponse.json({
      success: true,
      order: { id: order.id, status: order.status },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to dispute order';
    console.error('[Orders] Dispute failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
