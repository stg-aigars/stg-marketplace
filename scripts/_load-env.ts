/**
 * Side-effect module that loads `.env.local` at evaluation time, BEFORE any
 * `@/lib/*` import that touches `@/lib/env` (which captures `process.env`
 * lazily but synchronously at module-load).
 *
 * Usage: `import './_load-env';` as the FIRST import in any script that
 * uses code from `@/lib/*`. ES module imports are evaluated depth-first in
 * source order, so this file's body (which calls `dotenv.config`) runs
 * before sibling imports' bodies.
 *
 * Without this, scripts importing from `@/lib/services/audit` /
 * `@/lib/supabase` / `@/lib/env` see undefined env vars at module-load time
 * — the script's own `runMain` calls `dotenv.config` *after* imports have
 * already evaluated, which is too late for the captured `env` object.
 *
 * This was discovered during the Phase 0 production backfill (2026-05-09):
 * the engine's `logAuditEvent` fire-and-forget path threw `supabaseUrl is
 * required` for every emit because `@/lib/supabase`'s `createServiceClient`
 * received undefined values from the cached `env` object.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
