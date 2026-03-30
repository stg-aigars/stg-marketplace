/**
 * BGG CSV Import Script
 *
 * Imports board game data from BoardGameGeek's CSV export into the `games` table.
 * This populates the game catalog that validates listings against real board games.
 *
 * Usage:
 *   1. Download boardgames_ranks.csv from BGG
 *   2. Place it in the project root
 *   3. Run: npx tsx scripts/import-bgg-csv.ts
 *
 * The script imports: id, name, yearpublished, bayesaverage, is_expansion
 * Additional metadata (images, versions, descriptions) is fetched on-demand
 * from the BGG API when a game is first selected for listing.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import csv from 'csv-parser';

interface CSVRow {
  id: string;
  name: string;
  yearpublished: string;
  bayesaverage: string;
  is_expansion: string;
}

interface Game {
  id: number;
  name: string;
  yearpublished: number | null;
  bayesaverage: number | null;
  is_expansion: boolean;
}

async function main() {
  // Load environment variables
  const envPath = path.join(process.cwd(), '.env.local');
  console.log(`Loading environment from: ${envPath}\n`);

  if (!fs.existsSync(envPath)) {
    console.error(`.env.local not found at: ${envPath}`);
    console.error('Please create .env.local with Supabase credentials\n');
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

  console.log('Starting BGG CSV import...');
  console.log('Importing: id, name, yearpublished, bayesaverage, is_expansion\n');

  // Find and parse CSV
  const csvPath = path.join(process.cwd(), 'boardgames_ranks.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    console.error('Download boardgames_ranks.csv from BGG and place it in the project root');
    process.exit(1);
  }

  const games: Game[] = [];
  let rowCount = 0;
  let parseErrors = 0;

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row: CSVRow) => {
        rowCount++;
        try {
          const game: Game = {
            id: parseInt(row.id),
            name: row.name,
            yearpublished: row.yearpublished ? parseInt(row.yearpublished) : null,
            bayesaverage: row.bayesaverage ? parseFloat(row.bayesaverage) : null,
            is_expansion: row.is_expansion === '1',
          };

          if (!game.id || !game.name) {
            parseErrors++;
            return;
          }

          games.push(game);

          if (rowCount % 10000 === 0) {
            console.log(`Parsed ${rowCount.toLocaleString()} rows...`);
          }
        } catch {
          parseErrors++;
        }
      })
      .on('end', () => {
        console.log(`\nCSV parsing complete:`);
        console.log(`  Total rows: ${rowCount.toLocaleString()}`);
        console.log(`  Valid games: ${games.length.toLocaleString()}`);
        console.log(`  Parse errors: ${parseErrors.toLocaleString()}\n`);
        resolve();
      })
      .on('error', reject);
  });

  if (games.length === 0) {
    throw new Error('No valid games found in CSV file');
  }

  // Insert in batches
  const BATCH_SIZE = 1000;
  const totalBatches = Math.ceil(games.length / BATCH_SIZE);
  let successfulBatches = 0;
  let failedBatches = 0;

  console.log(`Inserting ${totalBatches} batches (${BATCH_SIZE} per batch)...\n`);

  for (let i = 0; i < games.length; i += BATCH_SIZE) {
    const batch = games.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    try {
      const { error } = await supabase.from('games').upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error(`Batch ${batchNum} failed: ${error.message}`);
        failedBatches++;
        continue;
      }

      successfulBatches++;
      if (batchNum % 10 === 0 || batchNum === totalBatches) {
        const pct = ((batchNum / totalBatches) * 100).toFixed(1);
        console.log(`Batch ${batchNum}/${totalBatches} (${pct}%)`);
      }
    } catch (error: unknown) {
      console.error(`Batch ${batchNum} exception: ${error instanceof Error ? error.message : error}`);
      failedBatches++;
    }
  }

  console.log(`\nBatch summary: ${successfulBatches} succeeded, ${failedBatches} failed\n`);

  // Verify
  const { count: totalCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });

  const { count: baseCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('is_expansion', false);

  const { count: expCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('is_expansion', true);

  console.log('Import complete:');
  console.log(`  Total games: ${totalCount?.toLocaleString() || 0}`);
  console.log(`  Base games:  ${baseCount?.toLocaleString() || 0}`);
  console.log(`  Expansions:  ${expCount?.toLocaleString() || 0}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nImport failed:', error.message);
    process.exit(1);
  });
