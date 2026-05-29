import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { detectImageType, stripExifMetadata, MAX_PHOTO_DIMENSION } from './process';

function isoBmffWithBrand(brand: string): Buffer {
  // 4-byte box size + "ftyp" + 4-byte brand. The size value is cosmetic for the sniffer.
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from('ftyp', 'ascii'),
    Buffer.from(brand, 'ascii'),
  ]);
}

async function makeImageBuffer(
  format: 'jpeg' | 'png' | 'webp' | 'avif',
  width: number,
  height: number,
): Promise<Buffer> {
  const base = sharp({
    create: { width, height, channels: 3, background: { r: 128, g: 128, b: 128 } },
  });
  switch (format) {
    case 'png': return base.png().toBuffer();
    case 'webp': return base.webp().toBuffer();
    case 'avif': return base.avif().toBuffer();
    default: return base.jpeg().toBuffer();
  }
}

describe('detectImageType', () => {
  it('detects JPEG by FF D8 FF prefix', () => {
    const buf = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(8)]);
    expect(detectImageType(buf)).toBe('image/jpeg');
  });

  it('detects PNG by 89 50 4E 47 0D 0A 1A 0A prefix', () => {
    const buf = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      Buffer.alloc(4),
    ]);
    expect(detectImageType(buf)).toBe('image/png');
  });

  it('detects WebP by RIFF + WEBP marker', () => {
    const buf = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP', 'ascii'),
    ]);
    expect(detectImageType(buf)).toBe('image/webp');
  });

  it('detects AVIF by ftyp brand "avif"', () => {
    expect(detectImageType(isoBmffWithBrand('avif'))).toBe('image/avif');
  });

  it('detects AVIF image-sequence brand "avis"', () => {
    expect(detectImageType(isoBmffWithBrand('avis'))).toBe('image/avif');
  });

  it('detects HEIC by ftyp brand "heic" (iPhone Photos default)', () => {
    expect(detectImageType(isoBmffWithBrand('heic'))).toBe('image/heic');
  });

  it('detects HEIC variants heix/hevc/hevx', () => {
    expect(detectImageType(isoBmffWithBrand('heix'))).toBe('image/heic');
    expect(detectImageType(isoBmffWithBrand('hevc'))).toBe('image/heic');
    expect(detectImageType(isoBmffWithBrand('hevx'))).toBe('image/heic');
  });

  it('detects HEIC collection brands heim/heis', () => {
    expect(detectImageType(isoBmffWithBrand('heim'))).toBe('image/heic');
    expect(detectImageType(isoBmffWithBrand('heis'))).toBe('image/heic');
  });

  it('detects HEIF base brands mif1/msf1', () => {
    expect(detectImageType(isoBmffWithBrand('mif1'))).toBe('image/heic');
    expect(detectImageType(isoBmffWithBrand('msf1'))).toBe('image/heic');
  });

  it('returns null for ISO BMFF with unknown brand (e.g. MP4 "isom")', () => {
    // Regression guard: pre-fix logic returned 'image/avif' for any ftyp box.
    expect(detectImageType(isoBmffWithBrand('isom'))).toBeNull();
  });

  it('returns null for ISO BMFF with MOV brand "qt  "', () => {
    expect(detectImageType(isoBmffWithBrand('qt  '))).toBeNull();
  });

  it('detects little-endian TIFF (Intel byte order, used by Adobe DNG)', () => {
    const buf = Buffer.concat([Buffer.from([0x49, 0x49, 0x2A, 0x00]), Buffer.alloc(8)]);
    expect(detectImageType(buf)).toBe('image/tiff');
  });

  it('detects big-endian TIFF (Motorola byte order)', () => {
    const buf = Buffer.concat([Buffer.from([0x4D, 0x4D, 0x00, 0x2A]), Buffer.alloc(8)]);
    expect(detectImageType(buf)).toBe('image/tiff');
  });

  it('returns null for buffers shorter than the minimum header', () => {
    expect(detectImageType(Buffer.from([0xFF, 0xD8]))).toBeNull();
  });

  it('returns null for a GIF header (unsupported format)', () => {
    // "GIF89a"
    const buf = Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(6)]);
    expect(detectImageType(buf)).toBeNull();
  });

  it('returns null for a PDF header (unsupported format)', () => {
    // "%PDF-1.7"
    const buf = Buffer.concat([Buffer.from('%PDF-1.7', 'ascii'), Buffer.alloc(4)]);
    expect(detectImageType(buf)).toBeNull();
  });

  it('returns null for unrecognized content', () => {
    expect(detectImageType(Buffer.alloc(64, 0))).toBeNull();
  });
});

