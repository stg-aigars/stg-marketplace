/**
 * Seed Listings Script
 *
 * Creates test listings for beta testing and visual QA.
 * Picks random games from the `games` table and creates listings
 * with varied conditions, prices, and countries.
 *
 * Usage:
 *   npx tsx scripts/seed-listings.ts <user-id>
 *
 * The user-id must be a valid user_profiles.id (UUID).
 * Uses service role client to bypass RLS.
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CONDITIONS = ['like_new', 'very_good', 'good', 'acceptable', 'for_parts'] as const;
const COUNTRIES = ['LV', 'LT', 'EE'] as const;

const DESCRIPTIONS = [
  'Great game, played a handful of times. All components present and in excellent shape.',
  'Played regularly but well cared for. Box has minor shelf wear.',
  'Got this as a gift but it is not our kind of game. Played once.',
  'Moving sale — everything must go. Game is in good condition.',
  'Family favorite but we have upgraded to a newer edition.',
  'Bought the wrong language edition. Components are perfect.',
  'Played at a game night, decided to pass it along.',
  'Kept in smoke-free, pet-free home. All pieces accounted for.',
  'Minor box corner damage from shipping, game itself is perfect.',
  'Complete game with all expansion components sorted and bagged.',
  null, // Some listings without description
  null,
];

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPrice(): number {
  // Random price between 5.00 and 45.00 EUR, rounded to nearest 50 cents
  const euros = 5 + Math.random() * 40;
  return Math.round(euros * 2) * 50; // cents, rounded to nearest 50 cents
}

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('Usage: npx tsx scripts/seed-listings.ts <user-id>');
    console.error('  user-id: UUID of the seller (from user_profiles table)');
    process.exit(1);
  }

  // Verify user exists
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, full_name, country')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error(`User not found: ${userId}`);
    process.exit(1);
  }

  console.log(`Seeding listings for: ${profile.full_name ?? 'Unknown'} (${profile.country})`);

  // Fetch 20 random well-known games (high rating, not expansions)
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, name, year_published')
    .eq('is_expansion', false)
    .not('year_published', 'is', null)
    .gte('year_published', 1995)
    .order('rating', { ascending: false })
    .limit(200);

  if (gamesError || !games || games.length === 0) {
    console.error('No games found in database. Run import-bgg-csv.ts first.');
    process.exit(1);
  }

  // Pick 20 random games from the top 200
  const shuffled = games.sort(() => Math.random() - 0.5).slice(0, 20);

  let created = 0;
  let failed = 0;

  for (const game of shuffled) {
    const country = randomElement(COUNTRIES);
    const condition = randomElement(CONDITIONS);
    const priceCents = randomPrice();
    const description = randomElement(DESCRIPTIONS);

    const { error: insertError } = await supabase.from('listings').insert({
      seller_id: userId,
      bgg_game_id: game.id,
      game_name: game.name,
      game_year: game.year_published,
      version_source: 'manual',
      language: randomElement(['English', 'English', 'English', 'German', 'Latvian', 'Russian']),
      condition,
      price_cents: priceCents,
      description,
      status: 'active',
      photos: [],
      country,
    });

    if (insertError) {
      console.error(`  Failed: ${game.name} — ${insertError.message}`);
      failed++;
    } else {
      console.log(`  Created: ${game.name} (${condition}, ${(priceCents / 100).toFixed(2)} EUR, ${country})`);
      created++;
    }
  }

  console.log(`\nDone: ${created} created, ${failed} failed`);
}

main().catch(console.error);
