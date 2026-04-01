'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Modal, Alert } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { sanitizeErrorMessage } from '@/lib/utils/error-messages';
import { DISPUTE_WINDOW_DAYS } from '@/lib/pricing/constants';
import { canEscalateDispute, canWithdrawDispute } from '@/lib/services/dispute-validation';
import { DisputeForm } from './DisputeForm';
import type { OrderStatus, OrderWithDetails, DisputeRow } from '@/lib/orders/types';

interface OrderActionsProps {
  order: OrderWithDetails;
  userRole: 'buyer' | 'seller';
  sellerPhone: string | null;
  dispute?: DisputeRow | null;
}

/** Calculate hours remaining in the dispute window */
function getDisputeWindowRemaining(deliveredAt: string | null): { expired: boolean; text: string } {
  if (!deliveredAt) return { expired: true, text: '' };

  const windowEnd = new Date(deliveredAt);
  windowEnd.setDate(windowEnd.getDate() + DISPUTE_WINDOW_DAYS);
  const now = new Date();
  const msRemaining = windowEnd.getTime() - now.getTime();

  if (msRemaining <= 0) {
    return { expired: true, text: 'This order is being finalized' };
  }

  const hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60));
  if (hoursRemaining > 24) {
    const daysRemaining = Math.ceil(hoursRemaining / 24);
    return { expired: false, text: `This order will auto-complete in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} — report any issues before then` };
  }

  if (hoursRemaining < 1) {
    const minutesRemaining = Math.ceil(msRemaining / (1000 * 60));
    return { expired: false, text: `This order will auto-complete in ${minutesRemaining} ${minutesRemaining === 1 ? 'minute' : 'minutes'} — report any issues before then` };
  }

  return { expired: false, text: `This order will auto-complete in ${hoursRemaining} ${hoursRemaining === 1 ? 'hour' : 'hours'} — report any issues before then` };
}

