import { describe, it, expect } from 'vitest';
import { isAcceptablePhotoCandidate } from './client-validation';

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
});
