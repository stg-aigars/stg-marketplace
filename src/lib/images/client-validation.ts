import { ALLOWED_PHOTO_TYPES } from '@/lib/listings/types';

/**
 * Lenient, client-side photo acceptance check used as a fast UX hint in the
 * sell flow. The authoritative gate is server-side magic-byte sniffing
 * (`detectImageType` in `./process.ts`, called from the photo upload route) —
 * this function deliberately errs toward accepting so we never reject a
 * genuinely valid file before it reaches the server.
 *
 * Why this can't trust `file.type`: browsers are unreliable about the MIME
 * type they attach to a selected file. A genuine `.jpeg` from the camera roll
 * can arrive as:
 *   - `''` or `'application/octet-stream'` (iOS share-sheet / Files app), or
 *   - a non-standard but specific value such as `'image/jpg'` (Windows and
 *     some Android builds emit this — note it is NOT the canonical
 *     `image/jpeg`).
 * The old allowlist check (`ALLOWED_PHOTO_TYPES.includes(file.type)`) rejected
 * all of these. So whenever the browser-supplied type is not a recognized
 * image MIME, we fall back to the file extension instead of rejecting — the
 * server is the real arbiter either way.
 *
 * NOTE: keep this module free of server-only imports (e.g. `sharp` from
 * `./process.ts`) so it stays safe to bundle into the client sell flow.
 */

/**
 * Extensions for every supported format. Includes both `jpg` and `jpeg`, and
 * mirrors the formats in `ALLOWED_PHOTO_TYPES`. Used as the fallback whenever
 * the browser-supplied MIME type isn't a recognized image type.
 */
const ALLOWED_PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif'];

export function isAcceptablePhotoCandidate(file: { type: string; name: string }): boolean {
  const type = file.type.toLowerCase();

  // Trust an explicit, recognized image MIME type when the browser provides one.
  if (ALLOWED_PHOTO_TYPES.includes(type)) {
    return true;
  }

  // Otherwise the browser-supplied type is unreliable (empty,
  // application/octet-stream, or a non-standard value like image/jpg) — fall
  // back to the file extension. A genuinely unsupported file (e.g. .gif/.pdf)
  // still fails here, and the server-side magic-byte check is the final gate.
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_PHOTO_EXTENSIONS.includes(ext);
}

/**
 * Camera-RAW extensions (incl. Apple ProRAW `.dng` and TIFF). RAW isn't
 * supported — the server rejects it as RAW and the files are typically far
 * over the size limit — so the sell flow can show precise "turn off ProRAW"
 * copy instead of the generic format error. Detection is extension-only: it's
 * purely for choosing a friendlier message, never the accept gate.
 */
const RAW_PHOTO_EXTENSIONS = ['dng', 'tif', 'tiff', 'cr2', 'cr3', 'nef', 'arw', 'raf', 'orf', 'rw2', 'raw'];

export function isLikelyRawPhoto(file: { name: string }): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return RAW_PHOTO_EXTENSIONS.includes(ext);
}
