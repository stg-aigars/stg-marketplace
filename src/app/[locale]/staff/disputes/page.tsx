import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge, EmptyState, NavTabs } from '@/components/ui';
import { formatDate } from '@/lib/date-utils';
import { CheckCircle, CaretRight } from '@phosphor-icons/react/ssr';
import { getDisputeStatusConfig } from '@/lib/orders/constants';
import { REFUND_STATUS } from '@/lib/services/order-refund';
import type { DisputeRow } from '@/lib/orders/types';

export const metadata: Metadata = {
  title: 'Disputes — Staff',
};

interface StaffDisputeRow extends DisputeRow {
  orders: {
    order_number: string;
    refund_status: string | null;
    listings: { game_name: string } | null;
  } | null;
  buyer_profile: { full_name: string | null } | null;
  seller_profile: { full_name: string | null } | null;
}

const SELECT = `
  *,
  orders(order_number, refund_status, listings(game_name)),
  buyer_profile:user_profiles!disputes_buyer_id_fkey(full_name),
  seller_profile:user_profiles!disputes_seller_id_fkey(full_name)
`;

const RECENTLY_RESOLVED_DAYS = 7;
// Refund-issues window: only look back this far. Older stuck refunds
// have presumably either been reconciled outside the platform or are
// no longer the operational priority.
const REFUND_ISSUES_LOOKBACK_DAYS = 90;

const COHORTS = ['needs_action', 'awaiting_seller', 'refund_issues', 'recently_resolved'] as const;
type Cohort = typeof COHORTS[number];

interface CohortMeta {
  label: string;
  description: string;
  emptyTitle: string;
  /** Tone for the SLA chip. `urgent` = staff is the actor (red faster);
   *  `normal` = counterparty is the actor (red slower); `none` = no chip. */
  tone: 'urgent' | 'normal' | 'none';
  /** Which timestamp the SLA chip reads against — varies by cohort or
   *  the cohort's meaning silently inverts. */
  chipReference: (d: StaffDisputeRow) => string | null;
}

const COHORT_META: Record<Cohort, CohortMeta> = {
  needs_action: {
    label: 'Needs action',
    description: 'Escalated to staff, not yet resolved. Chip reads how long staff has been ignoring.',
    emptyTitle: 'All caught up',
    tone: 'urgent',
    chipReference: (d) => d.escalated_at ?? d.created_at,
  },
  awaiting_seller: {
    label: 'Awaiting seller',
    description: 'Buyer opened a dispute, ball in the seller\'s court (not escalated, not resolved). Chip reads how long since the dispute was opened.',
    emptyTitle: 'No disputes awaiting a seller response',
    tone: 'normal',
    chipReference: (d) => d.created_at,
  },
  refund_issues: {
    label: 'Refund issues',
    description: `Resolved within the last ${REFUND_ISSUES_LOOKBACK_DAYS} days but the underlying order refund is FAILED or PARTIAL — the decision was made but money didn't move.`,
    emptyTitle: 'No stuck refunds',
    tone: 'urgent',
    chipReference: (d) => d.resolved_at,
  },
  recently_resolved: {
    label: 'Recently resolved',
    description: `Last ${RECENTLY_RESOLVED_DAYS} days, for context. No SLA chip.`,
    emptyTitle: 'No recent resolutions',
    tone: 'none',
    chipReference: () => null,
  },
};

function isCohort(value: string | undefined): value is Cohort {
  return !!value && (COHORTS as readonly string[]).includes(value);
}

