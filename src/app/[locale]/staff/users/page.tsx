import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge, NavTabs, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/date-utils';
import { getCountryName } from '@/lib/country-utils';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { TRADER_THRESHOLDS } from '@/lib/seller/trader-thresholds';

export const metadata: Metadata = {
  title: 'Users — Staff',
};

// 80% of the verification trigger — sellers approaching but not yet crossed.
// Computed from TRADER_THRESHOLDS so re-tuning the trigger keeps the cohort coherent.
const APPROACHING_FRACTION = 0.8;
const APPROACHING_SALES_FLOOR = Math.ceil(
  TRADER_THRESHOLDS.verificationTrigger.salesCount * APPROACHING_FRACTION,
);
const APPROACHING_REVENUE_FLOOR = Math.ceil(
  TRADER_THRESHOLDS.verificationTrigger.revenueCents * APPROACHING_FRACTION,
);

type Cohort =
  | 'action_needed'
  | 'awaiting_response'
  | 'approaching'
  | 'settled'
  | 'suspended';

const ALL_COHORTS: ReadonlyArray<{ key: Cohort; label: string }> = [
  { key: 'action_needed', label: 'Action needed' },
  { key: 'awaiting_response', label: 'Awaiting response' },
  { key: 'approaching', label: 'Approaching' },
  { key: 'settled', label: 'Settled' },
  { key: 'suspended', label: 'Suspended' },
] as const;

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  country: string | null;
  seller_status: string | null;
  completed_sales_12mo_count: number | null;
  completed_sales_12mo_revenue_cents: number | null;
  trader_signal_first_crossed_at: string | null;
  verification_requested_at: string | null;
  verification_response: string | null;
  verification_responded_at: string | null;
  trader_signal_dismissed_at: string | null;
}

const SELECT_COLS =
  'id, full_name, email, country, seller_status, completed_sales_12mo_count, completed_sales_12mo_revenue_cents, trader_signal_first_crossed_at, verification_requested_at, verification_response, verification_responded_at, trader_signal_dismissed_at';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCohortFilter(query: any, cohort: Cohort) {
  switch (cohort) {
    case 'action_needed':
      return query
        .not('trader_signal_first_crossed_at', 'is', null)
        .is('trader_signal_dismissed_at', null)
        .or('verification_requested_at.is.null,verification_response.eq.unresponsive');
    case 'awaiting_response':
      return query
        .not('verification_requested_at', 'is', null)
        .is('verification_response', null);
    case 'approaching':
      return query
        .is('trader_signal_first_crossed_at', null)
        .or(
          `completed_sales_12mo_count.gte.${APPROACHING_SALES_FLOOR},completed_sales_12mo_revenue_cents.gte.${APPROACHING_REVENUE_FLOOR}`,
        );
    case 'settled':
      return query.or(
        'verification_response.eq.collector,trader_signal_dismissed_at.not.is.null',
      );
    case 'suspended':
      return query.eq('seller_status', 'suspended');
  }
}

interface UsersPageProps {
  searchParams: Promise<{ cohort?: string; q?: string }>;
}

