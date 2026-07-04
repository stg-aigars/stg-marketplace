import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { MAX_PHOTO_SIZE_BYTES, ALLOWED_PHOTO_TYPES } from '@/lib/listings/types';
import { photoUploadLimiter, applyRateLimit } from '@/lib/rate-limit';
import { detectImageType, stripExifMetadata, OUTPUT_MIME, OUTPUT_EXTENSION } from '@/lib/images/process';
import { withStorageRetry } from '@/lib/storage/retry';
import * as Sentry from '@sentry/nextjs';

export async function POST(request: Request) {
  const rateLimitError = applyRateLimit(photoUploadLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user, supabase } = await requireAuth();
  if (response) return response;

  // Per-user photo quota: total photos across ALL of a user's listings. This
  // is a coarse abuse guard, not a per-listing limit — an active multi-listing
  // seller legitimately accumulates many photos (47 listings ≈ 98 photos hit
  // the old cap of 100). 500 gives real headroom (~250 listings) while staying
  // under storage.list()'s ~1000-row response cap, so `limit: MAX + 1` still
  // reliably detects the over-limit case in a single call.
  const MAX_USER_PHOTOS = 500;
  // Retry the quota check on a transient Storage pool-exhaustion blip — a
  // failed list() here otherwise drops the gate silently (see below).
  const { data: files, error: listError } = await withStorageRetry(() =>
    supabase.storage.from('listing-photos').list(user.id, { limit: MAX_USER_PHOTOS + 1 })
  );

  if (listError) {
    // A failing storage.list() usually means the storage client/session itself
    // is broken (so the upload below will fail too) — report it rather than
    // silently skipping the quota gate. Don't fail the request here; let the
    // upload surface the authoritative error.
    console.error('Listing-photo quota check failed:', listError);
    Sentry.captureException(listError, {
      tags: { scope: 'listing-photo-quota-check' },
      extra: { userId: user.id },
    });
  } else if (files && files.length >= MAX_USER_PHOTOS) {
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

  // TIFF/DNG = RAW photos (iPhone ProRAW, Pixel RAW). Reject with specific copy
  // so the seller knows to shoot in HEIC/JPEG instead of the generic allowlist hint.
  if (detectedType === 'image/tiff') {
    return NextResponse.json(
      { error: 'RAW (DNG/TIFF) photos aren’t supported. Please upload a JPEG or HEIC from your camera roll.' },
      { status: 400 }
    );
  }

  if (!detectedType || !ALLOWED_PHOTO_TYPES.includes(detectedType)) {
    return NextResponse.json(
      { error: 'Unsupported image format. Please upload a JPEG, PNG, WebP, AVIF or HEIC photo.' },
      { status: 400 }
    );
  }

  let strippedBuffer: Buffer;
  try {
    strippedBuffer = await stripExifMetadata(buffer);
  } catch (err) {
    // Sharp throws on unsupported codecs (e.g. HEIC on a build without an HEVC
    // decoder) and on inputs exceeding limitInputPixels. Return a clean 400
    // rather than letting the throw surface as a generic 500.
    console.error('Photo processing failed:', err);
    return NextResponse.json(
      { error: 'Couldn’t process this photo. Try a different photo, or save it as JPEG before uploading.' },
      { status: 400 }
    );
  }
  const path = `${user.id}/${crypto.randomUUID()}.${OUTPUT_EXTENSION}`;

  // Retry the upload on a transient Storage pool-exhaustion blip. A burst of
  // concurrent uploads can momentarily exhaust the Storage service's own
  // Postgres pool (STG-MARKETPLACE-1J); it clears in well under a second.
  const { error: uploadError, attempts: uploadAttempts } = await withStorageRetry(() =>
    supabase.storage.from('listing-photos').upload(path, strippedBuffer, { contentType: OUTPUT_MIME })
  );

  if (uploadError) {
    // Surface the Supabase StorageError to Sentry (queryable) + Coolify stdout —
    // without this, every storage failure is an opaque 500 with no diagnostic
    // trail. The extra fields make RLS / bucket-config / size causes
    // distinguishable. Only genuine failures reach here: a transient blip that
    // recovers on retry returns error: null and never logs (cuts 1J noise).
    console.error('Listing-photo storage upload failed:', uploadError);
    Sentry.captureException(uploadError, {
      tags: { scope: 'listing-photo-upload' },
      extra: {
        userId: user.id,
        detectedType,
        contentType: OUTPUT_MIME,
        outputBytes: strippedBuffer.byteLength,
        attempts: uploadAttempts,
        retriesExhausted: uploadAttempts > 1,
      },
    });
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from('listing-photos')
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
