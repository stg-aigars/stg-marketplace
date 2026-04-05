import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { extractStoragePath } from '@/lib/listings/storage-utils';

const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000; // 2 hours — covers in-progress uploads
const BATCH_SIZE = 1000;
const DELETE_BATCH_SIZE = 100;
const MAX_DELETIONS = 500;

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  // Build set of all photo paths referenced by any listing (any status)
  const activePhotoPaths = new Set<string>();
  const PAGE_SIZE = 1000;
  let listingOffset = 0;

  while (true) {
    const { data: page, error: listingsError } = await serviceClient
      .from('listings')
      .select('photos')
      .not('photos', 'is', null)
      .not('photos', 'eq', '{}')
      .range(listingOffset, listingOffset + PAGE_SIZE - 1);

    if (listingsError) {
      console.error('[cleanup-photos] Failed to query listings:', listingsError);
      return NextResponse.json({ error: listingsError.message }, { status: 500 });
    }

    if (!page?.length) break;
    for (const l of page) {
      for (const url of l.photos) activePhotoPaths.add(extractStoragePath(url));
    }
    if (page.length < PAGE_SIZE) break;
    listingOffset += PAGE_SIZE;
  }

  // Scan storage bucket for orphaned files
  const orphans: string[] = [];
  let scanned = 0;
  const now = Date.now();

  let folderOffset = 0;
  while (true) {
    const { data: folders } = await serviceClient.storage
      .from('listing-photos')
      .list('', { limit: BATCH_SIZE, offset: folderOffset });
    if (!folders?.length) break;

    for (const folder of folders) {
      let fileOffset = 0;
      while (true) {
        const { data: files } = await serviceClient.storage
          .from('listing-photos')
          .list(folder.name, { limit: BATCH_SIZE, offset: fileOffset });
        if (!files?.length) break;

        for (const file of files) {
          scanned++;
          if (!file.updated_at) continue; // No timestamp — skip (treat as recent)
          const fileAge = now - new Date(file.updated_at).getTime();
          if (fileAge < GRACE_PERIOD_MS) continue;

          const path = `${folder.name}/${file.name}`;
          if (!activePhotoPaths.has(path)) {
            orphans.push(path);
          }
        }

        if (files.length < BATCH_SIZE) break;
        fileOffset += BATCH_SIZE;
      }
    }

    if (folders.length < BATCH_SIZE) break;
    folderOffset += BATCH_SIZE;
  }

  // Delete orphans with safety cap
  if (orphans.length > MAX_DELETIONS) {
    console.warn(
      `[cleanup-photos] ${orphans.length} orphans found, capping at ${MAX_DELETIONS}. Investigate if unexpected.`
    );
  }
  const toDelete = orphans.slice(0, MAX_DELETIONS);

  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += DELETE_BATCH_SIZE) {
    const batch = toDelete.slice(i, i + DELETE_BATCH_SIZE);
    const { error } = await serviceClient.storage
      .from('listing-photos')
      .remove(batch);
    if (error) {
      console.error('[cleanup-photos] Batch delete failed:', error);
    } else {
      deleted += batch.length;
    }
  }

  if (deleted > 0) {
    console.log(`[cleanup-photos] Deleted ${deleted} orphaned photos (scanned ${scanned})`);
  }

  return NextResponse.json({ scanned, orphans: orphans.length, deleted });
}
