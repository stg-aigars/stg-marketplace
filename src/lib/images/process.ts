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

  // TIFF: little-endian (II*\0) or big-endian (MM\0*).
  // Covers .tif/.tiff and Adobe DNG raw photos (iPhone ProRAW, Pixel RAW).
  // Callers reject this distinctly so users get "RAW isn't supported"
  // rather than the generic "Invalid file type".
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
    (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A)
  ) {
    return 'image/tiff';
  }

  // ISO BMFF container — "ftyp" at offset 4. The brand at offset 8-11
  // disambiguates the actual format. Without the brand check, every
  // ISO-BMFF file (HEIC, MP4, MOV, 3GP) would be mislabeled as AVIF.
  if (
    buffer[4] === 0x66 && // f
    buffer[5] === 0x74 && // t
    buffer[6] === 0x79 && // y
    buffer[7] === 0x70 // p
  ) {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    // iPhone Photos use heic/heix/mif1; the others cover spec variants we may see.
    // heim/heis are HEVC image-collection brands; hevc/hevx are kept for inputs
    // we've observed in the wild even though they're not in the canonical set.
    if (
      brand === 'heic' ||
      brand === 'heix' ||
      brand === 'heim' ||
      brand === 'heis' ||
      brand === 'hevc' ||
      brand === 'hevx' ||
      brand === 'mif1' ||
      brand === 'msf1'
    ) {
      return 'image/heic';
    }
    return null;
  }

  return null;
}

/**
 * Strip EXIF metadata (GPS, device info), cap long edge, normalize to WebP@90.
 * Sharp auto-detects input format from the buffer's magic bytes, so callers
 * don't pass it. `.rotate()` applies EXIF orientation before stripping it.
 *
 * `limitInputPixels` is a Sharp decode-time gate — exceeded inputs throw
 * before resize runs. Sized at 100 MP to cover modern phone main cameras
 * (iPhone 14/15/16 Pro 48 MP, Pixel 8/9 Pro 50 MP, Samsung Ultra high-res
 * modes up to 50 MP / 108 MP) without forcing users to downscale before
 * upload. The 25 MB request-size cap (MAX_PHOTO_SIZE_BYTES) remains the
 * primary DoS gate; Sharp's library default of ~268 MP stays as the upper
 * guard against pathological inputs.
 */
export async function stripExifMetadata(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { limitInputPixels: 100_000_000 })
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
