import sharp from 'sharp';

export const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

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
 * Strip EXIF metadata (GPS location, device info) while preserving orientation.
 * Uses format-specific encoding to avoid silent quality degradation.
 */
export async function stripExifMetadata(buffer: Buffer, mimeType: string): Promise<Buffer> {
  const pipeline = sharp(buffer).rotate();

  switch (mimeType) {
    case 'image/jpeg': return pipeline.jpeg({ quality: 90 }).toBuffer();
    case 'image/png': return pipeline.png().toBuffer();
    case 'image/webp': return pipeline.webp({ quality: 90 }).toBuffer();
    case 'image/avif': return pipeline.avif({ quality: 75 }).toBuffer();
    default: return pipeline.toBuffer();
  }
}
