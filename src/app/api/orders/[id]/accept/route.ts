import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { acceptOrder } from '@/lib/services/order-transitions';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { response, user } = await requireAuth();
  if (response) return response;

  try {
    const body = await request.json();
    const sellerPhone = body.sellerPhone as string;

    if (!sellerPhone) {
      return NextResponse.json(
        { error: 'Phone number is required to accept an order. Please add your phone number.' },
        { status: 400 }
      );
    }

    const { order, parcelId, barcode, shippingError } = await acceptOrder(params.id, user.id, sellerPhone);

    return NextResponse.json({
      success: true,
      order: { id: order.id, status: order.status },
      parcelId,
      barcode,
      shippingError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to accept order';
    console.error('[Orders] Accept failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
