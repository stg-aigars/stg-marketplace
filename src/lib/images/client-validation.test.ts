import { describe, it, expect } from 'vitest';
import { isAcceptablePhotoCandidate, isLikelyRawPhoto } from './client-validation';

describe('isAcceptablePhotoCandidate', () => {
  it('accepts a .jpeg with empty file.type (iOS share-sheet / Files upload)', () => {
    // The original bug: a genuinely valid JPEG arriving with no MIME type.
    expect(isAcceptablePhotoCandidate({ type: '', name: 'IMG_4032.jpeg' })).toBe(true);
  });

  it('accepts a .jpeg reported as application/octet-stream', () => {
    expect(
      isAcceptablePhotoCandidate({ type: 'application/octet-stream', name: 'IMG_4032.jpeg' }),
    ).toBe(true);
  });

  it('accepts a .jpg with empty file.type', () => {
    expect(isAcceptablePhotoCandidate({ type: '', name: 'photo.jpg' })).toBe(true);
  });

  it('accepts an uppercase .JPEG extension', () => {
    expect(isAcceptablePhotoCandidate({ type: '', name: 'PHOTO.JPEG' })).toBe(true);
  });

  it('accepts a .jpeg with the non-standard image/jpg MIME (Windows / some Android)', () => {
    // Regression for the post-#387 report: image/jpg is specific but not in the
    // canonical allowlist, so the empty/octet-stream-only fallback rejected it.
    expect(isAcceptablePhotoCandidate({ type: 'image/jpg', name: 'IMG_4032.jpeg' })).toBe(true);
    expect(isAcceptablePhotoCandidate({ type: 'image/jpg', name: 'photo.jpg' })).toBe(true);
  });

  it('accepts a recognized image MIME type regardless of extension', () => {
    expect(isAcceptablePhotoCandidate({ type: 'image/jpeg', name: 'photo.jpeg' })).toBe(true);
    expect(isAcceptablePhotoCandidate({ type: 'image/png', name: 'photo.png' })).toBe(true);
    expect(isAcceptablePhotoCandidate({ type: 'image/webp', name: 'photo.webp' })).toBe(true);
    expect(isAcceptablePhotoCandidate({ type: 'image/avif', name: 'photo.avif' })).toBe(true);
    expect(isAcceptablePhotoCandidate({ type: 'image/heic', name: 'photo.heic' })).toBe(true);
    expect(isAcceptablePhotoCandidate({ type: 'image/heif', name: 'photo.heif' })).toBe(true);
  });

  it('accepts each supported extension when the MIME type is empty', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif']) {
      expect(isAcceptablePhotoCandidate({ type: '', name: `photo.${ext}` })).toBe(true);
    }
  });

  it('rejects an unsupported extension when the MIME type is empty', () => {
    expect(isAcceptablePhotoCandidate({ type: '', name: 'doc.pdf' })).toBe(false);
    expect(isAcceptablePhotoCandidate({ type: '', name: 'animation.gif' })).toBe(false);
  });

  it('rejects a specific, unsupported MIME type (GIF / PDF)', () => {
    expect(isAcceptablePhotoCandidate({ type: 'image/gif', name: 'animation.gif' })).toBe(false);
    expect(isAcceptablePhotoCandidate({ type: 'application/pdf', name: 'manual.pdf' })).toBe(false);
  });

  it('rejects a file with no extension and no usable MIME type', () => {
    expect(isAcceptablePhotoCandidate({ type: '', name: 'noextension' })).toBe(false);
  });

  it('rejects an Apple ProRAW .dng regardless of MIME type', () => {
    expect(isAcceptablePhotoCandidate({ type: '', name: 'IMG_0814.dng' })).toBe(false);
    expect(isAcceptablePhotoCandidate({ type: 'image/x-adobe-dng', name: 'IMG_0814.dng' })).toBe(false);
  });
});

describe('isLikelyRawPhoto', () => {
  it('flags Apple ProRAW .dng and TIFF as RAW', () => {
    expect(isLikelyRawPhoto({ name: 'IMG_0814.dng' })).toBe(true);
    expect(isLikelyRawPhoto({ name: 'scan.tiff' })).toBe(true);
    expect(isLikelyRawPhoto({ name: 'scan.TIF' })).toBe(true);
  });

  it('flags common camera RAW extensions', () => {
    for (const ext of ['cr2', 'cr3', 'nef', 'arw', 'raf', 'orf', 'rw2', 'raw']) {
      expect(isLikelyRawPhoto({ name: `photo.${ext}` })).toBe(true);
    }
  });

  it('does not flag supported photo formats as RAW', () => {
    for (const name of ['photo.jpeg', 'photo.jpg', 'photo.png', 'photo.webp', 'photo.heic']) {
      expect(isLikelyRawPhoto({ name })).toBe(false);
    }
  });
});
