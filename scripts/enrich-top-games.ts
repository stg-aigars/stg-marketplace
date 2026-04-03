/**
 * Batch Enrichment Script — Top Games by BGG Rating
 *
 * Fetches full metadata (alternate names, thumbnails, descriptions, etc.)
 * from the BGG API for the top N unenriched games by Bayesian average rating.
 * This makes alternate/localized names searchable before users organically list them.
 *
 * Usage:
 *   npx tsx scripts/enrich-top-games.ts              # default: 1000 games
 *   npx tsx scripts/enrich-top-games.ts --count 10   # test with 10 games
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fetchBatchMetadata } from '../src/lib/bgg/api';

const BGG_BATCH_SIZE = 20;
const DELAY_BETWEEN_BATCHES_MS = 200;

function parseArgs(): { count: number } {
  const args = process.argv.slice(2);
  let count = 1000;

  const countIdx = args.indexOf('--count');
  if (countIdx !== -1 && args[countIdx + 1]) {
    const parsed = parseInt(args[countIdx + 1]);
    if (!isNaN(parsed) && parsed > 0) count = parsed;
  }

  return { count };
}

async function main() {
  const { count } = parseArgs();

  // Load environment variables
  const envPath = path.join(process.cwd(), '.env.local');

  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found. Please create it with Supabase credentials.');
    process.exit(1);
  }

  dotenv.config({ path: envPath });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log(`Fetching top ${count} unenriched games by BGG rating...\n`);

  // Get unenriched game IDs sorted by rating
  const { data: games, error } = await supabase
    .from('games')
    .select('id')
    .is('metadata_fetched_at', null)
    .order('bayesaverage', { ascending: false, nullsFirst: false })
    .limit(count);

  if (error) {
    console.error('Failed to fetch games:', error.message);
    process.exit(1);
  }

  if (!games || games.length === 0) {
    console.log('No unenriched games found. All top games already have metadata.');
    return;
  }

  const gameIds = games.map((g) => g.id as number);
  console.log(`Found ${gameIds.length} games to enrich.\n`);

  let enriched = 0;
  let withAlternateNames = 0;
  let failed = 0;

  // Process in batches of BGG_BATCH_SIZE
  for (let i = 0; i < gameIds.length; i += BGG_BATCH_SIZE) {
    const chunk = gameIds.slice(i, i + BGG_BATCH_SIZE);
    const batchNum = Math.floor(i / BGG_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(gameIds.length / BGG_BATCH_SIZE);

    try {
      const metadataMap = await fetchBatchMetadata(chunk);

      // Write each game's metadata to the DB
      for (const [id, metadata] of metadataMap) {
        const { error: updateError } = await supabase
          .from('games')
          .update({
            ...metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          console.error(`  Error updating game ${id}: ${updateError.message}`);
          failed++;
        } else {
          enriched++;
          if (metadata.alternate_names && metadata.alternate_names.length > 0) {
            withAlternateNames++;
          }
        }
      }

      // Log progress every 50 games or on last batch
      if (enriched % 50 < BGG_BATCH_SIZE || i + BGG_BATCH_SIZE >= gameIds.length) {
        console.log(`Batch ${batchNum}/${totalBatches} — ${enriched} enriched, ${withAlternateNames} with alternate names`);
      }
    } catch (err) {
      console.error(`Batch ${batchNum} failed:`, err instanceof Error ? err.message : err);
      failed += chunk.length;
    }

    // Rate limit delay between batches
    if (i + BGG_BATCH_SIZE < gameIds.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  console.log(`\nDone.`);
  console.log(`  Enriched: ${enriched}`);
  console.log(`  With alternate names: ${withAlternateNames}`);
  console.log(`  Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
