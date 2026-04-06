import Link from 'next/link';
import { Card, CardBody } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';

interface SellerMetricsProps {
  userId: string;
  walletBalanceCents: number;
  activeListings: number;
  completedSales: number;
  positivePct: number;
  ratingCount: number;
}

interface MetricCardProps {
  label: string;
  value: string;
  href: string;
}

function MetricCard({ label, value, href }: MetricCardProps) {
  return (
    <Link href={href}>
      <Card hoverable>
        <CardBody className="py-3 px-4">
          <p className="text-sm text-semantic-text-muted">{label}</p>
          <p className="text-xl font-semibold text-semantic-text-heading mt-0.5">{value}</p>
        </CardBody>
      </Card>
    </Link>
  );
}

export function SellerMetrics({
  userId,
  walletBalanceCents,
  activeListings,
  completedSales,
  positivePct,
  ratingCount,
}: SellerMetricsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <MetricCard
        label="Wallet balance"
        value={formatCentsToCurrency(walletBalanceCents)}
        href="/account/wallet"
      />
      <MetricCard
        label="Active listings"
        value={String(activeListings)}
        href="/account/listings"
      />
      <MetricCard
        label="Completed sales"
        value={String(completedSales)}
        href="/account/orders?tab=sales"
      />
      <MetricCard
        label="Positive rating"
        value={ratingCount > 0 ? `${positivePct}%` : '\u2014'}
        href={`/sellers/${userId}`}
      />
    </div>
  );
}
