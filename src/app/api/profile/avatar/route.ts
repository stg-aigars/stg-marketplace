import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { detectImageType, stripExifMetadata, OUTPUT_MIME, OUTPUT_EXTENSION } from '@/lib/images/process';
import { photoUploadLimiter, applyRateLimit } from '@/lib/rate-limit';

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const AVATAR_DIMENSION = 256; // px — cap uploaded images to 256x256
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BUCKET = 'avatars';

function extractStoragePath(avatarUrl: string): string | null {
  // Public URL format: .../storage/v1/object/public/avatars/{userId}/avatar.{ext}
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = avatarUrl.indexOf(marker);
  if (idx === -1) return null;
  return avatarUrl.slice(idx + marker.length);
}

export async function POST(request: Request) {
  const rateLimitError = applyRateLimit(photoUploadLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user, supabase } = await requireAuth();
  if (response) return response;

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum size: 2MB' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectImageType(buffer);

  if (!detectedType || !ALLOWED_TYPES.includes(detectedType)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
      { status: 400 }
    );
  }

  // Resize to cap dimensions, then strip EXIF + normalize to WebP
  const resized = await sharp(buffer)
    .resize(AVATAR_DIMENSION, AVATAR_DIMENSION, { fit: 'cover' })
    .toBuffer();
  const strippedBuffer = await stripExifMetadata(resized);

  // Read current avatar URL before uploading (for old file cleanup)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single();
  const oldPath = profile?.avatar_url ? extractStoragePath(profile.avatar_url) : null;

  // Upload new avatar first — if this fails, the old avatar remains intact
  const path = `${user.id}/avatar.${OUTPUT_EXTENSION}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, strippedBuffer, { contentType: OUTPUT_MIME, upsert: true });

  if (uploadError) {
    console.error('Avatar upload failed:', uploadError);
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const avatarUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id);

  if (updateError) {
    console.error('Failed to update avatar_url:', updateError);
    return NextResponse.json({ error: 'Failed to save avatar' }, { status: 500 });
  }

  // Delete old file after successful upload + DB update (handles extension mismatch)
  if (oldPath && oldPath !== path) {
    await supabase.storage.from(BUCKET).remove([oldPath]);
  }

  return NextResponse.json({ avatarUrl });
}

export async function DELETE(request: Request) {
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user, supabase } = await requireAuth();
  if (response) return response;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single();

  if (profile?.avatar_url) {
    const storagePath = extractStoragePath(profile.avatar_url);
    if (storagePath) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
    }
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ avatar_url: null })
    .eq('id', user.id);

  if (updateError) {
    console.error('Failed to remove avatar_url:', updateError);
    return NextResponse.json({ error: 'Failed to remove avatar' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
