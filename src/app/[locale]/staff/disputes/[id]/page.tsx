import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge, BackLink, SectionLink } from '@/components/ui';
import { formatDate } from '@/lib/date-utils';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getDisputeStatusConfig } from '@/lib/orders/constants';
import type { DisputeRow } from '@/lib/orders/types';
import { StaffDisputeActions } from './StaffDisputeActions';

export const metadata: Metadata = {
  title: 'Dispute Detail — Staff',
};

interface DisputeWithRelations extends DisputeRow {
  orders: {
    id: string;
    order_number: string;
    listings: { game_name: string } | null;
  } | null;
  buyer_profile: { full_name: string | null } | null;
  seller_profile: { full_name: string | null } | null;
  resolver_profile: { full_name: string | null } | null;
}


export default async function StaffDisputeDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) { redirect('/'); }

  const { data: dispute } = await serviceClient
    .from('disputes')
    .select(`
      *,
      orders(id, order_number, listings(game_name)),
      buyer_profile:user_profiles!disputes_buyer_id_fkey(full_name),
      seller_profile:user_profiles!disputes_seller_id_fkey(full_name),
      resolver_profile:user_profiles!disputes_resolved_by_fkey(full_name)
    `)
    .eq('id', params.id)
    .single();

  if (!dispute) {
    notFound();
  }

  const typedDispute = dispute as unknown as DisputeWithRelations;
  const status = getDisputeStatusConfig(typedDispute);
  const isResolved = !!typedDispute.resolved_at;

  return (
    <div className="max-w-4xl">
      <BackLink href="/staff/disputes" label="All disputes" />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          Dispute — {typedDispute.orders?.order_number ?? '—'}
        </h1>
        <Badge variant={status.badgeVariant}>{status.label}</Badge>
        <SectionLink
          href={`/staff/audit?resource_type=dispute&resource_id=${typedDispute.id}`}
          className="ml-auto"
        >
          Audit log
        </SectionLink>
      </div>

      <div className="space-y-6">
        {/* Order info */}
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
              Order details
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-semantic-text-muted">Order</dt>
                <dd className="text-semantic-text-primary font-medium">
                  <Link
                    href={`/orders/${typedDispute.order_id}`}
                    className="text-semantic-brand sm:hover:underline"
                  >
                    {typedDispute.orders?.order_number ?? '—'}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-semantic-text-muted">Game</dt>
                <dd className="text-semantic-text-primary">
                  {typedDispute.orders?.listings?.game_name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-semantic-text-muted">Buyer</dt>
                <dd className="text-semantic-text-primary">
                  {typedDispute.buyer_profile?.full_name ?? 'Unknown'}
                </dd>
              </div>
              <div>
                <dt className="text-semantic-text-muted">Seller</dt>
                <dd className="text-semantic-text-primary">
                  {typedDispute.seller_profile?.full_name ?? 'Unknown'}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* Dispute reason */}
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
              Dispute reason
            </h2>
            <p className="text-sm text-semantic-text-primary whitespace-pre-wrap">
              {typedDispute.reason}
            </p>
          </CardBody>
        </Card>

        {/* Photos */}
        {typedDispute.photos && typedDispute.photos.length > 0 && (
          <Card>
            <CardBody>
              <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
                Photos
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {typedDispute.photos.map((url, index) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block aspect-square rounded-lg overflow-hidden border border-semantic-border-subtle"
                  >
                    <Image
                      src={url}
                      alt={`Dispute photo ${index + 1}`}
                      fill
                      sizes="(min-width: 640px) 25vw, 50vw"
                      className="object-cover"
                    />
                  </a>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Timeline */}
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
              Timeline
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-semantic-text-secondary">Opened</span>
                <span className="text-semantic-text-primary">{formatDate(typedDispute.created_at)}</span>
              </div>
              {typedDispute.escalated_at && (
                <div className="flex justify-between">
                  <span className="text-semantic-text-secondary">Escalated</span>
                  <span className="text-semantic-text-primary">{formatDate(typedDispute.escalated_at)}</span>
                </div>
              )}
              {typedDispute.resolved_at && (
                <div className="flex justify-between">
                  <span className="text-semantic-text-secondary">Resolved</span>
                  <span className="text-semantic-text-primary">{formatDate(typedDispute.resolved_at)}</span>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Resolution details (if resolved) */}
        {isResolved && (
          <Card>
            <CardBody>
              <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
                Resolution
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-semantic-text-muted">Decision</dt>
                  <dd>
                    <Badge variant={typedDispute.resolution === 'refunded' ? 'error' : 'success'}>
                      {typedDispute.resolution === 'refunded' ? 'Refunded' : 'No refund'}
                    </Badge>
                  </dd>
                </div>
                {typedDispute.refund_amount_cents != null && typedDispute.refund_amount_cents > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-semantic-text-muted">Refund amount</dt>
                    <dd className="text-semantic-text-primary font-medium">
                      {formatCentsToCurrency(typedDispute.refund_amount_cents)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-semantic-text-muted">Resolved by</dt>
                  <dd className="text-semantic-text-primary">
                    {typedDispute.resolver_profile?.full_name ?? 'System'}
                  </dd>
                </div>
                {typedDispute.resolution_notes && (
                  <div>
                    <dt className="text-semantic-text-muted mb-1">Staff notes</dt>
                    <dd className="p-3 rounded-lg bg-semantic-bg-subtle text-semantic-text-secondary">
                      {typedDispute.resolution_notes}
                    </dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>
        )}

        {/* Resolution controls (if unresolved) */}
        {!isResolved && (
          <Card>
            <CardBody>
              <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
                Resolve dispute
              </h2>
              <StaffDisputeActions orderId={typedDispute.order_id} />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
