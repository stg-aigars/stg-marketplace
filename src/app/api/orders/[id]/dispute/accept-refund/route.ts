import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { sellerAcceptRefund } from '@/lib/services/dispute';
import { RefundInitiationError } from '@/lib/services/order-refund';
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
    const order = await sellerAcceptRefund(params.id, user.id);

    return NextResponse.json({
      success: true,
      order: { id: order.id, status: order.status },
    });
  } catch (error) {
    // Refund initiation failures are upstream/infrastructure — return 503 so
    // monitoring distinguishes them from user-error 400s. The user-facing
    // message is already set on the error itself.
    if (error instanceof RefundInitiationError) {
      console.error('[Orders] Refund initiation failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : 'Failed to accept refund';
    console.error('[Orders] Accept refund failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
