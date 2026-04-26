import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { stripExifMetadata, MAX_PHOTO_DIMENSION } from './process';

async function makeImageBuffer(
  format: 'jpeg' | 'png',
  width: number,
  height: number,
): Promise<Buffer> {
  const base = sharp({
    create: { width, height, channels: 3, background: { r: 128, g: 128, b: 128 } },
  });
  return format === 'png' ? base.png().toBuffer() : base.jpeg().toBuffer();
}

describe('stripExifMetadata', () => {
  describe('resize cap', () => {
    it('caps the long edge of an oversized landscape JPEG', async () => {
      const input = await makeImageBuffer('jpeg', 4032, 3024);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(MAX_PHOTO_DIMENSION);
    });

    it('caps the long edge of an oversized portrait JPEG', async () => {
      const input = await makeImageBuffer('jpeg', 3024, 4032);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(MAX_PHOTO_DIMENSION);
    });

    it('preserves aspect ratio when resizing', async () => {
      const input = await makeImageBuffer('jpeg', 4032, 3024);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(meta.width! / meta.height!).toBeCloseTo(4032 / 3024, 2);
    });

    it('does not enlarge images already under the cap', async () => {
      const input = await makeImageBuffer('jpeg', 800, 600);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(800);
      expect(meta.height).toBe(600);
    });

    it('does not enlarge avatar-sized inputs', async () => {
      // Guard: avatar route pre-resizes to 256 before this helper, so withoutEnlargement must be a no-op here.
      const input = await makeImageBuffer('jpeg', 256, 256);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(256);
      expect(meta.height).toBe(256);
    });

    it('caps PNG inputs the same way as JPEG', async () => {
      const input = await makeImageBuffer('png', 4000, 3000);
      const output = await stripExifMetadata(input, 'image/png');
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(MAX_PHOTO_DIMENSION);
      expect(meta.format).toBe('png');
    });
  });

  describe('format preservation', () => {
    it('keeps JPEG output for JPEG input', async () => {
      const input = await makeImageBuffer('jpeg', 2000, 1500);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(meta.format).toBe('jpeg');
    });
  });
});
