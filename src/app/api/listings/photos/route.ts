import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { MAX_PHOTO_SIZE_BYTES, ALLOWED_PHOTO_TYPES } from '@/lib/listings/types';

const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function detectImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // JPEG: starts with FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'image/png';
  }

  // WebP: bytes 0-3 are "RIFF" and bytes 8-11 are "WEBP"
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'image/webp';
  }

  // AVIF: "ftyp" at offset 4
  if (
    buffer[4] === 0x66 && // f
    buffer[5] === 0x74 && // t
    buffer[6] === 0x79 && // y
    buffer[7] === 0x70 // p
  ) {
    return 'image/avif';
  }

  return null;
}

export async function POST(request: Request) {
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

  const extension = EXTENSION_MAP[detectedType] ?? 'jpg';
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('listing-photos')
    .upload(path, buffer, { contentType: detectedType });

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from('listing-photos')
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrl });
}
