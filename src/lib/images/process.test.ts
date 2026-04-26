import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { stripExifMetadata, MAX_PHOTO_DIMENSION } from './process';

/**
 * Helper: generate a synthetic JPEG buffer at the requested dimensions.
 * Uses a solid-color image — content doesn't matter, dimensions do.
 */
async function makeJpegBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .jpeg()
    .toBuffer();
}

describe('stripExifMetadata', () => {
  describe('resize cap', () => {
    it('caps the long edge of an oversized landscape JPEG', async () => {
      const input = await makeJpegBuffer(4032, 3024);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(MAX_PHOTO_DIMENSION);
    });

    it('caps the long edge of an oversized portrait JPEG', async () => {
      const input = await makeJpegBuffer(3024, 4032);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(MAX_PHOTO_DIMENSION);
    });

    it('preserves aspect ratio when resizing', async () => {
      const input = await makeJpegBuffer(4032, 3024);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      // 4:3 aspect ratio should be preserved within rounding tolerance
      expect(meta.width! / meta.height!).toBeCloseTo(4032 / 3024, 2);
    });

    it('does not enlarge images already under the cap', async () => {
      const input = await makeJpegBuffer(800, 600);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(800);
      expect(meta.height).toBe(600);
    });

    it('does not enlarge avatar-sized inputs (256px after the avatar route\'s fit:cover resize)', async () => {
      // Regression guard for the avatar pipeline: the avatar route resizes
      // to 256x256 BEFORE calling stripExifMetadata, so the new resize step
      // here must be a no-op for that case. If withoutEnlargement is ever
      // dropped, this test catches it before avatars get silently upscaled.
      const input = await sharp({
        create: { width: 256, height: 256, channels: 3, background: { r: 100, g: 100, b: 100 } },
      })
        .jpeg()
        .toBuffer();
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(256);
      expect(meta.height).toBe(256);
    });

    it('caps PNG inputs the same way as JPEG', async () => {
      const inputPng = await sharp({
        create: { width: 4000, height: 3000, channels: 3, background: { r: 200, g: 200, b: 200 } },
      })
        .png()
        .toBuffer();
      const output = await stripExifMetadata(inputPng, 'image/png');
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(MAX_PHOTO_DIMENSION);
      expect(meta.format).toBe('png'); // format preserved (Phase 4 will change this)
    });
  });

  describe('format preservation', () => {
    it('keeps JPEG output for JPEG input', async () => {
      const input = await makeJpegBuffer(2000, 1500);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(meta.format).toBe('jpeg');
    });
  });
});