describe('stripExifMetadata', () => {
  describe('resize cap', () => {
    it('caps the long edge of an oversized landscape JPEG', async () => {
      const input = await makeImageBuffer('jpeg', 4032, 3024);
      const output = await stripExifMetadata(input);
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(MAX_PHOTO_DIMENSION);
    });

    it('caps the long edge of an oversized portrait JPEG', async () => {
      const input = await makeImageBuffer('jpeg', 3024, 4032);
      const output = await stripExifMetadata(input);
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(MAX_PHOTO_DIMENSION);
    });

    it('preserves aspect ratio when resizing', async () => {
      const input = await makeImageBuffer('jpeg', 4032, 3024);
      const output = await stripExifMetadata(input);
      const meta = await sharp(output).metadata();
      expect(meta.width! / meta.height!).toBeCloseTo(4032 / 3024, 2);
    });

    it('does not enlarge images already under the cap', async () => {
      const input = await makeImageBuffer('jpeg', 800, 600);
      const output = await stripExifMetadata(input);
      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(800);
      expect(meta.height).toBe(600);
    });

    it('does not enlarge avatar-sized inputs', async () => {
      // Guard: avatar route pre-resizes to 256 before this helper, so withoutEnlargement must be a no-op here.
      const input = await makeImageBuffer('jpeg', 256, 256);
      const output = await stripExifMetadata(input);
      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(256);
      expect(meta.height).toBe(256);
    });

    it('caps PNG inputs the same way as JPEG', async () => {
      const input = await makeImageBuffer('png', 4000, 3000);
      const output = await stripExifMetadata(input);
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(MAX_PHOTO_DIMENSION);
    });
  });

  describe('input pixel cap', () => {
    it('accepts a 48 MP input (iPhone 14/15/16 Pro main camera)', async () => {
      const input = await makeImageBuffer('jpeg', 8064, 6048);
      const output = await stripExifMetadata(input);
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(MAX_PHOTO_DIMENSION);
    });

    it('accepts a 50 MP input (Pixel 8/9 Pro, Samsung Ultra high-res)', async () => {
      const input = await makeImageBuffer('jpeg', 8160, 6120);
      const output = await stripExifMetadata(input);
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(MAX_PHOTO_DIMENSION);
    });
  });

  describe('format normalization', () => {
    it('normalizes JPEG input to WebP', async () => {
      const input = await makeImageBuffer('jpeg', 2000, 1500);
      const output = await stripExifMetadata(input);
      const meta = await sharp(output).metadata();
      expect(meta.format).toBe('webp');
    });

    it('normalizes PNG input to WebP', async () => {
      const input = await makeImageBuffer('png', 2000, 1500);
      const output = await stripExifMetadata(input);
      const meta = await sharp(output).metadata();
      expect(meta.format).toBe('webp');
    });

    it('round-trips WebP input through WebP output', async () => {
      const input = await makeImageBuffer('webp', 2000, 1500);
      const output = await stripExifMetadata(input);
      const meta = await sharp(output).metadata();
      expect(meta.format).toBe('webp');
    });

    it('normalizes AVIF input to WebP', async () => {
      const input = await makeImageBuffer('avif', 2000, 1500);
      const output = await stripExifMetadata(input);
      const meta = await sharp(output).metadata();
      expect(meta.format).toBe('webp');
    });
  });
});
