import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { MAX_PHOTO_SIZE_BYTES, ALLOWED_PHOTO_TYPES } from '@/lib/listings/types';
import { photoUploadLimiter, applyRateLimit } from '@/lib/rate-limit';
import { detectImageType, EXTENSION_MAP, stripExifMetadata } from '@/lib/images/process';

export async function POST(request: Request) {
  const rateLimitError = applyRateLimit(photoUploadLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user, supabase } = await requireAuth();
  if (response) return response;

  // Per-user photo quota: max 100 photos across all listings
  const MAX_USER_PHOTOS = 100;
  const { data: files, error: listError } = await supabase.storage
    .from('listing-photos')
    .list(user.id, { limit: MAX_USER_PHOTOS + 1 });

  if (!listError && files && files.length >= MAX_USER_PHOTOS) {
    return NextResponse.json(
      { error: `Photo limit reached (${MAX_USER_PHOTOS}). Please remove unused photos before uploading new ones.` },
      { status: 400 }
    );
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

  const strippedBuffer = await stripExifMetadata(buffer, detectedType);
  const extension = EXTENSION_MAP[detectedType] ?? 'jpg';
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('listing-photos')
    .upload(path, strippedBuffer, { contentType: detectedType });

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from('listing-photos')
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
