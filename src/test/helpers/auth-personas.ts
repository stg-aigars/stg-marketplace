// TODO(issue-e): this helper transitively depends on dbExec, which interpolates
// SQL strings (Issue E from PR #1 review). Acceptable for test code with hard-
// coded fixtures; not safe for any user-derived input. When dbExec gets
// hardened in a dedicated PR, all callers of this helper need to update
// simultaneously (currently: accounting-schema.test.ts, accounting-readonly-
// ui.test.ts, period-close.test.ts).
import type { SupabaseClient } from '@supabase/supabase-js';
import { dbExecOrThrow } from './db-exec';
import { createTestAnonClient, createTestServiceClient } from './supabase';
import { deleteTestUser } from './factories';

export interface SignedInClientOptions {
  isStaff?: boolean;
  emailPrefix?: string;
}

export interface SignedInClient {
  client: SupabaseClient;
  userId: string;
  email: string;
}

// Hoisted to module scope so create + cleanup share one service client per
// test run (matches the pre-refactor inline behavior in
// accounting-schema.test.ts).
const serviceClient = createTestServiceClient();

/**
 * Creates a test auth user with the given is_staff flag and signs in to
 * return a SupabaseClient bearing the user's JWT.
 *
 * is_staff is gated by a BEFORE UPDATE trigger (migration 036, F5
 * self-promotion guard) that raises regardless of role, so the flip goes
 * through dbExec with session_replication_role='replica' to bypass row
 * triggers. Other display fields go through the standard client.
 */
export async function createSignedInClient(
  opts: SignedInClientOptions = {},
): Promise<SignedInClient> {
  const { isStaff = false, emailPrefix = 'accounting-test' } = opts;

  const ts = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `${emailPrefix}-${ts}-${suffix}@stg-test.local`;
  const password = `TestPassword${ts}!`;

  const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    throw new Error(`createUser failed: ${createErr?.message ?? 'unknown'}`);
  }
  const userId = created.user.id;

  const { error: profileErr } = await serviceClient
    .from('user_profiles')
    .update({ full_name: 'Accounting Test', country: 'LV' })
    .eq('id', userId);
  if (profileErr) throw new Error(`profile update failed: ${profileErr.message}`);

  if (isStaff) {
    dbExecOrThrow(
      `SET session_replication_role='replica'; UPDATE public.user_profiles SET is_staff=true WHERE id='${userId}'; SET session_replication_role='origin';`,
    );
  }

  const userClient = createTestAnonClient();
  const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn failed: ${signInErr.message}`);

  return { client: userClient, userId, email };
}

/**
 * Deletes the auth.users row for a previously-created persona. The
 * user_profiles row cascades via FK. Use in test teardown when running
 * multiple personas in one test; single-persona tests can call
 * deleteTestUser(persona.userId) (from '../helpers/factories') directly.
 */
export async function cleanupSignedInClient(persona: SignedInClient): Promise<void> {
  await deleteTestUser(persona.userId);
}
