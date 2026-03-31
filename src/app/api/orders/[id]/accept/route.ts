import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { acceptOrder } from '@/lib/services/order-transitions';
import { isBalticPhoneNumber } from '@/lib/phone-utils';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireAuth();
  if (response) return response;

  try {
    const body = await request.json();
    const sellerPhone = body.sellerPhone as string;

    if (!sellerPhone || !isBalticPhoneNumber(sellerPhone)) {
      return NextResponse.json(
        { error: 'Please enter a valid Baltic phone number' },
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
