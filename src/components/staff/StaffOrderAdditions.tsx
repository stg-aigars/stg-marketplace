import Link from 'next/link';
import {
  CreditCard,
  EnvelopeSimple,
  Info,
  Phone,
  User,
  Warning,
} from '@phosphor-icons/react/ssr';
import { Badge, Card, CardBody } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDateTime } from '@/lib/date-utils';
import { REFUND_STATUS } from '@/lib/services/order-refund';
import type { OrderWithDetails, DisputeRow } from '@/lib/orders/types';

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

  return (
    <div className="space-y-4">
      {/* Refund-status escalation panel */}
      {refundEscalated && (
        <Card className={
          refundStatus === REFUND_STATUS.FAILED
            ? 'border-semantic-error/30 bg-semantic-error/5'
            : 'border-semantic-warning/30 bg-semantic-warning/5'
        }>
          <CardBody>
            <div className="flex items-start gap-3">
              <Warning size={20} className={
                refundStatus === REFUND_STATUS.FAILED
                  ? 'text-semantic-error shrink-0 mt-0.5'
                  : 'text-semantic-warning shrink-0 mt-0.5'
              } />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-semantic-text-heading">
                    Refund {refundStatus}
                  </p>
                  <Badge variant={refundStatus === REFUND_STATUS.FAILED ? 'error' : 'warning'}>
                    {refundStatus}
                  </Badge>
                </div>
                <p className="text-sm text-semantic-text-secondary">
                  {refundStatus === REFUND_STATUS.FAILED
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
                      {refundAuditEntries.map((entry) => {
                        const m = entry.metadata ?? {};
                        const card = m.cardRefunded ?? 0;
                        const wallet = m.walletRefunded ?? 0;
                        return (
                          <div key={entry.created_at} className="font-mono">
                            <span className="text-semantic-text-muted">
                              {formatDateTime(entry.created_at)}
                            </span>
                            <span className="text-semantic-text-secondary ml-2">
                              card: {formatCentsToCurrency(card)} · wallet: {formatCentsToCurrency(wallet)}
                              {m.refundStatus && (
                                <span className="ml-2 text-semantic-text-muted">
                                  → {m.refundStatus}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Dispute resolve link */}
      {order.status === 'disputed' && dispute?.id && !dispute.resolved_at && (
        <Card className="border-semantic-error/30 bg-semantic-error/5">
          <CardBody className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Warning size={20} className="text-semantic-error shrink-0" />
              <div>
                <p className="font-semibold text-semantic-text-heading">Open dispute</p>
                <p className="text-sm text-semantic-text-secondary mt-0.5">
                  Review claims, then resolve.
                </p>
              </div>
            </div>
            <Link
              href={`/staff/disputes/${dispute.id}`}
              className="text-sm font-medium text-semantic-brand sm:hover:underline shrink-0"
            >
              Resolve dispute
            </Link>
          </CardBody>
        </Card>
      )}

      {/* Refund-not-processed notice */}
      {order.status === 'cancelled' && !order.refunded_at && (
        <Card className="border-semantic-warning/30 bg-semantic-warning/5">
          <CardBody className="flex items-center gap-3">
            <Info size={20} className="text-semantic-warning shrink-0" />
            <div>
              <p className="font-semibold text-semantic-text-heading">Refund not processed</p>
              <p className="text-sm text-semantic-text-secondary mt-0.5">
                This cancelled order has no refund on record. Process via EveryPay dashboard or wait for the reconciliation sweep.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Contact details — emails and phones not shown in user view */}
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

      {/* Payment internals */}
      <Card>
        <CardBody>
          <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
            <CreditCard size={16} className="inline mr-1.5 -mt-0.5" />
            Payment internals
          </h3>
          <dl className="space-y-2 text-sm">
            {order.platform_commission_cents != null && (
              <div className="flex justify-between">
                <dt className="text-semantic-text-muted">Commission (10%)</dt>
                <dd className="text-semantic-text-primary">
                  {formatCentsToCurrency(order.platform_commission_cents)}
                </dd>
              </div>
            )}
            {order.platform_commission_cents != null && (
              <div className="flex justify-between">
                <dt className="text-semantic-text-muted">Seller earnings</dt>
                <dd className="text-semantic-success font-medium">
                  {formatCentsToCurrency(order.items_total_cents - order.platform_commission_cents)}
                </dd>
              </div>
            )}
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
            {order.payment_method && (
              <div className="flex justify-between">
                <dt className="text-semantic-text-muted">Method</dt>
                <dd className="text-semantic-text-primary capitalize">
                  {order.payment_method === 'bank_link' ? 'Bank link' : order.payment_method}
                </dd>
              </div>
            )}
            {order.buyer_wallet_debit_cents > 0 && (
              <div className="flex justify-between">
                <dt className="text-semantic-text-muted">Wallet debit</dt>
                <dd className="text-semantic-text-primary">
                  {formatCentsToCurrency(order.buyer_wallet_debit_cents)}
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
            {order.refund_amount_cents != null && order.refund_amount_cents > 0 && (
              <div className="flex justify-between">
                <dt className="text-semantic-text-muted">Refund</dt>
                <dd className="text-semantic-error font-medium">
                  {formatCentsToCurrency(order.refund_amount_cents)}
                  {refundStatus && (
                    <span className="text-semantic-text-muted font-normal ml-1">
                      ({refundStatus})
                    </span>
                  )}
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
