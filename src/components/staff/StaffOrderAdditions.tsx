import Link from 'next/link';
import {
  CreditCard,
  EnvelopeSimple,
  Info,
  Phone,
  User,
  Warning,
} from '@phosphor-icons/react/ssr';
import { Alert, Card, CardBody, ConditionBadge, SectionLink } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDateTime } from '@/lib/date-utils';
import { REFUND_STATUS } from '@/lib/services/order-refund';
import type { OrderWithDetails, DisputeRow } from '@/lib/orders/types';
import type { ListingCondition } from '@/lib/listings/types';

export interface RefundAuditEntry {
  created_at: string;
  actor_type: string;
  metadata: {
    cardRefunded?: number;
    walletRefunded?: number;
    totalRefunded?: number;
    refundStatus?: string;
    expectedTotal?: number;
  } | null;
}

interface StaffOrderAdditionsProps {
  order: OrderWithDetails;
  dispute: DisputeRow | null;
  refundAuditEntries: RefundAuditEntry[];
}

export function StaffOrderAdditions({
  order,
  dispute,
  refundAuditEntries,
}: StaffOrderAdditionsProps) {
  const refundStatus = order.refund_status;
  const refundEscalated = refundStatus && refundStatus !== REFUND_STATUS.COMPLETED;
  const refundFailed = refundStatus === REFUND_STATUS.FAILED;
  // Show barcode here only for non-accepted statuses; OrderDetailClient's
  // BarcodeCard already covers accepted (the seller-action context).
  const showBarcode = order.barcode && order.status !== 'accepted';

  return (
    <div className="space-y-4">
      {refundEscalated && (
        <Alert
          variant={refundFailed ? 'error' : 'warning'}
          icon={<Warning size={20} />}
          title={`Refund ${refundStatus}`}
        >
          <p>
            {refundFailed
              ? 'No refund was processed. Resolve manually via EveryPay merchant portal (card) or direct wallet credit, then update refund_status in SQL.'
              : 'Refund was partially processed. Reconcile the shortfall manually.'}
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-semantic-text-muted">Expected total</dt>
            <dd className="text-semantic-text-primary font-medium">
              {formatCentsToCurrency(order.total_amount_cents)}
            </dd>
            <dt className="text-semantic-text-muted">Refunded</dt>
            <dd className="text-semantic-text-primary font-medium">
              {formatCentsToCurrency(order.refund_amount_cents ?? 0)}
            </dd>
            {order.refund_amount_cents != null && order.refund_amount_cents < order.total_amount_cents && (
              <>
                <dt className="text-semantic-text-muted">Shortfall</dt>
                <dd className="text-semantic-error font-semibold">
                  {formatCentsToCurrency(order.total_amount_cents - order.refund_amount_cents)}
                </dd>
              </>
            )}
            {order.refunded_at && (
              <>
                <dt className="text-semantic-text-muted">Last attempt</dt>
                <dd className="text-semantic-text-primary">
                  {formatDateTime(order.refunded_at)}
                </dd>
              </>
            )}
          </dl>

          {refundAuditEntries.length > 0 && (
            <div className="mt-3 pt-3 border-t border-semantic-border-subtle">
              <p className="text-xs font-medium text-semantic-text-muted mb-2">
                Refund attempts ({refundAuditEntries.length})
              </p>
              <div className="space-y-1.5 text-xs">
                {refundAuditEntries.map((entry) => (
                  <div key={entry.created_at} className="font-mono">
                    <span className="text-semantic-text-muted">
                      {formatDateTime(entry.created_at)}
                    </span>
                    <span className="text-semantic-text-secondary ml-2">
                      card: {formatCentsToCurrency(entry.metadata?.cardRefunded ?? 0)} ·{' '}
                      wallet: {formatCentsToCurrency(entry.metadata?.walletRefunded ?? 0)}
                      {entry.metadata?.refundStatus && (
                        <span className="ml-2 text-semantic-text-muted">
                          → {entry.metadata.refundStatus}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Alert>
      )}

      {order.status === 'disputed' && dispute?.id && !dispute.resolved_at && (
        <Alert variant="error" icon={<Warning size={20} />} title="Open dispute">
          <div className="flex items-center justify-between gap-4">
            <p>Review claims, then resolve.</p>
            <Link
              href={`/staff/disputes/${dispute.id}`}
              className="text-sm font-medium text-semantic-brand sm:hover:underline shrink-0"
            >
              Resolve dispute
            </Link>
          </div>
        </Alert>
      )}

      {order.status === 'cancelled' && !order.refunded_at && (
        <Alert variant="warning" icon={<Info size={20} />} title="Refund not processed">
          <p>
            This cancelled order has no refund on record. Process via EveryPay dashboard or wait for the reconciliation sweep.
          </p>
        </Alert>
      )}

      {/* Condition recap — order summary uses ListingIdentity which doesn't surface condition */}
      {order.order_items.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
              Item conditions
            </h3>
            <ul className="space-y-2 text-sm">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3">
                  <span className="text-semantic-text-primary truncate">
                    {item.listings?.game_name ?? 'Unknown game'}
                  </span>
                  {item.listings?.condition && (
                    <ConditionBadge condition={item.listings.condition as ListingCondition} />
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* Email and phone — not shown in user view */}
      <Card>
        <CardBody>
          <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
            Contact details
          </h3>
          <div className="space-y-4">
            <ContactBlock
              role="Buyer"
              email={order.buyer_profile?.email}
              phone={order.buyer_phone ?? order.buyer_profile?.phone}
            />
            <div className="border-t border-semantic-border-subtle" />
            <ContactBlock
              role="Seller"
              email={order.seller_profile?.email}
              phone={order.seller_phone ?? order.seller_profile?.phone}
            />
          </div>
        </CardBody>
      </Card>

      {showBarcode && (
        <Card>
          <CardBody>
            <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
              Tracking
            </h3>
            <p className="font-mono text-xs text-semantic-text-primary break-all">
              {order.barcode}
            </p>
            {order.tracking_url && (
              <a
                href={order.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-semantic-brand text-xs sm:hover:underline inline-block mt-1"
              >
                Track shipment
              </a>
            )}
          </CardBody>
        </Card>
      )}

      {/* Staff-only fields — commission split, payment_method, wallet debit, and
          refund amount are already in the seller-view price breakdown. */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-semantic-text-heading">
              <CreditCard size={16} className="inline mr-1.5 -mt-0.5" />
              Payment internals
            </h3>
            <SectionLink href={`/staff/audit?resource_type=order&resource_id=${order.id}`}>
              Audit log
            </SectionLink>
          </div>
          <dl className="space-y-2 text-sm">
            {order.everypay_payment_reference && (
              <div>
                <dt className="text-semantic-text-muted">EveryPay ref</dt>
                <dd className="font-mono text-semantic-text-primary truncate">
                  {order.everypay_payment_reference}
                </dd>
              </div>
            )}
            {order.everypay_payment_state && (
              <div className="flex justify-between">
                <dt className="text-semantic-text-muted">Payment state</dt>
                <dd className="text-semantic-text-primary capitalize">
                  {order.everypay_payment_state}
                </dd>
              </div>
            )}
            {order.seller_wallet_credit_cents != null && order.seller_wallet_credit_cents > 0 && (
              <div className="flex justify-between">
                <dt className="text-semantic-text-muted">Seller credit</dt>
                <dd className="text-semantic-success font-medium">
                  {formatCentsToCurrency(order.seller_wallet_credit_cents)}
                </dd>
              </div>
            )}
            {order.wallet_credited_at && (
              <div className="flex justify-between">
                <dt className="text-semantic-text-muted">Credited at</dt>
                <dd className="text-semantic-text-primary">
                  {formatDateTime(order.wallet_credited_at)}
                </dd>
              </div>
            )}
            {refundStatus && (
              <div className="flex justify-between">
                <dt className="text-semantic-text-muted">Refund status</dt>
                <dd className="text-semantic-text-primary capitalize">
                  {refundStatus}
                </dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

function ContactBlock({
  role,
  email,
  phone,
}: {
  role: string;
  email: string | null | undefined;
  phone: string | null | undefined;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-semantic-text-muted mb-1.5">
        <User size={12} />
        <span className="uppercase tracking-wide">{role}</span>
      </div>
      {email ? (
        <div className="flex items-center gap-1.5 text-sm text-semantic-text-secondary">
          <EnvelopeSimple size={12} className="shrink-0" />
          <span className="truncate">{email}</span>
        </div>
      ) : (
        <p className="text-sm text-semantic-text-muted italic">No email on file</p>
      )}
      {phone && (
        <div className="flex items-center gap-1.5 text-sm text-semantic-text-secondary mt-0.5">
          <Phone size={12} className="shrink-0" />
          <span>{phone}</span>
        </div>
      )}
    </div>
  );
}
