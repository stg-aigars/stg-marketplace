import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

/**
 * Renders a Unisend drop-off barcode as a scannable QR PNG. Unauthenticated
 * by design — this is fetched as a plain <img> by email clients, which carry
 * no session. Deliberately takes the barcode value directly (no order
 * lookup, no database access) rather than an order id: CLAUDE.md prohibits
 * using the service role from an anon-reachable route to read `orders` (the
 * codebase has already had two production regressions of that exact
 * shape), so this route can't touch that table at all. The `code` param is
 * strictly validated to Unisend's barcode shape (uppercase alphanumeric) so
 * this can't be used as a general "encode arbitrary text/URLs" QR generator
 * hosted on our domain. Hyphens are tolerated (a common separator in
 * shipping codes) even though observed real Unisend barcodes don't use one —
 * `orders.barcode` has no format constraint at the schema level and Unisend
 * is an external API, so this stays tolerant rather than brittle to format
 * drift, without weakening the actual abuse-vector protection (still blocks
 * URLs, HTML, whitespace, lowercase).
 */
const BARCODE_PATTERN = /^[A-Z0-9-]{6,30}$/;

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code');

  if (!code || !BARCODE_PATTERN.test(code)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  const png = await QRCode.toBuffer(code, { type: 'png', width: 240, margin: 1 });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
