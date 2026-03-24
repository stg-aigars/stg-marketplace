'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { Card, CardBody, Badge, Button, Modal, Input } from '@/components/ui';
import type { OfferWithDetails } from '@/lib/shelves/types';
import {
  MIN_OFFER_CENTS, MAX_OFFER_CENTS, ACTIVE_OFFER_STATUSES,
  OFFER_STATUS_LABELS, OFFER_STATUS_BADGE_VARIANT,
} from '@/lib/shelves/types';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';
import {
  acceptOffer,
  declineOffer,
  cancelOffer,
  counterOffer,
} from '@/lib/offers/actions';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OfferCardProps {
  offer: OfferWithDetails;
  role: 'buyer' | 'seller';
  onUpdated: () => void;
}

export function OfferCard({ offer, role, onUpdated }: OfferCardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<'decline' | 'cancel' | null>(null);
  const [counterPriceStr, setCounterPriceStr] = useState('');
  const [counterError, setCounterError] = useState<string | null>(null);

  const isActive = ACTIVE_OFFER_STATUSES.includes(offer.status);
  const isGeekdo = offer.thumbnail?.includes('cf.geekdo-images.com');

  // ---- Actions ----

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await acceptOffer(offer.id);
        if ('error' in result) {
          setError(result.error);
          return;
        }
        onUpdated();
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  function handleConfirmDeclineOrCancel() {
    setError(null);
    const action = confirmModal === 'decline' ? declineOffer : cancelOffer;
    startTransition(async () => {
      try {
        const result = await action(offer.id);
        if ('error' in result) {
          setError(result.error);
          setConfirmModal(null);
          return;
        }
        setConfirmModal(null);
        onUpdated();
      } catch {
        setError('Something went wrong. Please try again.');
        setConfirmModal(null);
      }
    });
  }

  function handleSubmitCounter() {
    setCounterError(null);

    const normalized = normalizeDecimalInput(counterPriceStr);
    const parsed = parseFloat(normalized);

    if (isNaN(parsed) || normalized === '') {
      setCounterError('Please enter a counter amount');
      return;
    }

    const cents = Math.round(parsed * 100);

    if (cents < MIN_OFFER_CENTS) {
      setCounterError(`Minimum is ${formatCentsToCurrency(MIN_OFFER_CENTS)}`);
      return;
    }
    if (cents > MAX_OFFER_CENTS) {
      setCounterError(`Maximum is ${formatCentsToCurrency(MAX_OFFER_CENTS)}`);
      return;
    }

    startTransition(async () => {
      try {
        const result = await counterOffer(offer.id, cents);
        if ('error' in result) {
          setCounterError(result.error);
          return;
        }
        setCounterModalOpen(false);
        setCounterPriceStr('');
        onUpdated();
      } catch {
        setCounterError('Something went wrong. Please try again.');
      }
    });
  }

  // ---- Render helpers ----

  const otherParty =
    role === 'seller'
      ? `From ${offer.buyer_name}`
      : `To ${offer.seller_name}`;

  const hasCounter = offer.status === 'countered' && offer.counter_amount_cents != null;

  // ---- Action buttons ----

  function renderActions() {
    // Terminal states — no actions
    if (['declined', 'expired', 'cancelled', 'completed'].includes(offer.status)) {
      return null;
    }

    // Seller on accepted → create listing link
    if (role === 'seller' && offer.status === 'accepted') {
      return (
        <Link href={`/sell/from-offer/${offer.id}`}>
          <Button variant="primary" size="sm">
            Create listing
          </Button>
        </Link>
      );
    }

    // Seller on pending → Accept, Counter, Decline
    if (role === 'seller' && offer.status === 'pending') {
      return (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirmModal('decline')} disabled={isPending}>
            <span className="text-semantic-error">Decline</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCounterPriceStr('');
              setCounterError(null);
              setCounterModalOpen(true);
            }}
            disabled={isPending}
          >
            Counter
          </Button>
          <Button variant="primary" size="sm" onClick={handleAccept} disabled={isPending} loading={isPending}>
            Accept
          </Button>
        </div>
      );
    }

    // Buyer on countered → Accept, Decline, Cancel
    if (role === 'buyer' && offer.status === 'countered') {
      return (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirmModal('cancel')} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmModal('decline')} disabled={isPending}>
            <span className="text-semantic-error">Decline</span>
          </Button>
          <Button variant="primary" size="sm" onClick={handleAccept} disabled={isPending} loading={isPending}>
            Accept
          </Button>
        </div>
      );
    }

    // Buyer on pending → Cancel
    if (role === 'buyer' && offer.status === 'pending') {
      return (
        <Button variant="ghost" size="sm" onClick={() => setConfirmModal('cancel')} disabled={isPending}>
          Cancel
        </Button>
      );
    }

    return null;
  }

  const actions = renderActions();

  return (
    <>
      <Card>
        <CardBody>
          <div className="flex gap-3">
            {/* Thumbnail */}
            <div className="w-12 h-12 rounded overflow-hidden bg-semantic-bg-subtle flex-shrink-0 flex items-center justify-center">
              {offer.thumbnail ? (
                <Image
                  src={offer.thumbnail}
                  alt={offer.game_name}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                  unoptimized={!!isGeekdo}
                />
              ) : (
                <ImageSquare size={24} className="text-semantic-text-muted" />
              )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-semantic-text-primary line-clamp-1">
                {offer.game_name}{offer.game_year ? ` (${offer.game_year})` : ''}
              </p>
              <p className="text-sm text-semantic-text-muted">{otherParty}</p>

              {/* Amount */}
              <p className="mt-1">
                {hasCounter ? (
                  <>
                    <span className="text-sm text-semantic-text-muted line-through">
                      {formatCentsToCurrency(offer.amount_cents)}
                    </span>
                    <span className="mx-1 text-semantic-text-muted">&rarr;</span>
                    <span className="font-bold text-semantic-text-primary">
                      {formatCentsToCurrency(offer.counter_amount_cents!)}
                    </span>
                  </>
                ) : (
                  <span className="font-bold text-semantic-text-primary">
                    {formatCentsToCurrency(offer.amount_cents)}
                  </span>
                )}
              </p>

              {/* Note */}
              {offer.note && (
                <p className="mt-1 text-sm text-semantic-text-muted italic line-clamp-2">
                  {offer.note}
                </p>
              )}

              {/* Badge + dates row */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={OFFER_STATUS_BADGE_VARIANT[offer.status]}>{OFFER_STATUS_LABELS[offer.status]}</Badge>
                <span className="text-xs text-semantic-text-muted">
                  Offered {formatDate(offer.created_at)}
                </span>
                {isActive && offer.expires_at && (
                  <span className="text-xs text-semantic-text-muted">
                    Expires {formatDate(offer.expires_at)}
                  </span>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="mt-2 text-sm text-semantic-error">{error}</p>
              )}

              {/* Actions */}
              {actions && (
                <div className="mt-3 flex justify-end">{actions}</div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Counter modal */}
      <Modal
        open={counterModalOpen}
        onClose={() => setCounterModalOpen(false)}
        title="Counter offer"
      >
        <div className="space-y-4">
          <p className="text-sm text-semantic-text-muted">
            Original offer: {formatCentsToCurrency(offer.amount_cents)}
          </p>
          <Input
            label="Your counter price"
            prefix="€"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={counterPriceStr}
            onChange={(e) => setCounterPriceStr(e.target.value)}
            onBlur={(e) => setCounterPriceStr(normalizeDecimalInput(e.target.value))}
          />
          {counterError && (
            <p className="text-sm text-semantic-error">{counterError}</p>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="secondary"
            onClick={() => setCounterModalOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmitCounter}
            disabled={isPending}
            loading={isPending}
          >
            Send counter
          </Button>
        </div>
      </Modal>

      {/* Decline / Cancel confirmation modal */}
      <Modal
        open={confirmModal !== null}
        onClose={() => setConfirmModal(null)}
        title={confirmModal === 'decline' ? 'Decline offer' : 'Cancel offer'}
      >
        <p className="text-semantic-text-secondary">
          {confirmModal === 'decline'
            ? 'Are you sure you want to decline this offer? This cannot be undone.'
            : 'Are you sure you want to cancel your offer?'}
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="secondary"
            onClick={() => setConfirmModal(null)}
            disabled={isPending}
          >
            Go back
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmDeclineOrCancel}
            disabled={isPending}
            loading={isPending}
          >
            {confirmModal === 'decline' ? 'Decline' : 'Cancel offer'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
