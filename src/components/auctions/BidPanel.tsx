'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gavel } from '@phosphor-icons/react/ssr';
import { Card, CardBody, Button, Input, Alert, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';
import { placeBid } from '@/lib/auctions/bid-actions';
import { getMinimumBid } from '@/lib/auctions/types';
import type { AuctionState, BidWithBidder } from '@/lib/auctions/types';
import { AuctionCountdown } from './AuctionCountdown';

interface BidPanelProps {
  listingId: string;
  initialState: AuctionState;
  bids: BidWithBidder[];
  currentUserId: string | null;
  sellerId: string;
}

export function BidPanel({
  listingId,
  initialState,
  bids: initialBids,
  currentUserId,
  sellerId,
}: BidPanelProps) {
  const [state, setState] = useState(initialState);
  const [bids] = useState(initialBids);
  const [bidEur, setBidEur] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const router = useRouter();

  const isOwner = currentUserId != null && currentUserId === sellerId;
  const isHighestBidder = currentUserId != null && currentUserId === state.highestBidderId;
  const isEnded = state.status !== 'active';
  const hasBid = currentUserId ? bids.some((b) => b.bidder_id === currentUserId) : false;
  const minBid = getMinimumBid(state.currentBidCents, state.startingPriceCents);

  // Poll for auction state updates every 10 seconds
  useEffect(() => {
    if (isEnded) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auctions/${listingId}/state`);
        if (res.ok) {
          const fresh = await res.json();
          setState(fresh);
        }
      } catch { /* silent — will retry next interval */ }
    }, 10000);

    return () => clearInterval(interval);
  }, [listingId, isEnded]);

  function handleSubmit() {
    setError(null);
    setSuccess(null);

    const amountCents = Math.round(parseFloat(bidEur) * 100);
    if (isNaN(amountCents) || amountCents < minBid) {
      setError(`Minimum bid is ${formatCentsToCurrency(minBid)}`);
      return;
    }

    startTransition(async () => {
      const result = await placeBid(listingId, amountCents, turnstileToken ?? undefined);

      if ('error' in result) {
        setError(result.error);
        turnstileRef.current?.reset();
      } else {
        setSuccess(`Bid of ${formatCentsToCurrency(amountCents)} placed`);
        setBidEur('');
        setState((prev) => ({
          ...prev,
          currentBidCents: amountCents,
          bidCount: result.bidCount,
          highestBidderId: currentUserId,
          auctionEndAt: result.newEndAt,
        }));
        turnstileRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        {/* Current bid / starting price */}
        <div>
          <p className="text-sm text-semantic-text-muted">
            {state.currentBidCents ? 'Current bid' : 'Starting price'}
          </p>
          <p className="text-2xl font-bold text-semantic-text-heading">
            {formatCentsToCurrency(state.currentBidCents ?? state.startingPriceCents)}
          </p>
          <p className="text-xs text-semantic-text-muted mt-0.5">
            {state.bidCount} {state.bidCount === 1 ? 'bid' : 'bids'}
          </p>
        </div>

        {/* Time remaining */}
        <div>
          <p className="text-sm text-semantic-text-muted">Time remaining</p>
          <AuctionCountdown endAt={state.auctionEndAt} className="text-sm" />
        </div>

        {/* Status banners */}
        {isHighestBidder && !isEnded && (
          <Alert variant="success">You are the highest bidder</Alert>
        )}
        {hasBid && !isHighestBidder && !isEnded && (
          <Alert variant="warning">You have been outbid</Alert>
        )}

        {/* Bid form */}
        {!isOwner && !isEnded && currentUserId && !isHighestBidder && (
          <div className="space-y-3 pt-2 border-t border-semantic-border-subtle">
            {error && <Alert variant="error">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            <Input
              label={`Your bid (min ${formatCentsToCurrency(minBid)})`}
              type="text"
              inputMode="decimal"
              prefix="€"
              value={bidEur}
              onChange={(e) => setBidEur(normalizeDecimalInput(e.target.value))}
              placeholder={(minBid / 100).toFixed(2)}
            />

            <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

            <Button onClick={handleSubmit} loading={isPending} size="lg">
              <Gavel size={18} weight="bold" className="mr-1.5" />
              Place bid
            </Button>

            <p className="text-xs text-semantic-text-muted">
              Bids are final and cannot be withdrawn.
            </p>
          </div>
        )}

        {isOwner && !isEnded && (
          <p className="text-sm text-semantic-text-muted">
            You cannot bid on your own auction.
          </p>
        )}

        {!currentUserId && !isEnded && (
          <p className="text-sm text-semantic-text-muted">
            <Link href="/auth/signin" className="text-semantic-brand font-medium">Sign in</Link> to place a bid.
          </p>
        )}

        {/* Bid history */}
        {bids.length > 0 && (
          <div className="pt-3 border-t border-semantic-border-subtle">
            <p className="text-sm font-medium text-semantic-text-heading mb-2">Bid history</p>
            <ul className="space-y-1.5">
              {bids.slice(0, 10).map((bid) => (
                <li key={bid.id} className="flex items-center justify-between text-xs">
                  <span className="text-semantic-text-muted">
                    {bid.bidder_name}
                    {bid.bidder_id === currentUserId && ' (you)'}
                  </span>
                  <span className="font-medium text-semantic-text-primary">
                    {formatCentsToCurrency(bid.amount_cents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
