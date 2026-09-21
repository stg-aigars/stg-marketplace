import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createServiceClient } from '@/lib/supabase';

/**
 * Renders the order's drop-off barcode as a scannable QR PNG. Unauthenticated
 * by design — this is fetched as a plain <img> by email clients, which carry
 * no session. Scoped to the order's own stored barcode (not an arbitrary
 * text-to-QR endpoint) to avoid turning this into a generic QR generator;
 * order ids are unguessable UUIDs, and the barcode itself is already sent in
 * plaintext to the seller in the same email this image is embedded in.
 */
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from('orders')
    .select('barcode')
    .eq('id', params.id)
    .single<{ barcode: string | null }>();

  if (!order?.barcode) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const png = await QRCode.toBuffer(order.barcode, { type: 'png', width: 240, margin: 1 });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
