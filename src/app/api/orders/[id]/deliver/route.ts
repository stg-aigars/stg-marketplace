import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { markDelivered } from '@/lib/services/order-transitions';
import { orderActionLimiter, applyRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const rateLimitError = applyRateLimit(orderActionLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireAuth();
  if (response) return response;

  try {
    const order = await markDelivered(params.id, user.id);

    return NextResponse.json({
      success: true,
      order: { id: order.id, status: order.status },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark as delivered';
    console.error('[Orders] Deliver failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
