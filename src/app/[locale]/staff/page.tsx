import type { Metadata } from 'next';
import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatTime } from '@/lib/date-utils';
import { REFUND_STATUS } from '@/lib/services/order-refund';
import { TRADER_THRESHOLDS } from '@/lib/seller/trader-thresholds';
import { RefreshButton } from './_components/RefreshButton';

export const metadata: Metadata = {
  title: 'Staff Dashboard',
};

// SLA thresholds for "Action needed" rows. Tuned conservatively — staff want
// to see operational backlog before it becomes an audit incident.
const ACTION_SLAS = {
  dsaNoticeOpenHours: 24,
  disputeEscalatedHours: 48,
  withdrawalPendingHours: 48,
} as const;

function hoursAgo(now: number, hours: number): string {
  return new Date(now - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(now: number, days: number): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

export default async function StaffDashboardPage() {
  const { serviceClient } = await requireServerAuth();
  // Server Component: capturing request time once for the action-needed cohort
  // cutoffs and the manual-refresh affordance.
  const refreshedAt = new Date();
  const nowMs = refreshedAt.getTime();

  const dsaNoticeStaleCutoff = hoursAgo(nowMs, ACTION_SLAS.dsaNoticeOpenHours);
  const disputeStaleCutoff = hoursAgo(nowMs, ACTION_SLAS.disputeEscalatedHours);
  const withdrawalStaleCutoff = hoursAgo(nowMs, ACTION_SLAS.withdrawalPendingHours);
  const verificationOverdueCutoff = daysAgo(nowMs, TRADER_THRESHOLDS.verificationResponseDeadlineDays);

  // Fetch metrics + action-needed cohorts in parallel
  const [
    ordersResult,
    revenueResult,
    pendingWithdrawalsResult,
    openDisputesResult,
    escalatedDisputesResult,
    walletBalanceResult,
    refundIssuesResult,
    dsaNoticesStaleResult,
    traderSignalsActionResult,
    verificationsOverdueResult,
    disputesStaleResult,
    withdrawalsStaleResult,
    dac7ActionResult,
  ] = await Promise.all([
    serviceClient
      .from('orders')
      .select('id', { count: 'exact', head: true }),
    serviceClient
      .from('orders')
      .select('total_amount_cents, platform_commission_cents')
      .not('status', 'eq', 'cancelled'),
    serviceClient
      .from('withdrawal_requests')
      .select('amount_cents')
      .eq('status', 'pending'),
    serviceClient
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .is('resolved_at', null),
    serviceClient
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .not('escalated_at', 'is', null)
      .is('resolved_at', null),
    serviceClient
      .rpc('get_total_wallet_balance'),
    serviceClient
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('refund_status', [REFUND_STATUS.FAILED, REFUND_STATUS.PARTIAL]),
    // Action-needed cohorts ───────────────────────────────────────────────────
    serviceClient
      .from('dsa_notices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .lt('created_at', dsaNoticeStaleCutoff),
    serviceClient
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .not('trader_signal_first_crossed_at', 'is', null)
      .is('trader_signal_dismissed_at', null)
      // Mirrors the action_needed cohort filter at /staff/users — covers both
      // "verification not yet sent" and "verification sent, marked unresponsive
      // by the cron after 14d." Without this .or() the panel count drifts below
      // the click-through landing-page count.
      .or('verification_requested_at.is.null,verification_response.eq.unresponsive'),
    serviceClient
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .not('verification_requested_at', 'is', null)
      .is('verification_response', null)
      .lt('verification_requested_at', verificationOverdueCutoff),
    serviceClient
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .not('escalated_at', 'is', null)
      .is('resolved_at', null)
      .lt('escalated_at', disputeStaleCutoff),
    serviceClient
      .from('withdrawal_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('created_at', withdrawalStaleCutoff),
    serviceClient
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .in('dac7_status', ['blocked', 'reminder_sent']),
  ]);

  const totalOrders = ordersResult.count ?? 0;
  const orders = revenueResult.data ?? [];
  const totalRevenueCents = orders.reduce((sum, o) => sum + (o.total_amount_cents ?? 0), 0);
  const totalCommissionCents = orders.reduce((sum, o) => sum + (o.platform_commission_cents ?? 0), 0);
  const pendingWithdrawals = pendingWithdrawalsResult.data ?? [];
  const pendingWithdrawalCount = pendingWithdrawals.length;
  const pendingWithdrawalAmountCents = pendingWithdrawals.reduce((sum, w) => sum + w.amount_cents, 0);
  const openDisputeCount = openDisputesResult.count ?? 0;
  const escalatedDisputeCount = escalatedDisputesResult.count ?? 0;
  const totalWalletBalanceCents = (walletBalanceResult.data as number) ?? 0;
  const refundIssueCount = refundIssuesResult.count ?? 0;

  const actionRows: Array<{ count: number; label: string; href: string; variant: 'warning' | 'error' }> = [
    { count: dsaNoticesStaleResult.count ?? 0, label: `DSA notices open over ${ACTION_SLAS.dsaNoticeOpenHours}h`, href: '/staff/notices', variant: 'error' as const },
    { count: traderSignalsActionResult.count ?? 0, label: 'Trader signals awaiting verification', href: '/staff/users?cohort=action_needed', variant: 'warning' as const },
    { count: verificationsOverdueResult.count ?? 0, label: `Verifications past ${TRADER_THRESHOLDS.verificationResponseDeadlineDays}-day deadline`, href: '/staff/users?cohort=awaiting_response', variant: 'error' as const },
    { count: disputesStaleResult.count ?? 0, label: `Escalated disputes untouched over ${ACTION_SLAS.disputeEscalatedHours}h`, href: '/staff/disputes', variant: 'error' as const },
    { count: refundIssueCount, label: 'Refund issues (failed or partial)', href: '/staff/orders?refund_status=issues', variant: 'error' as const },
    { count: withdrawalsStaleResult.count ?? 0, label: `Withdrawals pending over ${ACTION_SLAS.withdrawalPendingHours}h`, href: '/staff/withdrawals', variant: 'warning' as const },
    { count: dac7ActionResult.count ?? 0, label: 'DAC7 sellers blocked or in reminder', href: '/staff/dac7', variant: 'warning' as const },
  ].filter((row) => row.count > 0);

  const metrics: Array<{ label: string; value: string; href?: string }> = [
    { label: 'Total orders', value: totalOrders.toString() },
    { label: 'Total revenue', value: formatCentsToCurrency(totalRevenueCents) },
    { label: 'Total commissions', value: formatCentsToCurrency(totalCommissionCents) },
    { label: 'Pending withdrawals', value: `${pendingWithdrawalCount} (${formatCentsToCurrency(pendingWithdrawalAmountCents)})` },
    { label: 'Wallet liability', value: formatCentsToCurrency(totalWalletBalanceCents) },
    { label: 'Open disputes', value: openDisputeCount.toString() },
    { label: 'Escalated disputes', value: escalatedDisputeCount.toString() },
    { label: 'Refund issues', value: refundIssueCount.toString(), href: '/staff/orders?refund_status=issues' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
          Overview
        </h1>
        <p className="text-sm text-semantic-text-secondary mt-1">
          Platform health snapshot plus the action-needed cohort across every staff surface.
        </p>
      </div>

      {actionRows.length > 0 && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-semantic-text-heading">
                Action needed
              </h2>
              <div className="flex items-center gap-3 text-xs text-semantic-text-muted">
                <span>Last refreshed {formatTime(refreshedAt)}</span>
                <RefreshButton />
              </div>
            </div>
            <ul className="divide-y divide-semantic-border-subtle">
              {actionRows.map((row) => (
                <li key={row.href}>
                  <Link
                    href={row.href}
                    className="flex items-center justify-between py-2 hover:bg-semantic-surface-subtle rounded px-2 -mx-2"
                  >
                    <span className="text-sm text-semantic-text-heading">{row.label}</span>
                    <Badge variant={row.variant} dot>{row.count}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const body = (
            <CardBody className="text-center py-6">
              <p className="text-sm text-semantic-text-muted">{metric.label}</p>
              <p className="text-2xl font-bold text-semantic-text-heading mt-1">
                {metric.value}
              </p>
            </CardBody>
          );
          if (metric.href) {
            return (
              <Link key={metric.label} href={metric.href}>
                <Card hoverable>{body}</Card>
              </Link>
            );
          }
          return <Card key={metric.label}>{body}</Card>;
        })}
      </div>
    </div>
  );
}
