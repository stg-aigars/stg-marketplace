import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { retryOrderShipping } from '@/lib/services/unisend/shipping';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireAuth();
  if (response) return response;

  try {
    const result = await retryOrderShipping(params.id, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      parcelId: result.parcelId,
      barcode: result.barcode,
      trackingUrl: result.trackingUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create shipping';
    console.error('[Orders] Retry shipping failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
