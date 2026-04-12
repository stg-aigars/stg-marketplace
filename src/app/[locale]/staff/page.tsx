import type { Metadata } from 'next';
import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { REFUND_STATUS } from '@/lib/services/order-refund';

export const metadata: Metadata = {
  title: 'Staff Dashboard',
};

export default async function StaffDashboardPage() {
  const { serviceClient } = await requireServerAuth();

  // Fetch metrics in parallel
  const [ordersResult, revenueResult, pendingWithdrawalsResult, openDisputesResult, escalatedDisputesResult, walletBalanceResult, refundIssuesResult] = await Promise.all([
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
    <div>
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
