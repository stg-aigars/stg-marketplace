import 'server-only';

import { env } from '@/lib/env';

/**
 * PR #5 lifecycle integration feature flag.
 *
 * Reads `ACCOUNTING_ENGINE_ENABLED` from the env (default false). When true,
 * marketplace flows route through the parent RPCs in migration 103 and emit
 * GL entries atomically alongside their existing state writes. When false,
 * the existing flow runs byte-identical to pre-PR-#5 behaviour and no GL
 * entries are emitted.
 *
 * Read once per process at module load (Next.js env semantics) — operator
 * changes require an app server restart, which is intentional: prevents
 * mid-request flag flips from corrupting in-flight transactions. In-flight
 * requests get a consistent answer for their lifetime.
 *
 * Test toggling via `vi.mock('@/lib/accounting/feature-flag', () => ({
 *   isAccountingEngineEnabled: vi.fn(() => true)
 * }))` — do not mutate process.env in tests (Vitest workers can race on it).
 *
 * Cleanup: 4-6 weeks post-cutover, this module + its env entry + every
 * call site's flag check + the legacy OFF-path code get removed in a small
 * cleanup PR. See round-2 brief §11.
 */
export function isAccountingEngineEnabled(): boolean {
  return env.accounting.engineEnabled;
}
