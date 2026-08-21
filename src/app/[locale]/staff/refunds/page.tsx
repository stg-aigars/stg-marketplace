import type { Metadata } from 'next';
import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Alert, Badge, Card, CardBody, EmptyState, NavTabs } from '@/components/ui';
import { CheckCircle } from '@phosphor-icons/react/ssr';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDateTime } from '@/lib/date-utils';
import { REFUND_STATUS } from '@/lib/services/order-refund';
import {
  REFUND_BLOCKED_REASON_LABELS,
  type RefundBlockedReason,
} from '@/lib/payments/refundability';
import { PAGE_HEADING_CLASS } from '@/lib/heading-classes';
import { RecordManualRefundButton } from './RecordManualRefundButton';

export const metadata: Metadata = {
  title: 'Manual refunds — Staff',
};

interface RefundRow {
  id: string;
  order_number: string;
  status: string;
  total_amount_cents: number;
  refund_amount_cents: number | null;
  refund_status: string | null;
  refund_blocked_reason: string | null;
  refund_blocked_at: string | null;
  refunded_at: string | null;
  payment_method: string | null;
  everypay_payment_reference: string | null;
  cancellation_reason: string | null;
  buyer_profile: { full_name: string | null; email: string | null } | null;
}

/** Older than this and the buyer has been waiting long enough to notice. */
const STALE_AFTER_HOURS = 24;

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

function ageLabel(hours: number | null): string {
  if (hours === null) return 'unknown';
  if (hours < 1) return 'under an hour';
  if (hours < 48) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function StaffRefundsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { serviceClient } = await requireServerAuth();
  const tab = searchParams.status === 'resolved' ? 'resolved' : 'pending';

  let query = serviceClient
    .from('orders')
    .select(
      'id, order_number, status, total_amount_cents, refund_amount_cents, refund_status, refund_blocked_reason, refund_blocked_at, refunded_at, payment_method, everypay_payment_reference, cancellation_reason, buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, email)'
    )
    .not('refund_blocked_at', 'is', null)
    .order('refund_blocked_at', { ascending: true })
    .limit(100);

  query =
    tab === 'pending'
      ? query.eq('refund_status', REFUND_STATUS.MANUAL_REQUIRED)
      : query.neq('refund_status', REFUND_STATUS.MANUAL_REQUIRED);

  const { data } = await query;
  const rows = (data ?? []) as unknown as RefundRow[];

  const outstandingCents = rows.reduce(
    (sum, r) => sum + (r.total_amount_cents - (r.refund_amount_cents ?? 0)),
    0
  );

  return (
    <div>
      <div className="mb-4">
        <h1 className={PAGE_HEADING_CLASS}>Manual refunds</h1>
        <p className="text-sm text-semantic-text-secondary mt-1">
          Refunds the payment gateway cannot reverse. Send the money by bank
          transfer, then record it here.
        </p>
      </div>

      <NavTabs
        tabs={[
          { key: 'pending', label: 'Awaiting transfer', href: '/staff/refunds' },
          { key: 'resolved', label: 'Resolved', href: '/staff/refunds?status=resolved' },
        ]}
        activeTab={tab}
        variant="pill"
        className="mb-6"
      />

      {tab === 'pending' && rows.length > 0 && (
        <Alert variant="warning" className="mb-4">
          {rows.length} refund{rows.length === 1 ? '' : 's'} awaiting a bank
          transfer, {formatCentsToCurrency(outstandingCents)} outstanding. The
          buyer&apos;s IBAN is on the Swedbank account statement and on the
          EveryPay dashboard entry for each payment — it is not stored here.
        </Alert>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title={
            tab === 'pending'
              ? 'No refunds awaiting a transfer'
              : 'No resolved manual refunds yet'
          }
          description={
            tab === 'pending'
              ? 'Bank-link refunds that the gateway rejects land here automatically.'
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const outstanding = row.total_amount_cents - (row.refund_amount_cents ?? 0);
            const hours = hoursSince(row.refund_blocked_at);
            const isStale = tab === 'pending' && hours !== null && hours > STALE_AFTER_HOURS;

            return (
              <Card key={row.id}>
                <CardBody className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {tab === 'pending' ? (
                          <Badge variant={isStale ? 'error' : 'warning'}>
                            {isStale ? `Waiting ${ageLabel(hours)}` : 'Awaiting transfer'}
                          </Badge>
                        ) : (
                          <Badge variant="success">Refunded</Badge>
                        )}
                        <Link
                          href={`/staff/orders?q=${encodeURIComponent(row.order_number)}`}
                          className="text-xs font-semibold text-semantic-brand"
                        >
                          {row.order_number}
                        </Link>
                        <span className="text-xs text-semantic-text-muted">
                          {row.payment_method ?? 'unknown method'}
                          {row.cancellation_reason ? ` · ${row.cancellation_reason}` : ''}
                        </span>
                      </div>

                      <p className="text-sm text-semantic-text-heading font-medium">
                        {row.buyer_profile?.full_name ?? 'Unknown buyer'}{' '}
                        <span className="text-semantic-text-muted font-normal">
                          ({row.buyer_profile?.email ?? '—'})
                        </span>
                      </p>

                      <p className="text-sm text-semantic-text-secondary mt-1">
                        {formatCentsToCurrency(outstanding)} to send
                        {(row.refund_amount_cents ?? 0) > 0 && (
                          <> · {formatCentsToCurrency(row.refund_amount_cents ?? 0)} already refunded to wallet</>
                        )}
                      </p>

                      <p className="text-xs text-semantic-text-muted mt-1">
                        {row.refund_blocked_reason
                          ? REFUND_BLOCKED_REASON_LABELS[
                              row.refund_blocked_reason as RefundBlockedReason
                            ] ?? row.refund_blocked_reason
                          : 'Gateway refund rejected'}
                      </p>

                      <p className="text-xs text-semantic-text-muted mt-1">
                        Payment reference:{' '}
                        <code>{row.everypay_payment_reference ?? '—'}</code>
                        {row.refund_blocked_at && (
                          <> · blocked {formatDateTime(row.refund_blocked_at)}</>
                        )}
                        {row.refunded_at && <> · refunded {formatDateTime(row.refunded_at)}</>}
                      </p>
                    </div>

                    {tab === 'pending' && (
                      <RecordManualRefundButton
                        orderId={row.id}
                        orderNumber={row.order_number}
                        amountLabel={formatCentsToCurrency(outstanding)}
                      />
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
