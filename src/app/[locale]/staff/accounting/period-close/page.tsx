import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LockKey } from '@phosphor-icons/react/ssr';

import { Alert, Button, Card, CardBody } from '@/components/ui';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getPeriodCloseChecklist } from '@/lib/accounting/checklist';
import { PeriodCloseChecklist } from '@/components/staff/accounting/PeriodCloseChecklist';

export const metadata: Metadata = {
  title: 'Period close — Staff',
};

interface SearchParams {
  period?: string;
}

const PERIOD_KEY_RE = /^\d{4}-\d{2}$/;

// Phase 0 starts here — the seed window in `periods` runs 2025-05 → 2030-12,
// but the checklist is only meaningful from the first month with real activity.
// Hardcoded per Decision: don't roundtrip the periods table for a list this
// stable.
const PERIOD_LIST_START = '2025-07';

/**
 * Current monthly period key in UTC (YYYY-MM). Server time is UTC; ISO month
 * keys are timezone-neutral for staff UI purposes.
 */
function currentMonthKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Build the inclusive month-key range from `start` to `end` (both YYYY-MM).
 * Newest-first ordering — staff most often acts on the most recent open period.
 */
function buildPeriodOptions(start: string, end: string): string[] {
  const [startYear, startMonth] = start.split('-').map((s) => parseInt(s, 10));
  const [endYear, endMonth] = end.split('-').map((s) => parseInt(s, 10));
  const out: string[] = [];
  // Walk forward, then reverse — easier to read than a backward loop.
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out.reverse();
}

/**
 * Add `months` calendar months to a YYYY-MM key.
 */
function addMonths(key: string, months: number): string {
  const [yearStr, monthStr] = key.split('-');
  let y = parseInt(yearStr, 10);
  let m = parseInt(monthStr, 10) + months;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export default async function PeriodClosePage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const searchParams = await props.searchParams;
  const requested = searchParams.period;
  const period =
    requested && PERIOD_KEY_RE.test(requested) ? requested : currentMonthKey();

  // Selector range: Phase 0 start through three months past the current
  // month. Three-month buffer covers staff revisiting a future-month period
  // mid-month without re-querying the seeded `periods` table.
  const periodOptions = buildPeriodOptions(
    PERIOD_LIST_START,
    addMonths(currentMonthKey(), 3),
  );

  let checklist;
  let loadError: string | null = null;
  try {
    checklist = await getPeriodCloseChecklist(serviceClient, period);
  } catch (err) {
    loadError =
      err instanceof Error
        ? err.message
        : 'Could not load period-close checklist.';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <LockKey size={24} className="text-semantic-text-heading" />
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
          Period close
        </h1>
      </div>
      <p className="text-sm text-semantic-text-secondary max-w-2xl">
        Walk the 9-item read-side checklist before transitioning a period
        through <span className="font-mono">open</span> →{' '}
        <span className="font-mono">soft_locked</span> →{' '}
        <span className="font-mono">hard_locked</span>. Soft-lock is reversible
        via the admin escape hatch; hard-lock is permanent.
      </p>

      <Card>
        <CardBody>
          <form method="GET" className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col">
              <label
                htmlFor="period"
                className="block text-sm font-medium text-semantic-text-primary mb-1.5"
              >
                Period
              </label>
              <select
                id="period"
                name="period"
                defaultValue={period}
                className="block min-h-[44px] rounded-lg border border-semantic-border-default px-3 py-2.5 text-base sm:text-sm text-semantic-text-primary bg-semantic-bg-input transition-all duration-250 ease-out-custom focus:outline-none focus:ring-2 focus:ring-semantic-brand/20 focus:border-semantic-brand"
              >
                {periodOptions.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary">
              Load
            </Button>
          </form>
        </CardBody>
      </Card>

      {loadError ? (
        <Alert variant="error" title="Could not load checklist">
          <p className="mt-1 text-semantic-text-primary">{loadError}</p>
          <p className="mt-2 text-semantic-text-secondary">
            Pick a different period from the selector above. Quarterly
            checklists and pre-Phase-0 months are not yet supported.
          </p>
        </Alert>
      ) : checklist ? (
        <PeriodCloseChecklist checklist={checklist} />
      ) : null}
    </div>
  );
}
