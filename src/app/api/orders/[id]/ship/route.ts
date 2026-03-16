import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { markShipped } from '@/lib/services/order-transitions';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { response, user } = await requireAuth();
  if (response) return response;

  try {
    const order = await markShipped(params.id, user.id);

    return NextResponse.json({
      success: true,
      order: { id: order.id, status: order.status },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark as shipped';
    console.error('[Orders] Ship failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
