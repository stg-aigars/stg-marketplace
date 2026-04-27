import sharp from 'sharp';

/**
 * Photo upload resize cap (long edge, in pixels).
 *
 * Applies to every upload that flows through stripExifMetadata — listings
 * and dispute evidence both get capped here; avatars are a no-op because
 * the avatar route pre-resizes to 256×256 before calling this helper.
 * Picked to match a Next deviceSize so /_next/image doesn't have to
 * upscale on browse / lightbox surfaces. See plan at
 * docs/plans/2026-04-25-image-pipeline-phase-1-resize-on-upload.md for
 * the trade-off behind this number.
 */
export const MAX_PHOTO_DIMENSION = 2048;

/**
 * All uploads are normalized to WebP at storage time. PNG inputs typically
 * shrink 3–5×; JPEG inputs shrink modestly; WebP/AVIF inputs round-trip.
 */
export const OUTPUT_MIME = 'image/webp';
export const OUTPUT_EXTENSION = 'webp';

export function detectImageType(buffer: Buffer): string | null {
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

/**
 * Strip EXIF metadata (GPS, device info), cap long edge, normalize to WebP@90.
 * Sharp auto-detects input format from the buffer's magic bytes, so callers
 * don't pass it. `.rotate()` applies EXIF orientation before stripping it.
 */
export async function stripExifMetadata(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { limitInputPixels: 25_000_000 })
    .rotate()
    .resize({
      width: MAX_PHOTO_DIMENSION,
      height: MAX_PHOTO_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 90 })
    .toBuffer();
}
