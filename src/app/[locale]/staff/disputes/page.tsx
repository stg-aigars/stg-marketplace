import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge } from '@/components/ui';
import { formatDate } from '@/lib/date-utils';
import { getDisputeStatusConfig } from '@/lib/orders/constants';
import type { DisputeRow } from '@/lib/orders/types';

export const metadata: Metadata = {
  title: 'Disputes — Staff',
};

interface StaffDisputeRow extends DisputeRow {
  orders: {
    order_number: string;
    listings: { game_name: string } | null;
  } | null;
  buyer_profile: { full_name: string | null } | null;
  seller_profile: { full_name: string | null } | null;
}

type FilterTab = 'all' | 'escalated' | 'resolved';

export default async function StaffDisputesPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) { redirect('/'); }

  const activeFilter = (searchParams.filter as FilterTab) || 'all';

  let query = serviceClient
    .from('disputes')
    .select(`
      *,
      orders(order_number, listings(game_name)),
      buyer_profile:user_profiles!disputes_buyer_id_fkey(full_name),
      seller_profile:user_profiles!disputes_seller_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (activeFilter === 'escalated') {
    query = query.not('escalated_at', 'is', null).is('resolved_at', null);
  } else if (activeFilter === 'resolved') {
    query = query.not('resolved_at', 'is', null);
  }

  const { data: disputes } = await query;
  const typedDisputes = (disputes ?? []) as unknown as StaffDisputeRow[];

  const filters: { label: string; value: FilterTab }[] = [
    { label: 'All', value: 'all' },
    { label: 'Escalated', value: 'escalated' },
    { label: 'Resolved', value: 'resolved' },
  ];

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-4">
        Disputes
      </h1>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === 'all' ? '/staff/disputes' : `/staff/disputes?filter=${filter.value}`}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors duration-250 ease-out-custom ${
              activeFilter === filter.value
                ? 'bg-semantic-primary text-semantic-text-inverse border-semantic-primary'
                : 'border-semantic-border-subtle text-semantic-text-secondary sm:hover:bg-semantic-bg-subtle'
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {typedDisputes.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-semantic-text-muted text-center py-8">No disputes found.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {typedDisputes.map((dispute) => {
            const status = getDisputeStatusConfig(dispute);
            return (
              <Link key={dispute.id} href={`/staff/disputes/${dispute.id}`}>
                <Card hoverable>
                  <CardBody className="flex items-center justify-between py-3 px-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-semantic-text-heading">
                          {dispute.orders?.order_number ?? '—'}
                        </span>
                        <Badge variant={status.badgeVariant}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-semantic-text-secondary mt-0.5 truncate">
                        {dispute.orders?.listings?.game_name ?? '—'} · {dispute.buyer_profile?.full_name ?? 'Unknown'} vs {dispute.seller_profile?.full_name ?? 'Unknown'}
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
    </div>
  );
}
