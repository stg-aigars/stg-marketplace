import { ALLOWED_PHOTO_TYPES } from '@/lib/listings/types';

/**
 * Lenient, client-side photo acceptance check used as a fast UX hint in the
 * sell flow. The authoritative gate is server-side magic-byte sniffing
 * (`detectImageType` in `./process.ts`, called from the photo upload route) —
 * this function deliberately errs toward accepting so we never reject a
 * genuinely valid file before it reaches the server.
 *
 * Why this can't just check `file.type`: browsers don't always populate the
 * MIME type. Files chosen via the iOS share-sheet / Files app commonly arrive
 * with `file.type === ''` or `'application/octet-stream'`, even for a plain
 * `.jpeg` from the camera roll. The old `ALLOWED_PHOTO_TYPES.includes(file.type)`
 * check rejected those outright. When the browser gives us nothing useful we
 * fall back to the file extension instead.
 *
 * NOTE: keep this module free of server-only imports (e.g. `sharp` from
 * `./process.ts`) so it stays safe to bundle into the client sell flow.
 */

/**
 * Extensions for every supported format. Includes both `jpg` and `jpeg`, and
 * mirrors the formats in `ALLOWED_PHOTO_TYPES`. Used only as the fallback when
 * the browser supplies no usable MIME type.
 */
const ALLOWED_PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif'];

/**
 * MIME values that mean "the browser doesn't know" — treat as a signal to fall
 * back to the extension rather than as a rejection.
 */
const UNINFORMATIVE_MIME_TYPES = ['', 'application/octet-stream'];

export function isAcceptablePhotoCandidate(file: { type: string; name: string }): boolean {
  const type = file.type.toLowerCase();

  // Trust an explicit, recognized image MIME type when the browser provides one.
  if (ALLOWED_PHOTO_TYPES.includes(type)) {
    return true;
  }

  // Browser gave us an empty / generic type — fall back to the file extension.
  if (UNINFORMATIVE_MIME_TYPES.includes(type)) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return ALLOWED_PHOTO_EXTENSIONS.includes(ext);
  }

  // A specific, unrecognized MIME type (e.g. application/pdf, image/gif).
  return false;
}
