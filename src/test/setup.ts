import { execSync } from 'child_process';

export function setup() {
  try {
    execSync('supabase status', { stdio: 'pipe' });
  } catch {
    throw new Error(
      'Local Supabase is not running. Run `supabase start` first.'
    );
  }
}

export function teardown() {
  // No-op for now
}
