import { execSync } from 'child_process';

const CONTAINER = 'supabase_db_stg-marketplace';

export interface DbExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Runs SQL inside the local Supabase Postgres container via `docker exec psql`.
 * Returns the result. Never throws. Use this in tests that ASSERT on an
 * expected error from the SQL itself (e.g. trigger violations).
 *
 * Test-only helper. The caller is responsible for SQL-injection safety —
 * pass test-controlled UUIDs / fixed SQL only. Double quotes in `sql` are
 * shell-escaped; single quotes are passed through (correct psql semantics
 * for SQL string literals).
 */
export function dbExec(sql: string): DbExecResult {
  try {
    const out = execSync(
      `docker exec ${CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "${sql.replace(/"/g, '\\"')}"`,
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return { stdout: out.toString(), stderr: '', code: 0 };
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer; status?: number };
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      code: err.status ?? 1,
    };
  }
}

/**
 * Like dbExec but throws on non-zero exit. Use for setup/teardown SQL where
 * a failure indicates a bug in the test, not an expected outcome.
 */
export function dbExecOrThrow(sql: string): DbExecResult {
  const r = dbExec(sql);
  if (r.code !== 0) {
    throw new Error(`dbExec failed (code ${r.code}): ${r.stderr || r.stdout}`);
  }
  return r;
}
