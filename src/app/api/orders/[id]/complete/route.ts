import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { completeOrder } from '@/lib/services/order-transitions';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireAuth();
  if (response) return response;

  try {
    const order = await completeOrder(params.id, user.id);

    return NextResponse.json({
      success: true,
      order: { id: order.id, status: order.status },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete order';
    console.error('[Orders] Complete failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