export function OrderActions({ order, userRole, sellerPhone, dispute }: OrderActionsProps) {
  const router = useRouter();
  const status = order.status as OrderStatus;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const userId = userRole === 'buyer' ? order.buyer_id : order.seller_id;

  async function callAction(action: string, body?: Record<string, unknown>) {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/orders/${order.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(sanitizeErrorMessage(data.error));
        return;
      }

      router.refresh();
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    await callAction('accept', { sellerPhone: sellerPhone });
  }

  async function handleDecline() {
    setShowDeclineModal(false);
    await callAction('decline');
  }

  // Seller actions
  if (userRole === 'seller') {
    if (status === 'pending_seller') {
      if (!sellerPhone) {
        return (
          <Alert variant="info">
            <p className="text-sm">
              Add your phone number to accept orders.{' '}
              <Link
                href={`/account/settings?returnUrl=/orders/${order.id}`}
                className="font-medium text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom"
              >
                Go to settings
              </Link>
            </p>
          </Alert>
        );
      }

      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            <Button
              variant="primary"
              loading={loading}
              onClick={handleAccept}
              className="flex-1"
            >
              Accept order
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowDeclineModal(true)}
              disabled={loading}
              className="text-semantic-error sm:hover:text-semantic-error-hover sm:hover:bg-semantic-error/10"
            >
              Decline
            </Button>
          </div>

          {error && <p className="text-sm text-semantic-error">{error}</p>}

          <Modal
            open={showDeclineModal}
            onClose={() => setShowDeclineModal(false)}
            title="Decline this order"
          >
            <p className="text-sm text-semantic-text-secondary mb-6">
              Are you sure you want to decline? The listing will be made available again and the buyer will be refunded.
            </p>
            <div className="flex gap-3">
              <Button
                variant="danger"
                loading={loading}
                onClick={handleDecline}
                className="flex-1"
              >
                Yes, decline
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowDeclineModal(false)}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </Modal>
        </div>
      );
    }

    if (status === 'accepted') {
      const hasShippingError = !!order.shipping_error && !order.unisend_parcel_id;

      return (
        <div className="space-y-3">
          {hasShippingError ? (
            <>
              <Button
                variant="primary"
                loading={loading}
                onClick={() => callAction('retry-shipping')}
                className="w-full"
              >
                Retry shipping setup
              </Button>
              <p className="text-xs text-semantic-text-muted text-center">
                This will attempt to create the Unisend shipping parcel again
              </p>
            </>
          ) : (
            <Button
              variant="primary"
              loading={loading}
              onClick={() => callAction('ship')}
              className="w-full"
            >
              Mark as shipped
            </Button>
          )}
          {error && <p className="text-sm text-semantic-error">{error}</p>}
        </div>
      );
    }

    if (status === 'disputed' && dispute && !dispute.resolved_at) {
      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            <Button
              variant="danger"
              onClick={() => setShowRefundModal(true)}
              disabled={loading}
              className="flex-1"
            >
              Accept and refund
            </Button>
            {dispute && canEscalateDispute(dispute, userId).allowed && (
              <Button
                variant="ghost"
                onClick={() => callAction('dispute/escalate')}
                disabled={loading}
              >
                Escalate to staff
              </Button>
            )}
          </div>

          {dispute.escalated_at && (
            <p className="text-xs text-semantic-text-muted">This dispute has been escalated to staff for review</p>
          )}

          {error && <p className="text-sm text-semantic-error">{error}</p>}

          <Modal
            open={showRefundModal}
            onClose={() => setShowRefundModal(false)}
            title="Confirm refund"
          >
            <p className="text-sm text-semantic-text-secondary mb-6">
              This will refund the full order amount to the buyer&apos;s wallet. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="danger"
                loading={loading}
                onClick={() => {
                  setShowRefundModal(false);
                  callAction('dispute/accept-refund');
                }}
                className="flex-1"
              >
                Yes, refund buyer
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowRefundModal(false)}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </Modal>
        </div>
      );
    }
  }

  // Buyer actions
  if (userRole === 'buyer') {
    if (status === 'shipped') {
      return (
        <div className="space-y-3">
          <Button
            variant="primary"
            loading={loading}
            onClick={() => callAction('deliver')}
            className="w-full"
          >
            I picked up my parcel
          </Button>
          {error && <p className="text-sm text-semantic-error">{error}</p>}
        </div>
      );
    }

    if (status === 'delivered') {
      const disputeWindow = getDisputeWindowRemaining(order.delivered_at);

      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            <Button
              variant="primary"
              loading={loading}
              onClick={() => callAction('complete')}
              className="flex-1"
            >
              Confirm received
            </Button>
            {!disputeWindow.expired && (
              <Button
                variant="ghost"
                onClick={() => setShowDisputeForm(true)}
                disabled={loading}
              >
                Report issue
              </Button>
            )}
          </div>
          {disputeWindow.text && (
            <p className="text-xs text-semantic-text-muted">{disputeWindow.text}</p>
          )}
          {error && <p className="text-sm text-semantic-error">{error}</p>}

          <DisputeForm
            orderId={order.id}
            open={showDisputeForm}
            onClose={() => setShowDisputeForm(false)}
          />
        </div>
      );
    }

    if (status === 'disputed' && dispute && !dispute.resolved_at) {
      return (
        <div className="space-y-3">
          <div className="flex gap-3">
            {dispute && canWithdrawDispute(dispute, userId).allowed && (
              <Button
                variant="ghost"
                onClick={() => callAction('dispute/withdraw')}
                loading={loading}
              >
                Withdraw dispute
              </Button>
            )}
            {dispute && canEscalateDispute(dispute, userId).allowed && (
              <Button
                variant="ghost"
                onClick={() => callAction('dispute/escalate')}
                disabled={loading}
              >
                Escalate to staff
              </Button>
            )}
          </div>
          {dispute.escalated_at && (
            <p className="text-xs text-semantic-text-muted">This dispute has been escalated to staff for review</p>
          )}
          {error && <p className="text-sm text-semantic-error">{error}</p>}
        </div>
      );
    }
  }

  return null;
}
