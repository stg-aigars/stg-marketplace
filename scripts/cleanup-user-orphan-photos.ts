import './_load-env';
import { createClient } from '@supabase/supabase-js';

/**
 * One-shot operator cleanup for orphaned listing photos in a SINGLE user's
 * storage folder. Built to unblock a user who hit the per-user 100-photo cap
 * (MAX_USER_PHOTOS in src/app/api/listings/photos/route.ts) with orphaned
 * uploads — photos added in the sell flow but never submitted as a listing.
 *
 * Safety model (mirrors the cleanup-photos cron, but scoped to one user and
 * WITHOUT the 48h grace period):
 *   - "active" photos = every path referenced by any of THIS user's listing
 *     rows (any status). Only `listings.photos` references this bucket
 *     (avatars live in a separate bucket), so this set is authoritative.
 *   - An orphan = a file in `listing-photos/<userId>/` whose path is NOT in
 *     the active set. Anything referenced by a real listing is never touched.
 *
 * DRY-RUN BY DEFAULT. It only deletes when APPLY=1 is set, so you can eyeball
 * the orphan list first.
 *
 * Usage (from repo root, prod creds in .env.local):
 *   USER_EMAIL=aigars@secondturn.games \
 *     pnpm tsx scripts/cleanup-user-orphan-photos.ts            # dry run
 *   USER_EMAIL=aigars@secondturn.games APPLY=1 \
 *     pnpm tsx scripts/cleanup-user-orphan-photos.ts            # delete
 *
 * You may pass USER_ID instead of USER_EMAIL to skip the email lookup.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userEmail = process.env.USER_EMAIL;
const userIdArg = process.env.USER_ID;
const apply = process.env.APPLY === '1';

if (!url || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set them in .env.local (point at PRODUCTION) before running.'
  );
  process.exit(1);
}
if (!userEmail && !userIdArg) {
  console.error('Set USER_EMAIL=... (or USER_ID=...) to identify the target user.');
  process.exit(1);
}

const BUCKET = 'listing-photos';
const STORAGE_PREFIX = `${url}/storage/v1/object/public/${BUCKET}/`;
const PAGE = 1000;

async function main() {
  const supabase = createClient(url!, serviceKey!, {
    auth: { persistSession: false },
  });

  // Resolve the target user id (from USER_ID, or by paging auth users for the
  // email — listUsers is paginated, so walk until found or exhausted).
  let userId = userIdArg ?? '';
  if (!userId) {
    let page = 1;
    for (;;) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const match = data.users.find(
        (u) => u.email?.toLowerCase() === userEmail!.toLowerCase()
      );
      if (match) {
        userId = match.id;
        break;
      }
      if (data.users.length < 200) break;
      page++;
    }
    if (!userId) throw new Error(`No auth user found for email ${userEmail}`);
  }
  console.log(`\nTarget user: ${userEmail ?? '(by id)'} → ${userId}`);
  console.log(`Mode: ${apply ? 'APPLY (will delete)' : 'DRY RUN (no deletes)'}\n`);

  // 1. Build the set of photo paths referenced by this user's listings.
  const activePaths = new Set<string>();
  let listingCount = 0;
  let offset = 0;
  for (;;) {
    const { data: rows, error } = await supabase
      .from('listings')
      .select('photos')
      .eq('seller_id', userId)
      .not('photos', 'is', null)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!rows?.length) break;
    for (const r of rows as { photos: string[] | null }[]) {
      listingCount++;
      for (const photoUrl of r.photos ?? []) {
        activePaths.add(photoUrl.slice(STORAGE_PREFIX.length));
      }
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  console.log(
    `Referenced by ${listingCount} listing row(s): ${activePaths.size} photo path(s) — these are protected.`
  );

  // 2. List every file in this user's storage folder.
  const allFiles: string[] = [];
  let fileOffset = 0;
  for (;;) {
    const { data: files, error } = await supabase.storage
      .from(BUCKET)
      .list(userId, { limit: PAGE, offset: fileOffset });
    if (error) throw error;
    if (!files?.length) break;
    for (const f of files) allFiles.push(`${userId}/${f.name}`);
    if (files.length < PAGE) break;
    fileOffset += PAGE;
  }
  console.log(`Files in storage folder ${userId}/: ${allFiles.length}`);

  // 3. Orphans = stored files not referenced by any listing.
  const orphans = allFiles.filter((p) => !activePaths.has(p));
  console.log(`\nOrphaned (unreferenced) files: ${orphans.length}`);
  for (const p of orphans.slice(0, 20)) console.log(`  ${p}`);
  if (orphans.length > 20) console.log(`  …and ${orphans.length - 20} more`);

  if (orphans.length === 0) {
    console.log('\nNothing to clean up.');
    return;
  }

  if (!apply) {
    console.log(
      `\nDRY RUN — nothing deleted. Re-run with APPLY=1 to delete these ${orphans.length} orphan(s).`
    );
    return;
  }

  // 4. Delete in batches of 100 (Supabase remove() limit-friendly).
  let deleted = 0;
  for (let i = 0; i < orphans.length; i += 100) {
    const batch = orphans.slice(i, i + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) {
      console.error(`Batch delete failed at offset ${i}:`, error.message);
    } else {
      deleted += batch.length;
    }
  }
  console.log(`\nDeleted ${deleted} of ${orphans.length} orphan(s).`);
  console.log(
    `Folder now holds ~${allFiles.length - deleted} file(s) (well under the 100 cap).`
  );
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
