import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { createServiceClient } from '@/lib/supabase';
import { MAX_PHOTO_SIZE_BYTES, ALLOWED_PHOTO_TYPES } from '@/lib/listings/types';
import { photoUploadLimiter, applyRateLimit } from '@/lib/rate-limit';
import { detectImageType, stripExifMetadata, OUTPUT_MIME, OUTPUT_EXTENSION } from '@/lib/images/process';

export async function POST(request: Request) {
  const rateLimitError = applyRateLimit(photoUploadLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user, supabase } = await requireAuth();
  if (response) return response;

  // Verify user has a delivered order or an open dispute (eligible to upload)
  const serviceClient = createServiceClient();
  const [{ data: eligibleOrder }, { data: existingDispute }] = await Promise.all([
    serviceClient.from('orders').select('id').eq('buyer_id', user.id).eq('status', 'delivered').limit(1).maybeSingle(),
    serviceClient.from('disputes').select('id').eq('buyer_id', user.id).is('resolved_at', null).limit(1).maybeSingle(),
  ]);

  if (!eligibleOrder && !existingDispute) {
    return NextResponse.json({ error: 'No eligible order for dispute photos' }, { status: 403 });
  }

  // Content-Length pre-check to reject obviously oversized requests early
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const length = parseInt(contentLength, 10);
    if (!isNaN(length) && length > MAX_PHOTO_SIZE_BYTES + 1024) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_PHOTO_SIZE_BYTES / (1024 * 1024)}MB` },
        { status: 413 }
      );
    }
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size: ${MAX_PHOTO_SIZE_BYTES / (1024 * 1024)}MB` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectImageType(buffer);

  if (!detectedType || !ALLOWED_PHOTO_TYPES.includes(detectedType)) {
    return NextResponse.json(
      { error: `Invalid file type. Allowed: ${ALLOWED_PHOTO_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  const strippedBuffer = await stripExifMetadata(buffer);
  const path = `${user.id}/${crypto.randomUUID()}.${OUTPUT_EXTENSION}`;

  const { error: uploadError } = await supabase.storage
    .from('dispute-photos')
    .upload(path, strippedBuffer, { contentType: OUTPUT_MIME });

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from('dispute-photos')
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
