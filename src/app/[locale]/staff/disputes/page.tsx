import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/date-utils';
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

export default async function StaffDisputesPage() {
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  // eslint-disable-next-line react-hooks/purity -- Server Component: Date.now() is safe at request time
  const requestTimeMs = Date.now();
  const recentlyResolvedSince = new Date(requestTimeMs - RECENTLY_RESOLVED_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const refundIssuesLookbackSince = new Date(requestTimeMs - REFUND_ISSUES_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [
    needsActionResult,
    awaitingSellerResult,
    resolvedRecentResult,
    resolvedLookbackResult,
  ] = await Promise.all([
    // Needs action — escalated, not yet resolved
    serviceClient
      .from('disputes')
      .select(SELECT)
      .not('escalated_at', 'is', null)
      .is('resolved_at', null)
      .order('escalated_at', { ascending: true })
      .limit(50),
    // Awaiting seller — buyer opened, not escalated, not resolved
    serviceClient
      .from('disputes')
      .select(SELECT)
      .is('escalated_at', null)
      .is('resolved_at', null)
      .order('created_at', { ascending: true })
      .limit(50),
    // Recently resolved — last 7 days, newest first
    serviceClient
      .from('disputes')
      .select(SELECT)
      .gte('resolved_at', recentlyResolvedSince)
      .order('resolved_at', { ascending: false })
      .limit(20),
    // Refund issues — resolved disputes within the lookback window where the
    // order's refund_status is FAILED or PARTIAL. The cohort is "decision made
    // but the money didn't actually move," so post-filter on the joined order.
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

  return (
    <div className="space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
        Disputes
      </h1>

      <Section
        title="Needs action"
        description="Escalated to staff, not yet resolved. Chip reads how long staff has been ignoring."
        rows={needsAction}
        chip={(d) => ageChip(d.escalated_at ?? d.created_at, requestTimeMs, 'urgent')}
      />

      <Section
        title="Awaiting seller"
        description="Buyer opened a dispute, ball in the seller's court (not escalated, not resolved). Chip reads how long since the dispute was opened."
        rows={awaitingSeller}
        chip={(d) => ageChip(d.created_at, requestTimeMs, 'normal')}
      />

      <Section
        title="Refund issues"
        description={`Resolved within the last ${REFUND_ISSUES_LOOKBACK_DAYS} days but the underlying order refund is FAILED or PARTIAL — the decision was made but money didn't move.`}
        rows={refundIssues}
        chip={(d) => ageChip(d.resolved_at, requestTimeMs, 'urgent')}
      />

      <Section
        title="Recently resolved"
        description={`Last ${RECENTLY_RESOLVED_DAYS} days, for context. No SLA chip.`}
        rows={recentlyResolved}
        chip={() => null}
      />
    </div>
  );
}

interface SectionProps {
  title: string;
  description: string;
  rows: StaffDisputeRow[];
  chip: (dispute: StaffDisputeRow) => React.ReactNode;
}

function Section({ title, description, rows, chip }: SectionProps) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
          {title}{' '}
          <span className="text-base font-normal text-semantic-text-muted">({rows.length})</span>
        </h2>
        <p className="text-sm text-semantic-text-muted mt-1">{description}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing here" description="" />
      ) : (
        <div className="space-y-2">
          {rows.map((dispute) => {
            const status = getDisputeStatusConfig(dispute);
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
                        {chip(dispute)}
                      </div>
                      <p className="text-sm text-semantic-text-secondary mt-0.5 truncate">
                        {dispute.orders?.listings?.game_name ?? '—'} ·{' '}
                        {dispute.buyer_profile?.full_name ?? 'Unknown'} vs{' '}
                        {dispute.seller_profile?.full_name ?? 'Unknown'}
                      </p>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-xs text-semantic-text-muted">
                        {formatDate(dispute.created_at)}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * Render an age chip relative to a reference timestamp. Two tone modes:
 *   - urgent  — green <24h, amber 24–72h, red >72h
 *   - normal  — green <72h, amber 72h–7d, red >7d
 *
 * "Urgent" applies to cohorts where staff intervention is the primary
 * action (Needs action, Refund issues). "Normal" applies to cohorts
 * waiting on counterparty action (Awaiting seller).
 */
function ageChip(
  reference: string | null,
  nowMs: number,
  mode: 'urgent' | 'normal',
): React.ReactNode {
  if (!reference) return null;
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
