import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Vault, LockKey, CalendarBlank, Scales } from '@phosphor-icons/react/ssr';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import {
  getPeriodRow,
  getRecentJournalEntries,
  getWalletIntegrity,
} from '@/lib/accounting/queries';
import type { PeriodRow } from '@/lib/accounting/types';
import { PeriodStatusBadge } from '@/components/staff/accounting/PeriodStatusBadge';

export const metadata: Metadata = {
  title: 'Accounting — Staff',
};

/** Monthly period_key for today's calendar month (UTC), e.g. '2026-05'. */
function currentMonthlyPeriodKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Truncate a narrative for the recent-activity row without breaking layout. */
function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export default async function AccountingDashboardPage() {
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const currentPeriodKey = currentMonthlyPeriodKey();

  // Inline query for the latest hard-locked monthly period — no helper export
  // needed; this is the only caller in PR #4.
  const [
    currentPeriod,
    walletIntegrity,
    latestHardLockedResult,
    recentEntries,
  ] = await Promise.all([
    getPeriodRow(serviceClient, currentPeriodKey, 'month'),
    getWalletIntegrity(serviceClient),
    serviceClient
      .from('periods')
      .select('*')
      .eq('period_type', 'month')
      .eq('status', 'hard_locked')
      .order('locked_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getRecentJournalEntries(serviceClient, 10),
  ]);

  const latestHardLocked = (latestHardLockedResult.data as PeriodRow | null) ?? null;

  const walletReconciled =
    walletIntegrity.is_reconciled && walletIntegrity.unattributed_gl_cents === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
          Accounting
        </h1>
        <p className="text-sm text-semantic-text-secondary mt-1">
          GL health, period status, and recent journal activity. All figures
          include Phase 0 backfill by default.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1 — Wallet integrity */}
        <Link href="/staff/accounting/wallet-integrity">
          <Card hoverable>
            <CardBody className="text-center py-6">
              <div className="flex items-center justify-center gap-2 text-semantic-text-muted">
                <Vault size={16} />
                <p className="text-sm">Wallet integrity</p>
              </div>
              {walletReconciled ? (
                <p className="text-xl font-bold text-semantic-success mt-2">
                  Reconciled
                </p>
              ) : (
                <>
                  <p className="text-xl font-bold text-semantic-error mt-2">
                    Δ {formatCentsToCurrency(walletIntegrity.delta_cents)}
                  </p>
                  <p className="text-xs text-semantic-text-muted mt-1">
                    Investigate
                  </p>
                </>
              )}
            </CardBody>
          </Card>
        </Link>

        {/* Tile 2 — Current period status */}
        <Link
          href={`/staff/accounting/period-close/?period=${currentPeriodKey}`}
        >
          <Card hoverable>
            <CardBody className="text-center py-6">
              <div className="flex items-center justify-center gap-2 text-semantic-text-muted">
                <CalendarBlank size={16} />
                <p className="text-sm">Current period</p>
              </div>
              {currentPeriod ? (
                <>
                  <p className="text-xl font-bold text-semantic-text-heading mt-2 font-mono">
                    {currentPeriod.period_key}
                  </p>
                  <div className="mt-2 flex justify-center">
                    <PeriodStatusBadge status={currentPeriod.status} />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-semantic-text-heading mt-2">
                    —
                  </p>
                  <p className="text-xs text-semantic-text-muted mt-1">
                    {currentPeriodKey} not seeded
                  </p>
                </>
              )}
            </CardBody>
          </Card>
        </Link>

        {/* Tile 3 — Latest hard-locked period (read-only summary) */}
        <Card>
          <CardBody className="text-center py-6">
            <div className="flex items-center justify-center gap-2 text-semantic-text-muted">
              <LockKey size={16} />
              <p className="text-sm">Latest hard-locked</p>
            </div>
            {latestHardLocked ? (
              <>
                <p className="text-xl font-bold text-semantic-text-heading mt-2 font-mono">
                  {latestHardLocked.period_key}
                </p>
                <p className="text-xs text-semantic-text-muted mt-1 font-mono">
                  {latestHardLocked.locked_at
                    ? latestHardLocked.locked_at.slice(0, 10)
                    : '—'}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-semantic-text-heading mt-2">
                  —
                </p>
                <p className="text-xs text-semantic-text-muted mt-1">
                  No periods hard-locked
                </p>
              </>
            )}
          </CardBody>
        </Card>

        {/* Tile 4 — Trial balance entry-point */}
        <Link href="/staff/accounting/trial-balance">
          <Card hoverable>
            <CardBody className="text-center py-6">
              <div className="flex items-center justify-center gap-2 text-semantic-text-muted">
                <Scales size={16} />
                <p className="text-sm">Trial balance</p>
              </div>
              <p className="text-base font-semibold text-semantic-brand mt-3">
                View as-of trial balance →
              </p>
            </CardBody>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading mb-3">
          Recent activity
        </h2>

        {recentEntries.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-semantic-text-muted">
                No journal entries posted yet.
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody className="px-0 py-0">
              <ul className="divide-y divide-semantic-border-subtle">
                {recentEntries.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/staff/accounting/journal-entry/${entry.id}/`}
                      className="flex flex-col gap-1 px-4 py-3 hover:bg-semantic-surface-subtle transition-colors duration-250 ease-out-custom sm:flex-row sm:items-center sm:gap-4"
                    >
                      <span className="text-xs text-semantic-text-muted font-mono shrink-0 sm:w-44">
                        {entry.created_at.slice(0, 19).replace('T', ' ')}
                      </span>
                      <span className="text-xs font-mono text-semantic-text-primary shrink-0 sm:w-12">
                        {entry.type_id}
                      </span>
                      <span className="text-sm text-semantic-text-heading sm:flex-1 sm:truncate">
                        {truncate(entry.narrative)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
