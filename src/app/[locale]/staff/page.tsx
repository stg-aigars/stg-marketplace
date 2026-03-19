import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';

export const metadata: Metadata = {
  title: 'Staff Dashboard',
};

export default async function StaffDashboardPage() {
  const { serviceClient } = await requireServerAuth();

  // Fetch metrics in parallel
  const [ordersResult, revenueResult, pendingWithdrawalsResult] = await Promise.all([
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
  ]);

  const totalOrders = ordersResult.count ?? 0;
  const orders = revenueResult.data ?? [];
  const totalRevenueCents = orders.reduce((sum, o) => sum + (o.total_amount_cents ?? 0), 0);
  const totalCommissionCents = orders.reduce((sum, o) => sum + (o.platform_commission_cents ?? 0), 0);
  const pendingWithdrawals = pendingWithdrawalsResult.data ?? [];
  const pendingWithdrawalCount = pendingWithdrawals.length;
  const pendingWithdrawalAmountCents = pendingWithdrawals.reduce((sum, w) => sum + w.amount_cents, 0);

  const metrics = [
    { label: 'Total orders', value: totalOrders.toString() },
    { label: 'Total revenue', value: formatCentsToCurrency(totalRevenueCents) },
    { label: 'Total commissions', value: formatCentsToCurrency(totalCommissionCents) },
    { label: 'Pending withdrawals', value: `${pendingWithdrawalCount} (${formatCentsToCurrency(pendingWithdrawalAmountCents)})` },
  ];

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        Dashboard
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardBody className="text-center py-6">
              <p className="text-sm text-semantic-text-muted">{metric.label}</p>
              <p className="text-2xl font-bold text-semantic-text-heading mt-1">
                {metric.value}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
