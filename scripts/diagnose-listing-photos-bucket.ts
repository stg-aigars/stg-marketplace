import './_load-env';
import { createClient } from '@supabase/supabase-js';

/**
 * One-shot operator diagnostic for the "Failed to upload photos" production bug.
 *
 * NOT part of the app build/CI — run locally against PRODUCTION with the
 * service-role key to check the three suspects behind the opaque storage 500:
 *   1. bucket allowed_mime_types excludes image/webp (we normalize every
 *      upload to WebP, so a restrictive list 400s every upload)
 *   2. bucket file_size_limit below our output size
 *   3. the INSERT RLS policy on storage.objects for an authenticated user
 *      writing to `${user.id}/...` (migration 005)
 *
 * Usage (from repo root, with prod creds in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     pnpm tsx scripts/diagnose-listing-photos-bucket.ts
 *
 * It performs a REAL upload of a tiny generated WebP to a throwaway path under
 * a `__diagnostic__/` prefix using the service role, then deletes it. The
 * service role bypasses RLS, so a failure there isolates bucket MIME/size
 * config from RLS; an RLS-only failure is called out separately via a note.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set them in .env.local (point at PRODUCTION) before running.'
  );
  process.exit(1);
}

const BUCKET = 'listing-photos';
// Smallest valid WebP this codebase emits is image/webp; a 1x1 lossless WebP.
const TINY_WEBP_BASE64 =
  'UklGRhwAAABXRUJQVlA4TBAAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

async function main() {
  console.log(`\nDiagnosing bucket "${BUCKET}" on ${url}\n`);
  const supabase = createClient(url!, serviceKey!, {
    auth: { persistSession: false },
  });

  // 1. Bucket existence + config (allowed_mime_types, file_size_limit, public)
  const { data: bucket, error: bucketErr } = await supabase.storage.getBucket(BUCKET);
  if (bucketErr || !bucket) {
    console.error('✗ getBucket failed:', bucketErr?.message ?? 'no bucket returned');
    console.error('  → The bucket may not exist in this project. Check the URL/project.');
    process.exit(2);
  }

  console.log('Bucket config:');
  console.log(`  public:            ${bucket.public}`);
  console.log(`  file_size_limit:   ${bucket.file_size_limit ?? '(none)'}`);
  console.log(`  allowed_mime_types:${
    bucket.allowed_mime_types ? ` ${JSON.stringify(bucket.allowed_mime_types)}` : ' (none — all allowed)'
  }`);

  const mimes = bucket.allowed_mime_types;
  if (mimes && !mimes.includes('image/webp')) {
    console.error(
      '\n✗ LIKELY ROOT CAUSE: allowed_mime_types is set and does NOT include "image/webp".'
    );
    console.error(
      '  We normalize every upload to WebP, so every upload 400s. Fix: add "image/webp" ' +
        '(or clear the list) in Storage → bucket settings.'
    );
  } else {
    console.log('\n✓ MIME allowlist permits image/webp (or is unset).');
  }

  // 2. Real upload round-trip with the service role (bypasses RLS, isolates config)
  const probePath = `__diagnostic__/${Date.now()}.webp`;
  const bytes = Buffer.from(TINY_WEBP_BASE64, 'base64');
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(probePath, bytes, { contentType: 'image/webp', upsert: true });

  if (upErr) {
    console.error('\n✗ Service-role WebP upload FAILED:', JSON.stringify(upErr, null, 2));
    console.error(
      '  Since the service role bypasses RLS, this points at bucket config ' +
        '(MIME allowlist / size limit) rather than RLS.'
    );
    process.exit(3);
  }
  console.log(`\n✓ Service-role WebP upload succeeded (${bytes.byteLength} bytes → ${probePath}).`);
  console.log(
    '  → Bucket MIME/size config is fine. If real uploads still fail, the cause is RLS:'
  );
  console.log(
    '    confirm the migration-005 INSERT policy "Authenticated users can upload to own folder"'
  );
  console.log(
    '    exists in prod (bucket_id=listing-photos AND auth.uid()::text = (storage.foldername(name))[1]).'
  );

  // Cleanup
  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([probePath]);
  console.log(rmErr ? `\n(note: cleanup of ${probePath} failed: ${rmErr.message})` : '\n✓ Cleaned up probe object.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