export default async function StaffDisputesPage(
  props: { searchParams: Promise<{ cohort?: string }> }
) {
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const searchParams = await props.searchParams;
  const activeCohort: Cohort = isCohort(searchParams.cohort) ? searchParams.cohort : 'needs_action';

  // eslint-disable-next-line react-hooks/purity -- Server Component: Date.now() is safe at request time
  const requestTimeMs = Date.now();
  const recentlyResolvedSince = new Date(requestTimeMs - RECENTLY_RESOLVED_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const refundIssuesLookbackSince = new Date(requestTimeMs - REFUND_ISSUES_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all four cohorts so the tab counts are accurate without
  // forcing a re-render when staff switches tabs. Each query is small
  // and bounded; total cost is similar to the previous stacked layout.
  const [
    needsActionResult,
    awaitingSellerResult,
    resolvedRecentResult,
    resolvedLookbackResult,
  ] = await Promise.all([
    serviceClient
      .from('disputes')
      .select(SELECT)
      .not('escalated_at', 'is', null)
      .is('resolved_at', null)
      .order('escalated_at', { ascending: true })
      .limit(50),
    serviceClient
      .from('disputes')
      .select(SELECT)
      .is('escalated_at', null)
      .is('resolved_at', null)
      .order('created_at', { ascending: true })
      .limit(50),
    serviceClient
      .from('disputes')
      .select(SELECT)
      .gte('resolved_at', recentlyResolvedSince)
      .order('resolved_at', { ascending: false })
      .limit(20),
    // Refund issues — resolved within the lookback window. App-side
    // post-filter on the joined order's refund_status because PostgREST
    // nested-table filters get noisy and the result set is small.
    serviceClient
      .from('disputes')
      .select(SELECT)
      .not('resolved_at', 'is', null)
      .gte('resolved_at', refundIssuesLookbackSince)
      .order('resolved_at', { ascending: true })
      .limit(100),
  ]);

  const needsAction = (needsActionResult.data ?? []) as unknown as StaffDisputeRow[];
  const awaitingSeller = (awaitingSellerResult.data ?? []) as unknown as StaffDisputeRow[];
  const recentlyResolved = (resolvedRecentResult.data ?? []) as unknown as StaffDisputeRow[];
  const refundIssues = ((resolvedLookbackResult.data ?? []) as unknown as StaffDisputeRow[]).filter(
    (d) => d.orders?.refund_status === REFUND_STATUS.FAILED || d.orders?.refund_status === REFUND_STATUS.PARTIAL,
  );

  const cohortRows: Record<Cohort, StaffDisputeRow[]> = {
    needs_action: needsAction,
    awaiting_seller: awaitingSeller,
    refund_issues: refundIssues,
    recently_resolved: recentlyResolved,
  };

  const activeMeta = COHORT_META[activeCohort];
  const activeRows = cohortRows[activeCohort];

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold font-platform tracking-tight text-semantic-text-heading">
          Disputes
        </h1>
        <p className="text-sm text-semantic-text-secondary mt-1">
          Triaged into Needs action, Awaiting seller, Refund issues, and Recently resolved. SLA chips read against the cohort-relevant timestamp.
        </p>
      </div>

      <NavTabs
        tabs={COHORTS.map((cohort) => ({
          key: cohort,
          label: COHORT_META[cohort].label,
          href: cohort === 'needs_action' ? '/staff/disputes' : `/staff/disputes?cohort=${cohort}`,
          count: cohortRows[cohort].length,
          // Surface a warning dot on tabs that contain operationally-urgent
          // rows — staff sees there's work without having to switch tabs.
          attention: COHORT_META[cohort].tone === 'urgent' && cohortRows[cohort].length > 0,
        }))}
        activeTab={activeCohort}
        variant="pill"
        className="mb-4"
      />

      <p className="text-sm text-semantic-text-muted mb-4">{activeMeta.description}</p>

      {activeRows.length === 0 ? (
        <EmptyState icon={CheckCircle} title={activeMeta.emptyTitle} />
      ) : (
        <div className="space-y-2">
          {activeRows.map((dispute) => {
            const status = getDisputeStatusConfig(dispute);
            const chipNode = renderAgeChip(activeMeta.chipReference(dispute), requestTimeMs, activeMeta.tone);
            return (
              <Link key={dispute.id} href={`/staff/disputes/${dispute.id}`}>
                <Card hoverable>
                  <CardBody className="flex items-center justify-between py-3 px-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm text-semantic-text-heading">
                          {dispute.orders?.order_number ?? '—'}
                        </span>
                        <Badge variant={status.badgeVariant}>{status.label}</Badge>
                        {dispute.orders?.refund_status === REFUND_STATUS.FAILED && (
                          <Badge variant="error">refund failed</Badge>
                        )}
                        {dispute.orders?.refund_status === REFUND_STATUS.PARTIAL && (
                          <Badge variant="warning">refund partial</Badge>
                        )}
                        {chipNode}
                      </div>
                      <p className="text-sm text-semantic-text-secondary mt-0.5 truncate">
                        {dispute.orders?.listings?.game_name ?? '—'} ·{' '}
                        {dispute.buyer_profile?.full_name ?? 'Unknown'} vs{' '}
                        {dispute.seller_profile?.full_name ?? 'Unknown'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <p className="text-xs text-semantic-text-muted">
                        {formatDate(dispute.created_at)}
                      </p>
                      <CaretRight size={16} className="text-semantic-text-muted shrink-0" />
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Render an SLA-age chip relative to a reference timestamp. Two tone modes:
 *   - urgent  — green <24h, amber 24–72h, red >72h
 *   - normal  — green <72h, amber 72h–7d, red >7d
 *
 * "Urgent" applies to cohorts where staff intervention is the primary
 * action (Needs action, Refund issues). "Normal" applies to cohorts
 * waiting on counterparty action (Awaiting seller). `none` returns null.
 */
function renderAgeChip(
  reference: string | null,
  nowMs: number,
  mode: 'urgent' | 'normal' | 'none',
): React.ReactNode {
  if (mode === 'none' || !reference) return null;
  const ageMs = nowMs - new Date(reference).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  let variant: 'success' | 'warning' | 'error';
  if (mode === 'urgent') {
    variant = ageHours < 24 ? 'success' : ageHours < 72 ? 'warning' : 'error';
  } else {
    variant = ageHours < 72 ? 'success' : ageHours < 24 * 7 ? 'warning' : 'error';
  }

  const label =
    ageHours < 1 ? '<1h' :
    ageHours < 48 ? `${Math.floor(ageHours)}h` :
    `${Math.floor(ageHours / 24)}d`;

  return <Badge variant={variant}>{label}</Badge>;
}
