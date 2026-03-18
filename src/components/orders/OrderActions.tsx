'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Modal } from '@/components/ui';
import { sanitizeErrorMessage } from '@/lib/utils/error-messages';
import type { OrderStatus, OrderWithDetails } from '@/lib/orders/types';

interface OrderActionsProps {
  order: OrderWithDetails;
  userRole: 'buyer' | 'seller';
  sellerPhone: string | null;
}

export function OrderActions({ order, userRole, sellerPhone }: OrderActionsProps) {
  const router = useRouter();
  const status = order.status as OrderStatus;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState(sellerPhone ?? '');
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  async function callAction(action: string, body?: Record<string, unknown>) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${order.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(body ?? {}),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(sanitizeErrorMessage(data.error));
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  }

  async function handleAccept() {
    const phone = phoneInput.trim();
    if (!phone) {
      setShowPhoneInput(true);
      return;
    }

    // Save phone to profile if it was newly entered
    if (!sellerPhone) {
      await fetch('/api/profile/phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ phone }),
      });
    }

    await callAction('accept', { sellerPhone: phone });
  }

  async function handleDecline() {
    setShowDeclineModal(false);
    await callAction('decline');
  }

  // Seller actions
  if (userRole === 'seller') {
    if (status === 'pending_seller') {
      return (
        <div className="space-y-3">
          {showPhoneInput && (
            <div>
              <Input
                label="Your phone number"
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+3706XXXXXXX"
                error={!phoneInput.trim() ? 'Phone is required to create a shipping parcel' : undefined}
              />
            </div>
          )}

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
            <Button
              variant="ghost"
              onClick={() => callAction('dispute')}
              disabled={loading}
            >
              Report issue
            </Button>
          </div>
          {error && <p className="text-sm text-semantic-error">{error}</p>}
        </div>
      );
    }
  }

  return null;
}