export default async function StaffUsersPage(props: UsersPageProps) {
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const searchParams = await props.searchParams;
  const cohort: Cohort = ALL_COHORTS.find((c) => c.key === searchParams.cohort)?.key ?? 'action_needed';
  const cohortLabel = ALL_COHORTS.find((c) => c.key === cohort)?.label.toLowerCase() ?? '';
  const q = (searchParams.q ?? '').trim();

  // Parallel: counts for every cohort (drives tab badges) + active cohort data.
  const countQueries = ALL_COHORTS.map((c) =>
    applyCohortFilter(
      serviceClient.from('user_profiles').select('id', { count: 'exact', head: true }),
      c.key,
    ),
  );

  let activeQuery = applyCohortFilter(
    serviceClient.from('user_profiles').select(SELECT_COLS),
    cohort,
  );

  if (q.length > 0) {
    // Escape ilike wildcards (% and _), then wrap the whole value in PostgREST
    // double quotes so commas / parens / dots in the search input don't break
    // the .or() filter delimiter (comma) or its grouping syntax. Inner double
    // quotes are escaped per PostgREST's quoting rules.
    const safe = q.replace(/[%_]/g, '\\$&').replace(/"/g, '\\"');
    const pattern = `"%${safe}%"`;
    activeQuery = activeQuery.or(
      `full_name.ilike.${pattern},email.ilike.${pattern},country.ilike.${pattern}`,
    );
  }

  activeQuery = activeQuery.order('trader_signal_first_crossed_at', { ascending: false, nullsFirst: false }).limit(200);

  const [countResults, activeResult] = await Promise.all([
    Promise.all(countQueries),
    activeQuery,
  ]);

  const counts = new Map<Cohort, number>(
    ALL_COHORTS.map((c, i) => [c.key, countResults[i]?.count ?? 0]),
  );

  const users = ((activeResult.data ?? []) as unknown as UserRow[]);

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-4">
        Users
      </h1>

      <form className="mb-4" action="/staff/users" method="get">
        <input type="hidden" name="cohort" value={cohort} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name / email / country"
          className="w-full sm:max-w-md px-3 py-2 border border-semantic-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-semantic-brand"
        />
      </form>

      <NavTabs
        tabs={ALL_COHORTS.map((c) => ({
          key: c.key,
          label: `${c.label} (${counts.get(c.key) ?? 0})`,
          href: `/staff/users?cohort=${c.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
        }))}
        activeTab={cohort}
        variant="pill"
        className="mb-6"
      />

      {users.length === 0 ? (
        <EmptyState title={q ? `No users match "${q}" in the ${cohortLabel} cohort.` : `No users in the ${cohortLabel} cohort.`} />
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <Link key={user.id} href={`/staff/users/${user.id}`}>
              <Card hoverable>
                <CardBody className="py-3 px-4">
                  <UserRowSummary user={user} cohort={cohort} />
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function UserRowSummary({ user, cohort }: { user: UserRow; cohort: Cohort }) {
  const countryLabel = user.country ? getCountryName(user.country) : '—';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-semantic-text-heading truncate">
          {user.full_name ?? 'Unknown'}
        </p>
        <p className="text-xs text-semantic-text-muted truncate">
          {user.email ?? '—'} · {countryLabel}
        </p>
      </div>
      <CohortContext user={user} cohort={cohort} />
    </div>
  );
}

function CohortContext({ user, cohort }: { user: UserRow; cohort: Cohort }) {
  const sales = user.completed_sales_12mo_count ?? 0;
  const revenue = formatCentsToCurrency(user.completed_sales_12mo_revenue_cents ?? 0);

  switch (cohort) {
    case 'action_needed': {
      const isUnresponsive = user.verification_response === 'unresponsive';
      const crossedAt = user.trader_signal_first_crossed_at;
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-semantic-text-muted">
          <span>{sales} sales · {revenue}</span>
          {crossedAt ? <span>· crossed {formatDate(crossedAt)}</span> : null}
          {isUnresponsive ? (
            <Badge variant="error" dot>Unresponsive</Badge>
          ) : (
            <Badge variant="warning" dot>Verify</Badge>
          )}
        </div>
      );
    }
    case 'awaiting_response': {
      const requestedAt = user.verification_requested_at
        ? new Date(user.verification_requested_at)
        : null;
      const daysWaiting = requestedAt
        // eslint-disable-next-line react-hooks/purity -- Server Component: Date.now() is safe at request time
        ? Math.floor((Date.now() - requestedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const daysLeft = Math.max(0, TRADER_THRESHOLDS.verificationResponseDeadlineDays - daysWaiting);
      const overdue = daysLeft === 0;
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-semantic-text-muted">
          <span>{sales} sales · {revenue}</span>
          <Badge variant={overdue ? 'error' : 'warning'} dot>
            {overdue ? 'Overdue' : `${daysLeft}d left`}
          </Badge>
        </div>
      );
    }
    case 'approaching': {
      const salesPct = Math.round((sales / TRADER_THRESHOLDS.verificationTrigger.salesCount) * 100);
      const revenuePct = Math.round(
        ((user.completed_sales_12mo_revenue_cents ?? 0) /
          TRADER_THRESHOLDS.verificationTrigger.revenueCents) *
          100,
      );
      const pct = Math.max(salesPct, revenuePct);
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-semantic-text-muted">
          <span>{sales} sales · {revenue}</span>
          <Badge variant="default" dot>{pct}% of trigger</Badge>
        </div>
      );
    }
    case 'settled': {
      const isDismissed = !!user.trader_signal_dismissed_at;
      const isCollector = user.verification_response === 'collector';
      const label = isCollector ? 'Collector' : isDismissed ? 'Dismissed' : 'Settled';
      const variant = isCollector ? 'success' : 'default';
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-semantic-text-muted">
          <span>{sales} sales · {revenue}</span>
          <Badge variant={variant} dot>{label}</Badge>
        </div>
      );
    }
    case 'suspended':
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-semantic-text-muted">
          <span>{sales} sales · {revenue}</span>
          <Badge variant="error" dot>Suspended</Badge>
        </div>
      );
  }
}
