/**
 * CLI: Manually finish a stuck account deletion.
 *
 * The account-deletion flow in src/lib/services/account.ts calls
 * supabase.auth.admin.deleteUser() as its final step. That call cascades
 * to user_profiles (CASCADE) which then needs to delete or null out every
 * row that FKs to user_profiles. Many of those FKs are RESTRICT/NO ACTION
 * by design (orders, listings, reviews, wallet_transactions, etc. — kept
 * for tax/legal retention) so the cascade fails and the user is left
 * half-deleted: profile anonymized, but auth.users still alive.
 *
 * This script finishes the job the way the new code path does it:
 *   - Anonymize auth.users.email to a non-PII deleted-marker
 *   - Clear raw_user_meta_data (which can hold OAuth display names)
 *   - Permanently ban the row so future sign-ins are refused
 *
 * Usage:
 *   npx tsx scripts/finish-account-deletion.ts --email user@example.com           # dry run
 *   npx tsx scripts/finish-account-deletion.ts --email user@example.com --apply   # execute
 *   npx tsx scripts/finish-account-deletion.ts --email user@example.com --apply --force
 *     # bypass the user_profiles-is-anonymized safety check (only for known-broken cases)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BAN_DURATION = '876000h'; // ~100 years

async function findUserByEmail(sb: SupabaseClient, email: string) {
  // The admin API has no email-lookup primitive, so paginate listUsers.
  // Early-launch user count is small; one page of 1000 is plenty. We loop
  // defensively in case the platform grows past that.
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const emailIndex = args.indexOf('--email');
  const email = emailIndex >= 0 ? args[emailIndex + 1] : null;
  const apply = args.includes('--apply');
  const force = args.includes('--force');

  if (!email) {
    console.error(
      'Usage: npx tsx scripts/finish-account-deletion.ts --email <user@example.com> [--apply] [--force]'
    );
    process.exit(1);
  }

  // Load .env.local so SUPABASE_SERVICE_ROLE_KEY is available
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error(`.env.local not found at ${envPath}`);
    process.exit(1);
  }
  dotenv.config({ path: envPath });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log(`Project URL: ${supabaseUrl}`);
  console.log(`Mode:        ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Target:      ${email}\n`);

  const sb = createClient(supabaseUrl, serviceRoleKey);

  const user = await findUserByEmail(sb, email);
  if (!user) {
    console.error(`No auth.users row with email = ${email}`);
    process.exit(1);
  }

  console.log('Current auth.users state:');
  console.log(`  id:                     ${user.id}`);
  console.log(`  email:                  ${user.email}`);
  console.log(
    `  banned_until:           ${(user as unknown as { banned_until?: string }).banned_until ?? 'null'}`
  );
  console.log(
    `  user_metadata keys:     ${Object.keys(user.user_metadata ?? {}).join(', ') || '(none)'}`
  );
  console.log(
    `  app_metadata.providers: ${JSON.stringify((user.app_metadata as { providers?: string[] })?.providers ?? [])}`
  );

  const { data: profile, error: profileError } = await sb
    .from('user_profiles')
    .select('full_name, email, phone')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('\nFailed to read user_profiles:', profileError);
    process.exit(1);
  }

  console.log('\nCurrent user_profiles state:');
  console.log(`  full_name: ${profile?.full_name ?? '(no row)'}`);
  console.log(`  email:     ${profile?.email ?? 'null'}`);
  console.log(`  phone:     ${profile?.phone ?? 'null'}`);

  const isAnonymized =
    profile?.full_name === 'Deleted User' && profile.email === null;

  if (!isAnonymized && !force) {
    console.error(
      '\nuser_profiles is NOT in the anonymized state. Refusing to proceed without --force.'
    );
    console.error(
      '(Half-deleted users have user_profiles.full_name = "Deleted User" and email = null.)'
    );
    process.exit(1);
  }

  const newEmail = `deleted-${user.id}@deleted.local`;

  console.log('\nProposed changes to auth.users:');
  console.log(`  email           -> ${newEmail}`);
  console.log(`  user_metadata   -> {}`);
  console.log(`  ban_duration    -> ${BAN_DURATION}`);

  if (!apply) {
    console.log('\nDRY RUN — re-run with --apply to execute.');
    return;
  }

  const { error: updateError } = await sb.auth.admin.updateUserById(user.id, {
    email: newEmail,
    email_confirm: true,
    user_metadata: {},
    ban_duration: BAN_DURATION,
  });

  if (updateError) {
    console.error('\nUpdate failed:', updateError);
    process.exit(1);
  }

  console.log('\nDone. Account is anonymized and banned.');
  console.log('User cannot sign in. Existing access token (if any) expires within ~1 hour.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
